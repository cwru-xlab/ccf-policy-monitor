"""The three background pipelines: ingest guidelines, atomize guidelines, parse CPBs.

Each returns a small dict of counts that becomes the job's ``detail``. A failure on one
document is recorded and the run continues; only a failure of the whole run fails the job.
"""

import uuid
from datetime import UTC, date, datetime, timedelta

import httpx

from policy_radar import db, llm, storage
from policy_radar.models import (
    Code,
    Guideline,
    GuidelineCriterion,
    Policy,
    PolicyCriterion,
    SourceDocument,
)
from policy_radar.sources import SOURCES

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


async def _atomize(doc: SourceDocument) -> None:
    x = await llm.extract(llm.ExtractedGuideline, llm.GUIDELINE_PROMPT, doc)
    guideline_id = uuid.uuid4().hex
    g = Guideline(
        guideline_id=guideline_id,
        source_key=doc.source_key,
        document_id=doc.document_id,
        title=x.title,
        criteria=_criteria(GuidelineCriterion, guideline_id, x.criteria),
        published=x.published or doc.retrieved_at.date(),
        version=x.version,
        strength=x.strength,
        strength_system=x.strength_system,
    )
    await db.save_guideline(g, await llm.embed([c.text for c in g.criteria]))


async def _parse_cpb(doc: SourceDocument) -> None:
    x = await llm.extract(llm.ExtractedPolicy, llm.POLICY_PROMPT, doc)
    p = Policy(
        policy_number=x.policy_number,
        doc_type=x.doc_type,
        title=x.title,
        criteria=_criteria(PolicyCriterion, x.policy_number, x.criteria),
        codes=tuple(Code(system=c.system, value=c.value) for c in x.codes),
        coverage_effect=x.coverage_effect,
        effective_date=x.effective_date,
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
