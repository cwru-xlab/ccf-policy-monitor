"""The mapping engine's routes under /mapping (docs/MAPPING_ENGINE_SPEC.md § API)."""

import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from policy_radar import db, discovery, firecrawl, scheduler, tracking
from policy_radar.enums import JobKind, MappingStatus
from policy_radar.jobs import start

log = logging.getLogger(__name__)

router = APIRouter(prefix="/mapping", tags=["mapping"])


def _require_firecrawl() -> None:
    if not firecrawl.configured():
        raise HTTPException(503, "FIRECRAWL_API_KEY is not set; the mapping engine cannot search")


async def _require_policy(policy_document_id: str) -> None:
    doc = await db.get_source_document(policy_document_id)
    if doc is None or doc.source_key != db.CPB_SOURCE_KEY:
        raise HTTPException(404, f"policy document {policy_document_id!r} not found")


class PolicyRef(BaseModel):
    policy_document_id: str = Field(min_length=1)


class Decision(BaseModel):
    status: MappingStatus


class MappingDecision(PolicyRef):
    source_id: str = Field(min_length=1)
    status: MappingStatus


class NewSource(PolicyRef):
    url: str = Field(pattern=r"^https?://\S+$")


class SourcePatch(BaseModel):
    paused: bool


class Schedule(BaseModel):
    enabled: bool
    interval_hours: int = Field(ge=1, le=8760)


# --- discovery and proposals ------------------------------------------------------


@router.post("/discover", status_code=202)
async def discover(req: PolicyRef, tasks: BackgroundTasks) -> dict:
    """Start the discovery agent for one uploaded policy."""
    _require_firecrawl()
    await _require_policy(req.policy_document_id)
    return await start(tasks, JobKind.DISCOVER, req.model_dump(),
                       discovery.discover(req.policy_document_id))


@router.get("/proposals")
async def list_proposals(
    status: MappingStatus | None = None, policy_document_id: str | None = None
) -> list[dict]:
    return await db.list_mappings(status, policy_document_id)


@router.post("/proposals/decide")
async def decide_proposal(req: MappingDecision) -> dict:
    """Approve (snapshotting the guideline on first approval) or reject one mapping."""
    if await db.get_mapping(req.source_id, req.policy_document_id) is None:
        raise HTTPException(404, "no such proposal")
    if req.status == MappingStatus.APPROVED:
        _require_firecrawl()
        try:
            return await tracking.approve(req.source_id, req.policy_document_id)
        except firecrawl.FirecrawlError as e:
            raise HTTPException(502, f"could not fetch the guideline: {e}") from e
    await db.decide_mapping(req.source_id, req.policy_document_id, req.status)
    return await db.get_mapping(req.source_id, req.policy_document_id)


# --- authorities ----------------------------------------------------------------------


@router.get("/authorities")
async def list_authorities() -> list[dict]:
    return await db.list_authorities()


@router.post("/authorities/{authority_id}/decide")
async def decide_authority(authority_id: str, req: Decision) -> dict:
    if not await db.decide_authority(authority_id, req.status):
        raise HTTPException(404, "authority not found")
    return {"authority_id": authority_id, "status": req.status}


# --- tracked sources and updates -------------------------------------------------


@router.get("/sources")
async def list_sources() -> list[dict]:
    return await db.tracked_sources()


@router.post("/sources", status_code=201)
async def add_source(req: NewSource) -> dict:
    """Track a URL for a policy by hand; it is fetched now and approved at once."""
    _require_firecrawl()
    await _require_policy(req.policy_document_id)
    try:
        return await tracking.add_manual(req.url, req.policy_document_id)
    except firecrawl.FirecrawlError as e:
        raise HTTPException(502, f"could not fetch {req.url}: {e}") from e


@router.patch("/sources/{source_id}")
async def pause_source(source_id: str, req: SourcePatch) -> dict:
    if not await db.set_paused(source_id, req.paused):
        raise HTTPException(404, "source not found")
    return {"source_id": source_id, "paused": req.paused}


@router.delete("/sources/{source_id}")
async def untrack_source(source_id: str) -> dict:
    """Stop tracking a source: its mappings become rejected and it is not proposed again."""
    if await db.get_source(source_id) is None:
        raise HTTPException(404, "source not found")
    return {"source_id": source_id, "mappings_rejected": await db.untrack(source_id)}


@router.post("/check-updates", status_code=202)
async def check_updates(tasks: BackgroundTasks) -> dict:
    _require_firecrawl()
    return await start(tasks, JobKind.CHECK_UPDATES, {}, tracking.check_updates())


@router.get("/changes")
async def list_changes(unread_only: bool = False) -> list[dict]:
    return await db.list_changes(unread_only)


@router.post("/changes/{change_id}/read")
async def read_change(change_id: int) -> dict:
    if not await db.mark_change_read(change_id):
        raise HTTPException(404, "change not found")
    return {"change_id": change_id}


# --- schedule ------------------------------------------------------------------------


@router.get("/schedule")
async def get_schedule() -> dict:
    return {**await db.get_schedule(), "firecrawl_configured": firecrawl.configured()}


@router.put("/schedule")
async def set_schedule(req: Schedule) -> dict:
    return await db.set_schedule(req.enabled, req.interval_hours)


@router.post("/schedule/run", status_code=202)
async def run_schedule_now(tasks: BackgroundTasks) -> dict:
    """Run the scheduled job now, whether or not the schedule is enabled."""
    _require_firecrawl()
    await db.mark_manual_run()
    return await start(tasks, JobKind.SCHEDULED_RUN, {"trigger": "manual"},
                       scheduler.scheduled_run())
