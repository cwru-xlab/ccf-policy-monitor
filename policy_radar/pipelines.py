"""The three background pipelines: ingest guidelines, atomize guidelines, parse CPBs.
Plus on-demand lookups that run the atomize or parse step for one document if it is missing.

Each returns a small dict of counts that becomes the job's ``detail``. A failure on one
document is recorded and the run continues; only a failure of the whole run fails the job.
"""

import logging
import uuid
from datetime import UTC, date, datetime, timedelta

import httpx

from policy_radar import db, llm, parser, storage
from policy_radar.enums import STRENGTH_VALUES, CodeSystem, StrengthSystem
from policy_radar.models import (
    Code,
    Guideline,
    GuidelineCriterion,
    Policy,
    PolicyCriterion,
    SourceDocument,
)
from policy_radar.sources import SOURCES

log = logging.getLogger(__name__)

DEFAULT_LOOKBACK = timedelta(days=30)


async def store_document(
    source_key: str, content: bytes, media_type: str, origin_url: str | None
) -> SourceDocument | None:
    """Save bytes to object storage and a SourceDocument row; None if already stored."""
    key, sha = storage.object_key(source_key, content, media_type)
    doc = SourceDocument(
        document_id=f"{source_key}-{sha[:16]}",
        source_key=source_key,
        retrieved_at=datetime.now(UTC),
        storage_uri=key,
        content_sha256=sha,
        media_type=media_type,
        origin_url=origin_url,
    )
    storage.put(key, content)
    return doc if await db.insert_source_document(doc) else None


async def ingest(source_key: str, since: date | None) -> dict:
    """Fetch everything ``source_key`` published since ``since`` and store what is new.

    ``since`` defaults to the source's last new document, or 30 days ago on first run.
    """
    if since is None:
        last = await db.last_retrieved(source_key)
        since = (last or datetime.now(UTC) - DEFAULT_LOOKBACK).date()
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        fetched = await SOURCES[source_key](client, since)
    new = [await store_document(source_key, f.content, f.media_type, f.origin_url) for f in fetched]
    stored = sum(d is not None for d in new)
    return {"since": since.isoformat(), "fetched": len(fetched), "new": stored}


def _criteria[C: (GuidelineCriterion, PolicyCriterion)](
    model: type[C], parent_id: str, extracted: list[llm.ExtractedCriterion]
) -> tuple[C, ...]:
    return tuple(
        model(
            criterion_id=f"{parent_id}:{i}",
            parent_id=parent_id,
            text=c.text,
            concept_words=tuple(c.concept_words),
        )
        for i, c in enumerate(extracted, 1)
    )


def _sanitize_strength(
    strength: str | None, strength_system_str: str | None
) -> tuple[str | None, StrengthSystem | None]:
    """Coerce incomplete or out-of-vocabulary grades to (None, None) so Guideline validates."""
    if strength is None or strength_system_str is None:
        if strength or strength_system_str:
            log.warning("dropping unpaired strength=%r strength_system=%r", strength, strength_system_str)
        return None, None
    try:
        system_enum = StrengthSystem(strength_system_str)
    except ValueError:
        log.warning("dropping invalid strength_system %r", strength_system_str)
        return None, None

    allowed = {m.value for m in STRENGTH_VALUES[system_enum]}
    if strength not in allowed:
        log.warning(
            "dropping invalid strength %r for %s; allowed %s",
            strength, system_enum, sorted(allowed),
        )
        return None, None
    return strength, system_enum


def _merge_codes(llm_codes: list[llm.ExtractedCode], regex_codes: list[Code]) -> tuple[Code, ...]:
    """LLM codes first, then regex fills; duplicate (system, value) pairs are skipped."""
    merged: list[Code] = []
    seen: set[tuple[CodeSystem, str]] = set()
    for item in (*llm_codes, *regex_codes):
        code = item if isinstance(item, Code) else Code(system=item.system, value=item.value)
        key = (code.system, code.value)
        if key not in seen:
            seen.add(key)
            merged.append(code)
    return tuple(merged)


async def _atomize(doc: SourceDocument) -> None:
    x = await llm.extract(llm.ExtractedGuideline, llm.GUIDELINE_PROMPT, doc)
    guideline_id = uuid.uuid4().hex
    strength, strength_system = _sanitize_strength(x.strength, x.strength_system)
    g = Guideline(
        guideline_id=guideline_id,
        source_key=doc.source_key,
        document_id=doc.document_id,
        title=x.title,
        criteria=_criteria(GuidelineCriterion, guideline_id, x.criteria),
        published=x.published or doc.retrieved_at.date(),
        version=x.version,
        strength=strength,
        strength_system=strength_system,
    )
    await db.save_guideline(g, await llm.embed([c.text for c in g.criteria]))


async def _parse_cpb(doc: SourceDocument) -> None:
    x = await llm.extract(llm.ExtractedPolicy, llm.POLICY_PROMPT, doc)
    markdown = parser.extract_markdown(storage.get(doc.storage_uri), doc.media_type)
    p = Policy(
        policy_number=x.policy_number,
        doc_type=x.doc_type,
        title=x.title,
        criteria=_criteria(PolicyCriterion, x.policy_number, x.criteria),
        codes=_merge_codes(x.codes, parser.extract_codes_regex(markdown)),
        coverage_effect=x.coverage_effect,
        effective_date=x.effective_date or doc.retrieved_at.date(),
        last_reviewed=x.last_reviewed,
        document_id=doc.document_id,
    )
    await db.save_policy(p, await llm.embed([c.text for c in p.criteria]))


async def _each(docs: list[SourceDocument], step) -> dict:
    """Run ``step`` on every document, collecting per-document failures."""
    failed = []
    for doc in docs:
        try:
            await step(doc)
        except Exception as e:  # noqa: BLE001 — one bad document must not stop the batch
            failed.append({"document_id": doc.document_id, "error": f"{type(e).__name__}: {e}"})
    return {"processed": len(docs) - len(failed), "failed": failed}


async def atomize_pending() -> dict:
    """Atomize every stored guideline document that has no Guideline yet."""
    return await _each(await db.unatomized_documents(), _atomize)


async def parse_pending_cpbs() -> dict:
    """Parse every uploaded CPB document that has no Policy yet."""
    return await _each(await db.unparsed_cpbs(), _parse_cpb)


async def guideline_for_document(document_id: str) -> Guideline | None:
    """The guideline from one guideline document, atomizing it first if that has not run.
    None if ``document_id`` is not a stored guideline document."""
    doc = await db.get_source_document(document_id)
    if doc is None or doc.source_key == db.CPB_SOURCE_KEY:
        return None
    if await db.guideline_by_document(document_id) is None:
        await _atomize(doc)
    return await db.guideline_by_document(document_id)


async def policy_for_document(document_id: str) -> Policy | None:
    """The policy from one uploaded CPB document, parsing it first if that has not run.
    None if ``document_id`` is not a stored CPB document."""
    doc = await db.get_source_document(document_id)
    if doc is None or doc.source_key != db.CPB_SOURCE_KEY:
        return None
    if await db.policy_by_document(document_id) is None:
        await _parse_cpb(doc)
    return await db.policy_by_document(document_id)
