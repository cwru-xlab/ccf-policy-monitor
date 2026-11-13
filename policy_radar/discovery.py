"""The discovery agent: reads one policy, searches the web, proposes authorities and guidelines.

A Bedrock Converse tool loop (Claude on Bedrock, ``settings.discovery_model``) with three
tools: ``search_web`` and ``read_page`` (Firecrawl) and ``submit_proposals``, which ends the
run. Proposals are stored for human approval; nothing is tracked here.

Guards (docs/MAPPING_ENGINE_SPEC.md): bounded turns and tool calls; a guideline URL must
have been seen in this run's search results or read pages; URLs already known for the
policy are never proposed again.
"""

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field

from policy_radar import db, firecrawl, llm, pipelines
from policy_radar.config import settings
from policy_radar.enums import MappingOrigin
from policy_radar.models import Policy
from policy_radar.tracking import domain, normalize_url, source_id

log = logging.getLogger(__name__)

MAX_TURNS = 12
MAX_CALLS_PER_TOOL = 8
PAGE_CHARS = 6_000
_URL = re.compile(r"https?://[^\s)\]>\"'<]+")

SYSTEM_PROMPT = """You find the external clinical guidelines that a payer coverage policy \
should be checked against. Guidelines come from authorities: federal bodies (USPSTF, CDC/ACIP, \
CMS national coverage determinations, FDA labels), medical societies (e.g. ACOG, ACS, NCCN, \
AAP, ACC/AHA) and recognized expert panels.

Work like a careful researcher:
1. Identify the services, drugs, tests or conditions the policy decides coverage for.
2. Search for the authorities that publish recommendations on them, and for each authority's \
current guideline or recommendation page on that topic. Prefer the authority's own site over \
news, summaries, or vendors. Prefer the current version over archived ones.
3. Read a page when you need to confirm it is a guideline (a recommendation statement, \
practice guideline, coverage determination or label) and that it addresses the policy's topic.
4. Call submit_proposals once, with every authority and guideline you are confident about, \
each with a one-sentence rationale tying it to the policy. Propose only URLs you saw in search \
results or on pages you read; never construct a URL. Quality over quantity: 3-10 guidelines \
is typical. If nothing qualifies, submit empty lists.

Tool budgets are limited; when a tool reports its budget is spent, submit what you have."""

TOOLS = [
    {"toolSpec": {
        "name": "search_web",
        "description": "Web search. Returns up to 8 results with url, title and description.",
        "inputSchema": {"json": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "recent_only": {"type": "boolean", "description": "Only pages from the past month."},
            },
            "required": ["query"],
        }},
    }},
    {"toolSpec": {
        "name": "read_page",
        "description": f"Main content of one URL as Markdown (first {PAGE_CHARS} characters).",
        "inputSchema": {"json": {
            "type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"],
        }},
    }},
    {"toolSpec": {
        "name": "submit_proposals",
        "description": "Submit the final proposals. Ends the research.",
        "inputSchema": {"json": {
            "type": "object",
            "properties": {
                "authorities": {"type": "array", "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "homepage_url": {"type": "string"},
                        "rationale": {"type": "string"},
                    },
                    "required": ["name", "homepage_url", "rationale"],
                }},
                "guidelines": {"type": "array", "items": {
                    "type": "object",
                    "properties": {
                        "url": {"type": "string"},
                        "title": {"type": "string"},
                        "authority_homepage_url": {"type": "string"},
                        "rationale": {"type": "string"},
                    },
                    "required": ["url", "title", "rationale"],
                }},
            },
            "required": ["authorities", "guidelines"],
        }},
    }},
]


class DiscoveryError(RuntimeError):
    """The agent ended without submitting proposals."""


@dataclass
class _Run:
    """Tool state for one agent run: budgets and every URL the agent has seen."""

    domains: list[str] | None
    seen: set[str] = field(default_factory=set)
    calls: dict[str, int] = field(default_factory=dict)

    async def call(self, name: str, args: dict) -> object:
        self.calls[name] = self.calls.get(name, 0) + 1
        if self.calls[name] > MAX_CALLS_PER_TOOL:
            raise RuntimeError(f"{name} budget spent; call submit_proposals now")
        if name == "search_web":
            results = await firecrawl.search(
                args["query"], recent=bool(args.get("recent_only")) or self.domains is not None,
                domains=self.domains,
            )
            self.seen.update(normalize_url(r.url) for r in results)
            return [r.__dict__ for r in results]
        if name == "read_page":
            page = await firecrawl.scrape(args["url"])
            self.seen.update(normalize_url(u) for u in (args["url"], page.url))
            self.seen.update(normalize_url(u) for u in _URL.findall(page.markdown))
            return {"url": page.url, "title": page.title, "markdown": page.markdown[:PAGE_CHARS]}
        raise RuntimeError(f"unknown tool {name}")


def _converse(messages: list[dict]) -> dict:
    return llm.bedrock_client.converse(
        modelId=settings.discovery_model,
        system=[{"text": SYSTEM_PROMPT}],
        messages=messages,
        toolConfig={"tools": TOOLS},
        inferenceConfig={"maxTokens": 16000},
    )


async def _result(run: _Run, use: dict) -> dict:
    try:
        content = [{"json": {"result": await run.call(use["name"], use["input"])}}]
        status = "success"
    except Exception as e:  # noqa: BLE001 — the model sees the error and adapts
        content, status = [{"text": f"{type(e).__name__}: {e}"}], "error"
    return {"toolResult": {"toolUseId": use["toolUseId"], "content": content, "status": status}}


async def run_agent(
    brief: str, domains: list[str] | None, converse=None
) -> tuple[dict, set[str]]:
    """Run the tool loop to ``submit_proposals``. Returns (proposals, URLs seen)."""
    converse = converse or _converse
    run = _Run(domains)
    messages: list[dict] = [{"role": "user", "content": [{"text": brief}]}]
    nudged = False
    for _ in range(MAX_TURNS):
        message = (await asyncio.to_thread(converse, messages))["output"]["message"]
        messages.append(message)  # unchanged: reasoning blocks must be replayed as returned
        uses = [c["toolUse"] for c in message["content"] if "toolUse" in c]
        submit = next((u for u in uses if u["name"] == "submit_proposals"), None)
        if submit:
            return submit["input"], run.seen
        if not uses:
            if nudged:
                break
            nudged = True
            messages.append({"role": "user", "content": [{"text": "Call submit_proposals now."}]})
            continue
        messages.append({"role": "user", "content": [await _result(run, u) for u in uses]})
    raise DiscoveryError(f"the agent did not submit proposals within {MAX_TURNS} turns")


def brief(policy: Policy, known: set[str], domains: list[str] | None) -> str:
    """The user message: the policy, and what not to propose again."""
    lines = [
        (f"Policy: {policy.title} (number {policy.policy_number}, {policy.doc_type}, "
         f"predominant effect: {policy.coverage_effect})."),
        "Codes: " + (", ".join(f"{c.system.upper()} {c.value}" for c in policy.codes[:40]) or "none"),
        "Criteria:",
        *(f"- {c.text[:300]}" for c in policy.criteria[:40]),
    ]
    if known:
        lines += ["Already known (do not propose again):", *(f"- {u}" for u in sorted(known))]
    if domains:
        lines.append(
            "This is a scheduled check for NEW or UPDATED guidance from approved authorities. "
            f"Searches are limited to {', '.join(domains)} and the past month. Propose only "
            "guidance on this policy's topic published or revised recently."
        )
    return "\n".join(lines)


async def store_proposals(
    policy_document_id: str, proposals: dict, seen: set[str], origin: MappingOrigin
) -> dict:
    """Store new authorities and (guideline, policy) proposals; drop unseen and known URLs."""
    for a in proposals.get("authorities", []):
        if aid := domain(a.get("homepage_url", "")):
            await db.add_authority(aid, a["name"], normalize_url(a["homepage_url"]), a["rationale"])
    known = await db.known_urls(policy_document_id)
    stored, unverified = 0, []
    for g in proposals.get("guidelines", []):
        url = normalize_url(g["url"])
        if url not in seen:
            unverified.append(g["url"])
            continue
        if url in known:
            continue
        sid = source_id(url)
        await db.add_source(sid, url, g["title"], domain(g.get("authority_homepage_url") or url))
        stored += await db.propose_mapping(sid, policy_document_id, g["rationale"], origin)
        known.add(url)
    return {
        "authorities_proposed": len(proposals.get("authorities", [])),
        "guidelines_proposed": stored,
        "dropped_unverified": unverified,
    }


async def discover(policy_document_id: str, scheduled: bool = False) -> dict:
    """Run discovery for one policy (parsing it first if needed) and store proposals."""
    policy = await pipelines.policy_for_document(policy_document_id)
    if policy is None:
        raise ValueError(f"{policy_document_id!r} is not an uploaded policy document")
    domains = None
    if scheduled:
        domains = await db.approved_authority_domains()
        if not domains:
            return {"policy_document_id": policy_document_id, "skipped": "no approved authorities"}
    known = await db.known_urls(policy_document_id)
    proposals, seen = await run_agent(brief(policy, known, domains), domains)
    log.info("discovery for %s: %s", policy_document_id, json.dumps(proposals)[:2000])
    origin = MappingOrigin.SCHEDULED if scheduled else MappingOrigin.DISCOVERY
    result = await store_proposals(policy_document_id, proposals, seen, origin)
    return {"policy_document_id": policy_document_id, **result}
