"""Postgres access: plain SQL over one asyncpg pool. Tables are defined in db/schema.sql."""

import json
import uuid
from datetime import datetime

import asyncpg
from pgvector.asyncpg import register_vector

from policy_radar.config import settings
from policy_radar.enums import JobKind, JobStatus
from policy_radar.models import (
    Code,
    CriterionConflict,
    Guideline,
    GuidelineCriterion,
    Policy,
    PolicyCriterion,
    Source,
    SourceDocument,
)

CPB_SOURCE_KEY = "cpb_upload"
GUIDELINE_UPLOAD_SOURCE_KEY = "guideline_upload"

_pool: asyncpg.Pool | None = None


async def open_pool() -> None:
    """Create the pool. Called once at API startup."""
    global _pool
    _pool = await asyncpg.create_pool(settings.database_url, init=register_vector)


async def close_pool() -> None:
    if _pool is not None:
        await _pool.close()


def pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("database pool is not open")
    return _pool


# --- sources and source documents ------------------------------------------------


async def list_sources() -> list[Source]:
    """Every source row, seeded by db/schema.sql."""
    rows = await pool().fetch("select * from source order by source_key")
    return [Source(**dict(r)) for r in rows]


async def insert_source_document(doc: SourceDocument) -> bool:
    """Insert ``doc``; return False if the same bytes from the same source already exist."""
    row = await pool().fetchval(
        """insert into source_document (document_id, source_key, retrieved_at, storage_uri,
               content_sha256, media_type, origin_url)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict do nothing returning document_id""",
        doc.document_id, doc.source_key, doc.retrieved_at, doc.storage_uri,
        doc.content_sha256, doc.media_type, doc.origin_url,
    )
    return row is not None


async def last_retrieved(source_key: str) -> datetime | None:
    """When ``source_key`` last produced a new document."""
    return await pool().fetchval(
        "select max(retrieved_at) from source_document where source_key = $1", source_key
    )


async def get_source_document(document_id: str) -> SourceDocument | None:
    row = await pool().fetchrow(
        "select * from source_document where document_id = $1", document_id
    )
    return SourceDocument(**dict(row)) if row else None


async def unatomized_documents() -> list[SourceDocument]:
    """Guideline-source documents that have no guideline yet."""
    rows = await pool().fetch(
        """select d.* from source_document d
           where d.source_key <> $1
             and not exists (select 1 from guideline g where g.document_id = d.document_id)
           order by d.retrieved_at""",
        CPB_SOURCE_KEY,
    )
    return [SourceDocument(**dict(r)) for r in rows]


async def unparsed_cpbs() -> list[SourceDocument]:
    """Uploaded CPB documents that no policy has been parsed from yet."""
    rows = await pool().fetch(
        """select d.* from source_document d
           where d.source_key = $1
             and not exists (select 1 from policy p where p.document_id = d.document_id)
           order by d.retrieved_at""",
        CPB_SOURCE_KEY,
    )
    return [SourceDocument(**dict(r)) for r in rows]


# --- guidelines and policies ----------------------------------------------------

def _insert_criterion(table: str) -> str:
    return f"""insert into {table} (criterion_id, parent_id, position, text, concept_words,
        embedding) values ($1, $2, $3, $4, $5, $6)"""


async def save_guideline(g: Guideline, embeddings: list[list[float]]) -> None:
    """Insert ``g`` and its criteria, replacing any guideline from the same document."""
    async with pool().acquire() as conn, conn.transaction():
        await conn.execute("delete from guideline where document_id = $1", g.document_id)
        await conn.execute(
            """insert into guideline (guideline_id, source_key, document_id, title, published,
                   version, strength, strength_system)
               values ($1, $2, $3, $4, $5, $6, $7, $8)""",
            g.guideline_id, g.source_key, g.document_id, g.title, g.published,
            g.version, g.strength, g.strength_system,
        )
        await conn.executemany(
            _insert_criterion("guideline_criterion"),
            [
                (c.criterion_id, g.guideline_id, i, c.text, list(c.concept_words), e)
                for i, (c, e) in enumerate(zip(g.criteria, embeddings, strict=True), 1)
            ],
        )


async def save_policy(p: Policy, embeddings: list[list[float]]) -> None:
    """Insert ``p`` with its criteria and codes, replacing any policy with the same number."""
    async with pool().acquire() as conn, conn.transaction():
        await conn.execute("delete from policy where policy_number = $1", p.policy_number)
        await conn.execute(
            """insert into policy (policy_number, doc_type, title, coverage_effect,
                   effective_date, last_reviewed, document_id)
               values ($1, $2, $3, $4, $5, $6, $7)""",
            p.policy_number, p.doc_type, p.title, p.coverage_effect,
            p.effective_date, p.last_reviewed, p.document_id,
        )
        await conn.executemany(
            _insert_criterion("policy_criterion"),
            [
                (c.criterion_id, p.policy_number, i, c.text, list(c.concept_words), e)
                for i, (c, e) in enumerate(zip(p.criteria, embeddings, strict=True), 1)
            ],
        )
        await conn.executemany(
            "insert into code (policy_number, system, value) values ($1, $2, $3) "
            "on conflict do nothing",
            [(p.policy_number, c.system, c.value) for c in p.codes],
        )


async def _criteria[C: (GuidelineCriterion, PolicyCriterion)](
    model: type[C], table: str, parent_id: str
) -> tuple[C, ...]:
    """Criteria of one guideline or policy, with ``needs_update`` derived from the pending
    updates in the matching ``{table}_update`` history table."""
    rows = await pool().fetch(
        f"""select c.criterion_id, c.parent_id, c.text, c.concept_words,
                   exists (select 1 from {table}_update u where u.criterion_id = c.criterion_id
                           and u.status = 'pending') as needs_update
            from {table} c where c.parent_id = $1 order by c.position""",
        parent_id,
    )
    return tuple(model(**dict(r)) for r in rows)


async def list_guidelines() -> list[dict]:
    rows = await pool().fetch(
        "select guideline_id, source_key, title, published from guideline order by published desc"
    )
    return [dict(r) for r in rows]


async def get_guideline(guideline_id: str) -> Guideline | None:
    row = await pool().fetchrow("select * from guideline where guideline_id = $1", guideline_id)
    if row is None:
        return None
    return Guideline(**dict(row), criteria=await _criteria(GuidelineCriterion, "guideline_criterion", guideline_id))


async def list_policies() -> list[dict]:
    rows = await pool().fetch(
        "select policy_number, doc_type, title, effective_date, document_id from policy"
        " order by policy_number"
    )
    return [dict(r) for r in rows]


async def get_policy(policy_number: str) -> Policy | None:
    row = await pool().fetchrow("select * from policy where policy_number = $1", policy_number)
    if row is None:
        return None
    codes = await pool().fetch(
        "select system, value from code where policy_number = $1", policy_number
    )
    return Policy(
        **dict(row),
        criteria=await _criteria(PolicyCriterion, "policy_criterion", policy_number),
        codes=tuple(Code(**dict(c)) for c in codes),
    )


async def guideline_by_document(document_id: str) -> Guideline | None:
    """The guideline atomized from ``document_id``, if any."""
    guideline_id = await pool().fetchval(
        "select guideline_id from guideline where document_id = $1", document_id
    )
    return guideline_id and await get_guideline(guideline_id)


async def policy_by_document(document_id: str) -> Policy | None:
    """The policy parsed from ``document_id``, if any."""
    policy_number = await pool().fetchval(
        "select policy_number from policy where document_id = $1", document_id
    )
    return policy_number and await get_policy(policy_number)


# --- conflicts -------------------------------------------------------------------


async def save_conflicts(
    guideline_id: str, policy_number: str, conflicts: list[CriterionConflict]
) -> None:
    """Replace the stored conflicts of one (guideline, policy) pair."""
    async with pool().acquire() as conn, conn.transaction():
        await conn.execute(
            """delete from criterion_conflict
               where policy_number = $1 and guideline_criterion_id in (
                   select criterion_id from guideline_criterion where parent_id = $2)""",
            policy_number, guideline_id,
        )
        await conn.executemany(
            """insert into criterion_conflict (guideline_criterion_id, policy_number,
                   policy_criterion_id, category, explanation, guideline_quote, policy_quote,
                   model, checked_at)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
            [
                (c.guideline_criterion_id, c.policy_number, c.policy_criterion_id, c.category,
                 c.explanation, c.guideline_quote, c.policy_quote, c.model, c.checked_at)
                for c in conflicts
            ],
        )


# --- jobs ----------------------------------------------------------------------


async def create_job(kind: JobKind, detail: dict) -> str:
    job_id = uuid.uuid4().hex
    await pool().execute(
        "insert into job (job_id, kind, detail) values ($1, $2, $3)",
        job_id, kind, json.dumps(detail),
    )
    return job_id


async def set_job(job_id: str, status: JobStatus, detail: dict | None = None,
                  error: str | None = None) -> None:
    """Move a job to ``status``, merging ``detail`` into its stored detail."""
    await pool().execute(
        """update job set status = $2, detail = detail || $3::jsonb, error = $4,
               finished_at = case when $2 in ('succeeded', 'failed') then now() end
           where job_id = $1""",
        job_id, status, json.dumps(detail or {}), error,
    )


async def get_job(job_id: str) -> dict | None:
    row = await pool().fetchrow("select * from job where job_id = $1", job_id)
    if row is None:
        return None
    return {**dict(row), "detail": json.loads(row["detail"])}
