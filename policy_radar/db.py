"""Postgres access: plain SQL over one asyncpg pool. Tables are defined in db/schema.sql."""

import json
import uuid
from datetime import datetime

import asyncpg
from pgvector.asyncpg import register_vector

from policy_radar.config import settings
from policy_radar.enums import JobKind, JobStatus, MappingOrigin, MappingStatus
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
WEB_DISCOVERY_SOURCE_KEY = "web_discovery"  # snapshots of tracked guideline URLs

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


# --- mapping engine (docs/MAPPING_ENGINE_SPEC.md) ------------------------------------

_MAPPING_SELECT = """select m.source_id, m.policy_document_id, m.rationale, m.origin, m.status,
        m.proposed_at, m.decided_at, s.url, s.title, s.authority_id, s.document_id,
        a.name as authority_name
    from source_mapping m join tracked_source s using (source_id)
    left join authority a using (authority_id)"""


async def known_urls(policy_document_id: str) -> set[str]:
    """URLs already proposed, mapped or rejected for one policy: never proposed again."""
    rows = await pool().fetch(
        """select s.url from source_mapping m join tracked_source s using (source_id)
           where m.policy_document_id = $1""",
        policy_document_id,
    )
    return {r["url"] for r in rows}


async def add_authority(authority_id: str, name: str, homepage_url: str, rationale: str) -> None:
    """Propose an authority; one already known keeps its row and status."""
    await pool().execute(
        """insert into authority (authority_id, name, homepage_url, rationale)
           values ($1, $2, $3, $4) on conflict do nothing""",
        authority_id, name, homepage_url, rationale,
    )


async def list_authorities() -> list[dict]:
    rows = await pool().fetch("select * from authority order by status, name")
    return [dict(r) for r in rows]


async def decide_authority(authority_id: str, status: MappingStatus) -> bool:
    """Set an authority's status; False if there is no such authority."""
    done = await pool().execute(
        "update authority set status = $2, decided_at = now() where authority_id = $1",
        authority_id, status,
    )
    return done != "UPDATE 0"


async def approved_authority_domains() -> list[str]:
    rows = await pool().fetch("select authority_id from authority where status = 'approved'")
    return [r["authority_id"] for r in rows]


async def add_source(source_id: str, url: str, title: str, authority_id: str | None) -> None:
    """Create a tracked_source row for ``url`` unless one exists."""
    await pool().execute(
        """insert into tracked_source (source_id, url, title, authority_id)
           values ($1, $2, $3, (select authority_id from authority where authority_id = $4))
           on conflict do nothing""",
        source_id, url, title, authority_id,
    )


async def propose_mapping(
    source_id: str, policy_document_id: str, rationale: str, origin: MappingOrigin,
    status: MappingStatus = MappingStatus.PROPOSED,
) -> bool:
    """Record a (source, policy) mapping; False if the pair already exists."""
    row = await pool().fetchval(
        """insert into source_mapping (source_id, policy_document_id, rationale, origin, status,
               decided_at)
           values ($1, $2, $3, $4, $5, case when $5 = 'proposed' then null else now() end)
           on conflict do nothing returning source_id""",
        source_id, policy_document_id, rationale, origin, status,
    )
    return row is not None


async def list_mappings(
    status: MappingStatus | None = None, policy_document_id: str | None = None
) -> list[dict]:
    rows = await pool().fetch(
        f"""{_MAPPING_SELECT}
            where ($1::text is null or m.status = $1)
              and ($2::text is null or m.policy_document_id = $2)
            order by m.proposed_at desc""",
        status, policy_document_id,
    )
    return [dict(r) for r in rows]


async def get_mapping(source_id: str, policy_document_id: str) -> dict | None:
    row = await pool().fetchrow(
        f"{_MAPPING_SELECT} where m.source_id = $1 and m.policy_document_id = $2",
        source_id, policy_document_id,
    )
    return dict(row) if row else None


async def decide_mapping(source_id: str, policy_document_id: str, status: MappingStatus) -> None:
    await pool().execute(
        """update source_mapping set status = $3, decided_at = now()
           where source_id = $1 and policy_document_id = $2""",
        source_id, policy_document_id, status,
    )


async def get_source(source_id: str) -> dict | None:
    row = await pool().fetchrow("select * from tracked_source where source_id = $1", source_id)
    return dict(row) if row else None


async def tracked_sources(include_paused: bool = True) -> list[dict]:
    """Sources with at least one approved mapping, with the policies they map to."""
    rows = await pool().fetch(
        """select s.*, a.name as authority_name,
                  array_agg(m.policy_document_id order by m.policy_document_id)
                      as policy_document_ids
           from tracked_source s join source_mapping m using (source_id)
           left join authority a using (authority_id)
           where m.status = 'approved' and ($1 or not s.paused)
           group by s.source_id, a.name order by s.title""",
        include_paused,
    )
    return [dict(r) for r in rows]


async def set_snapshot(source_id: str, sha: str, document_id: str, changed: bool) -> None:
    """Make ``document_id`` the source's current snapshot and mark it checked."""
    await pool().execute(
        """update tracked_source set content_sha256 = $2, document_id = $3,
               last_checked_at = now(),
               last_changed_at = case when $4 then now() else last_changed_at end
           where source_id = $1""",
        source_id, sha, document_id, changed,
    )


async def mark_checked(source_id: str) -> None:
    await pool().execute(
        "update tracked_source set last_checked_at = now() where source_id = $1", source_id
    )


async def set_paused(source_id: str, paused: bool) -> bool:
    done = await pool().execute(
        "update tracked_source set paused = $2 where source_id = $1", source_id, paused
    )
    return done != "UPDATE 0"


async def untrack(source_id: str) -> int:
    """Reject every open or approved mapping of a source, so it is neither tracked nor
    proposed again. Returns how many mappings changed."""
    done = await pool().execute(
        """update source_mapping set status = 'rejected', decided_at = now()
           where source_id = $1 and status <> 'rejected'""",
        source_id,
    )
    return int(done.split()[-1])


async def record_change(
    source_id: str, previous_document_id: str | None, document_id: str, summary: str
) -> int:
    return await pool().fetchval(
        """insert into guideline_change (source_id, previous_document_id, document_id, summary)
           values ($1, $2, $3, $4) returning change_id""",
        source_id, previous_document_id, document_id, summary,
    )


async def list_changes(unread_only: bool = False) -> list[dict]:
    rows = await pool().fetch(
        """select c.*, s.url, s.title from guideline_change c join tracked_source s using (source_id)
           where not $1 or c.read_at is null order by c.detected_at desc""",
        unread_only,
    )
    return [dict(r) for r in rows]


async def mark_change_read(change_id: int) -> bool:
    done = await pool().execute(
        "update guideline_change set read_at = coalesce(read_at, now()) where change_id = $1",
        change_id,
    )
    return done != "UPDATE 0"


async def discovered_policies() -> list[str]:
    """Policies that have been through discovery (have any mapping row)."""
    rows = await pool().fetch(
        "select distinct policy_document_id from source_mapping order by 1"
    )
    return [r["policy_document_id"] for r in rows]


async def get_schedule() -> dict:
    return dict(await pool().fetchrow("select * from discovery_schedule"))


async def set_schedule(enabled: bool, interval_hours: int) -> dict:
    """Save the schedule; the next run is one interval from now when enabled."""
    row = await pool().fetchrow(
        """update discovery_schedule set enabled = $1, interval_hours = $2,
               next_run_at = case when $1 then now() + make_interval(hours => $2) end
           returning *""",
        enabled, interval_hours,
    )
    return dict(row)


async def claim_scheduled_run() -> bool:
    """Atomically claim a due scheduled run, so concurrent schedulers run it once."""
    row = await pool().fetchrow(
        """update discovery_schedule set last_run_at = now(),
               next_run_at = now() + make_interval(hours => interval_hours)
           where enabled and next_run_at <= now() returning id"""
    )
    return row is not None


async def mark_manual_run() -> None:
    await pool().execute("update discovery_schedule set last_run_at = now()")


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
