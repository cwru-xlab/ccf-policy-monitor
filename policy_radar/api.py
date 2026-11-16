"""FastAPI app. Run with:  uv run uvicorn policy_radar.api:app --reload

Pipelines run as FastAPI background tasks inside this process and report through the
``job`` table; a job still running when the process stops is left in ``running``.
"""

import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from datetime import date

from fastapi import BackgroundTasks, FastAPI, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from policy_radar import conflicts, db, mapping_api, pipelines, scheduler, storage
from policy_radar.enums import JobKind
from policy_radar.jobs import start as _start
from policy_radar.models import Source
from policy_radar.sources import SOURCES

log = logging.getLogger(__name__)

UPLOAD_MEDIA_TYPES = {
    "application/pdf",
    "text/html",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
CPB_MEDIA_TYPES = UPLOAD_MEDIA_TYPES


@asynccontextmanager
async def lifespan(_: FastAPI):
    await db.open_pool()
    schedule = asyncio.create_task(scheduler.loop())
    yield
    schedule.cancel()
    with suppress(asyncio.CancelledError):
        await schedule
    await db.close_pool()


app = FastAPI(title="Policy Radar", lifespan=lifespan)
app.include_router(mapping_api.router)


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


# --- guidelines ---------------------------------------------------------------


@app.get("/sources")
async def list_sources() -> list[Source]:
    """Guideline sources that can be ingested, with their authority and kind."""
    return [s for s in await db.list_sources() if s.source_key in SOURCES]


@app.post("/guidelines/ingest/{source_key}", status_code=202)
async def ingest(source_key: str, tasks: BackgroundTasks, since: date | None = None) -> dict:
    """Fetch new documents from one guideline source into source_document."""
    if source_key not in SOURCES:
        raise HTTPException(404, f"unknown source {source_key!r}; see GET /sources")
    detail = {"source_key": source_key, "since": since and since.isoformat()}
    return await _start(tasks, JobKind.INGEST, detail, pipelines.ingest(source_key, since))


@app.post("")
async def ingest_all_guidelines(tasks: BackgroundTasks):
    """Fetch all"""


@app.post("/guidelines/documents", status_code=201)
async def upload_guidelines(
    files: list[UploadFile], source_key: str = db.GUIDELINE_UPLOAD_SOURCE_KEY
) -> dict:
    """Store uploaded guideline files as source documents. Atomize with POST /guidelines/atomize."""
    if source_key == db.CPB_SOURCE_KEY:
        raise HTTPException(400, "use POST /policies/documents for CPB uploads")
    known = {s.source_key for s in await db.list_sources()}
    if source_key != db.GUIDELINE_UPLOAD_SOURCE_KEY and source_key not in known:
        raise HTTPException(404, f"unknown source {source_key!r}")
    stored, duplicates = [], []
    for f in files:
        media_type = (f.content_type or "").split(";")[0]
        if media_type not in UPLOAD_MEDIA_TYPES:
            raise HTTPException(415, f"{f.filename}: expected one of {sorted(UPLOAD_MEDIA_TYPES)}")
        content = await f.read()
        doc = await pipelines.store_document(source_key, content, media_type, origin_url=None)
        if doc:
            stored.append(doc.document_id)
        else:
            _, sha = storage.object_key(source_key, content, media_type)
            duplicates.append(f"{source_key}-{sha[:16]}")
        print(
            f"Guideline stored: {f.filename}. Upload does not run LLM extraction; "
            "POST /guidelines/atomize starts extraction and prints its structured output.",
            flush=True,
        )
    return {"stored": stored, "duplicates": duplicates}


@app.post("/guidelines/atomize", status_code=202)
async def atomize(tasks: BackgroundTasks) -> dict:
    """Atomize every ingested guideline document not yet atomized."""
    return await _start(tasks, JobKind.ATOMIZE, {}, pipelines.atomize_pending())


@app.get("/guidelines")
async def list_guidelines() -> list[dict]:
    return await db.list_guidelines()


@app.get("/guidelines/documents/{document_id}")
async def view_guideline_document(document_id: str):
    """Return the stored guideline PDF, without requiring atomization."""
    doc = await db.get_source_document(document_id)
    if doc is None or doc.source_key == db.CPB_SOURCE_KEY:
        raise HTTPException(404, "guideline document not found")
    if doc.media_type != "application/pdf":
        raise HTTPException(415, "In-app preview is available for PDF documents only.")
    try:
        content = storage.get(doc.storage_uri)
    except FileNotFoundError:
        raise HTTPException(404, "guideline document file not found") from None
    return Response(content, media_type="application/pdf", headers={
        "Content-Disposition": 'inline; filename="guideline.pdf"',
        "X-Content-Type-Options": "nosniff",
    })


@app.get("/guidelines/{guideline_id}")
async def get_guideline(guideline_id: str):
    g = await db.get_guideline(guideline_id)
    if g is None:
        raise HTTPException(404, "guideline not found")
    return g


# --- policies -------------------------------------------------------------------


@app.post("/policies/documents", status_code=201)
async def upload_policies(files: list[UploadFile]) -> dict:
    """Store uploaded CPB files as source documents. Parse them with POST /policies/parse.

    Both lists hold document ids, so a re-uploaded file can be found and re-parsed."""
    stored, duplicates = [], []
    for f in files:
        media_type = (f.content_type or "").split(";")[0]
        if media_type not in UPLOAD_MEDIA_TYPES:
            raise HTTPException(415, f"{f.filename}: expected one of {sorted(UPLOAD_MEDIA_TYPES)}")
        content = await f.read()
        doc = await pipelines.store_document(db.CPB_SOURCE_KEY, content, media_type, origin_url=None)
        if doc:
            stored.append(doc.document_id)
            print(f"Policy uploaded: {doc.document_id}; awaiting LLM parsing.", flush=True)
        else:
            _, sha = storage.object_key(db.CPB_SOURCE_KEY, content, media_type)
            document_id = f"{db.CPB_SOURCE_KEY}-{sha[:16]}"
            duplicates.append(document_id)
            existing = next(
                (p for p in await db.list_policies() if p["document_id"] == document_id),
                None,
            )
            if existing:
                policy = await db.get_policy(existing["policy_number"])
                if policy is not None:
                    print(
                        f"\n--- Cached structured policy output: {document_id} ---\n"
                        f"{policy.model_dump_json(indent=2)}\n"
                        "--- End cached output (no new LLM call) ---",
                        flush=True,
                    )
    return {"stored": stored, "duplicates": duplicates}


@app.post("/policies/parse", status_code=202)
async def parse(tasks: BackgroundTasks) -> dict:
    """Parse every uploaded CPB not yet parsed into a Policy."""
    return await _start(tasks, JobKind.PARSE_CPB, {}, pipelines.parse_pending_cpbs())


@app.get("/policies/documents/{document_id}")
async def view_policy_document(document_id: str):
    """Return an uploaded policy PDF, independently of its parse status."""
    doc = await db.get_source_document(document_id)
    if doc is None or doc.source_key != db.CPB_SOURCE_KEY:
        raise HTTPException(404, "policy document not found")
    if doc.media_type != "application/pdf":
        raise HTTPException(415, "In-app preview is available for PDF documents only.")
    try:
        content = storage.get(doc.storage_uri)
    except FileNotFoundError:
        raise HTTPException(404, "policy document file not found") from None
    return Response(content, media_type="application/pdf", headers={
        "Content-Disposition": 'inline; filename="policy.pdf"',
        "X-Content-Type-Options": "nosniff",
    })


@app.get("/policies")
async def list_policies() -> list[dict]:
    return await db.list_policies()


@app.get("/policies/{policy_number}")
async def get_policy(policy_number: str):
    p = await db.get_policy(policy_number)
    if p is None:
        raise HTTPException(404, "policy not found")
    return p


# --- conflicts ------------------------------------------------------------------


class ConflictCheck(BaseModel):
    """One guideline and the policies the user linked to it, by stored document id (the id
    both upload endpoints return, and the one the frontend keeps)."""

    guideline_document_id: str = Field(min_length=1)
    policy_document_ids: list[str] = Field(min_length=1)


@app.post("/conflicts")
async def check_conflicts(req: ConflictCheck) -> list[conflicts.ConflictReport]:
    """Check each linked policy against the guideline and return (and store) its conflicts.

    Runs synchronously: one LLM call per policy, in parallel. A document not yet atomized or
    parsed is extracted first. Only the policies named here are ever compared."""
    try:
        guideline = await pipelines.guideline_for_document(req.guideline_document_id)
        if guideline is None:
            raise HTTPException(404, f"guideline document {req.guideline_document_id!r} not found")
        policies = []
        for document_id in dict.fromkeys(req.policy_document_ids):
            policy = await pipelines.policy_for_document(document_id)
            if policy is None:
                raise HTTPException(404, f"policy document {document_id!r} not found")
            policies.append(policy)
        return await asyncio.gather(*(conflicts.check(guideline, p) for p in policies))
    except HTTPException:
        raise
    except Exception as e:
        log.exception("conflict check failed")
        raise HTTPException(502, f"conflict check failed: {type(e).__name__}: {e}") from e


# --- jobs -------------------------------------------------------------------------


@app.get("/jobs/{job_id}")
async def get_job(job_id: str) -> dict:
    job = await db.get_job(job_id)
    if job is None:
        raise HTTPException(404, "job not found")
    return job
