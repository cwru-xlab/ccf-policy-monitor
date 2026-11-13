"""Mapping engine units that need neither a database nor the network."""

import json

import httpx
import pytest

from policy_radar import discovery, firecrawl, tracking
from policy_radar.config import settings
from policy_radar.models import Code, Policy, PolicyCriterion

# --- URLs -------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "raw, normalized",
    [
        ("http://WWW.Example.org/Guide/?utm_source=x&b=2&a=1#top",
         "https://www.example.org/Guide?a=1&b=2"),
        ("https://example.org/", "https://example.org"),
        ("https://example.org/path/", "https://example.org/path"),
        ("https://example.org:8443/p?gclid=1", "https://example.org:8443/p"),
    ],
)
def test_normalize_url(raw, normalized):
    assert tracking.normalize_url(raw) == normalized


def test_source_id_is_stable_across_spellings():
    assert tracking.source_id("http://a.org/x/#f") == tracking.source_id("https://A.org/x")


def test_domain_strips_www():
    assert tracking.domain("https://www.uspreventiveservicestaskforce.org/uspstf/x") == (
        "uspreventiveservicestaskforce.org"
    )


def test_unified_diff_shows_changed_line():
    diff = tracking.unified_diff("a\nage 50\nb\n", "a\nage 45\nb\n")
    assert "-age 50" in diff and "+age 45" in diff


# --- Firecrawl client -----------------------------------------------------------------


@pytest.fixture
def firecrawl_key(monkeypatch):
    monkeypatch.setattr(settings, "firecrawl_api_key", "fc-test")


def _transport(handler):
    def wrapped(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer fc-test"
        return handler(request.url.path, json.loads(request.content))

    return httpx.MockTransport(wrapped)


async def test_search_sends_filters_and_parses_web_results(firecrawl_key):
    seen = {}

    def handler(path, body):
        seen.update(path=path, body=body)
        return httpx.Response(200, json={"success": True, "data": {"web": [
            {"url": "https://a.org/g", "title": "G", "description": "d"}, {"title": "no url"},
        ]}})

    results = await firecrawl.search(
        "colorectal screening", recent=True, domains=["a.org"], transport=_transport(handler)
    )
    assert seen["path"] == "/v2/search"
    assert seen["body"]["tbs"] == firecrawl.RECENT and seen["body"]["includeDomains"] == ["a.org"]
    assert results == [firecrawl.SearchResult("https://a.org/g", "G", "d")]


async def test_scrape_bypasses_cache_and_reads_metadata(firecrawl_key):
    def handler(path, body):
        assert path == "/v2/scrape" and body["maxAge"] == 0
        return httpx.Response(200, json={"success": True, "data": {
            "markdown": "# Hi", "metadata": {"title": ["T"], "sourceURL": "https://a.org/g",
                                             "contentType": "application/pdf; x"}}})

    page = await firecrawl.scrape("https://a.org/g", transport=_transport(handler))
    assert page == firecrawl.Page("https://a.org/g", "T", "# Hi", "application/pdf")


async def test_errors_raise_firecrawl_error(firecrawl_key):
    def handler(path, body):
        return httpx.Response(402, json={"success": False, "error": "Payment required"})

    with pytest.raises(firecrawl.FirecrawlError, match="402: Payment required"):
        await firecrawl.search("q", transport=_transport(handler))


async def test_missing_key_raises(monkeypatch):
    monkeypatch.setattr(settings, "firecrawl_api_key", "")
    with pytest.raises(firecrawl.FirecrawlError, match="not set"):
        await firecrawl.search("q")


# --- discovery agent loop ---------------------------------------------------------------


def _reply(*content):
    return {"output": {"message": {"role": "assistant", "content": list(content)}}}


def _use(tool_id, name, **args):
    return {"toolUse": {"toolUseId": tool_id, "name": name, "input": args}}


class ScriptedModel:
    """A fake Converse endpoint replaying ``replies`` and recording each request."""

    def __init__(self, *replies):
        self.replies, self.requests = list(replies), []

    def __call__(self, messages):
        self.requests.append(json.loads(json.dumps(messages)))
        return self.replies.pop(0)


@pytest.fixture
def fake_web(monkeypatch):
    async def search(query, recent=False, domains=None):
        fake_web.calls.append(("search", query, recent, domains))
        return [firecrawl.SearchResult("https://a.org/guide/", "Guide", "about it")]

    async def scrape(url):
        fake_web.calls.append(("scrape", url))
        return firecrawl.Page(url, "Guide", "See [pdf](https://a.org/guide.pdf) here.", "text/html")

    fake_web.calls = []
    monkeypatch.setattr(firecrawl, "search", search)
    monkeypatch.setattr(firecrawl, "scrape", scrape)
    return fake_web


async def test_agent_runs_tools_and_returns_submission(fake_web):
    submission = {"authorities": [], "guidelines": [{"url": "https://a.org/guide.pdf",
                                                     "title": "G", "rationale": "r"}]}
    model = ScriptedModel(
        _reply({"reasoningContent": {"reasoningText": {"text": "x", "signature": "s"}}},
               _use("1", "search_web", query="q"), _use("2", "read_page", url="https://a.org/guide")),
        _reply(_use("3", "submit_proposals", **submission)),
    )
    proposals, seen = await discovery.run_agent("brief", None, converse=model)

    assert proposals == submission
    # the URL linked from the read page counts as seen, so it may be proposed
    assert {"https://a.org/guide", "https://a.org/guide.pdf"} <= seen
    second = model.requests[1]
    assert "reasoningContent" in second[1]["content"][0]  # assistant turn replayed unchanged
    results = second[2]["content"]  # both tool results in one user message
    assert [r["toolResult"]["toolUseId"] for r in results] == ["1", "2"]
    assert all(r["toolResult"]["status"] == "success" for r in results)


async def test_agent_scheduled_mode_limits_search(fake_web):
    model = ScriptedModel(
        _reply(_use("1", "search_web", query="q")),
        _reply(_use("2", "submit_proposals", authorities=[], guidelines=[])),
    )
    await discovery.run_agent("brief", ["a.org"], converse=model)
    assert fake_web.calls == [("search", "q", True, ["a.org"])]


async def test_agent_nudges_once_then_fails():
    model = ScriptedModel(_reply({"text": "done"}), _reply({"text": "still done"}))
    with pytest.raises(discovery.DiscoveryError):
        await discovery.run_agent("brief", None, converse=model)
    assert model.requests[1][-1]["content"][0]["text"] == "Call submit_proposals now."


async def test_agent_tool_budget_reports_error(fake_web, monkeypatch):
    monkeypatch.setattr(discovery, "MAX_CALLS_PER_TOOL", 1)
    model = ScriptedModel(
        _reply(_use("1", "search_web", query="a"), _use("2", "search_web", query="b")),
        _reply(_use("3", "submit_proposals", authorities=[], guidelines=[])),
    )
    await discovery.run_agent("brief", None, converse=model)
    statuses = [r["toolResult"]["status"] for r in model.requests[1][-1]["content"]]
    assert statuses == ["success", "error"]


def test_brief_lists_known_urls_and_scheduled_scope():
    policy = Policy(
        policy_number="0516", doc_type="medical_clinical_policy_bulletin", title="CRC screening",
        coverage_effect="covered", effective_date="2026-01-01", document_id="cpb_upload-x",
        codes=(Code(system="cpt", value="45378"),),
        criteria=(PolicyCriterion(criterion_id="0516:1", parent_id="0516", text="Colonoscopy q10y"),),
    )
    text = discovery.brief(policy, {"https://a.org/g"}, ["a.org"])
    assert "CPT 45378" in text and "Colonoscopy q10y" in text
    assert "- https://a.org/g" in text and "limited to a.org" in text


async def test_snapshot_refuses_error_pages(monkeypatch):
    async def scrape(url):
        return firecrawl.Page(url, "404 | Not Found", "Page not found", "text/html", 404)

    monkeypatch.setattr(firecrawl, "scrape", scrape)
    with pytest.raises(firecrawl.FirecrawlError, match="HTTP 404"):
        await tracking.take_snapshot("https://a.org/gone")
