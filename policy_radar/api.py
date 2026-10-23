"""FastAPI app. Run with:  uv run uvicorn policy_radar.api:app --reload

Pipelines run as FastAPI background tasks inside this process and report through the
``job`` table; a job still running when the process stops is left in ``running``.
"""

import logging
from contextlib import asynccontextmanager
from datetime import date

from fastapi import BackgroundTasks, FastAPI, HTTPException, UploadFile

from policy_radar import db, parsing, pipelines
from policy_radar.enums import JobKind, JobStatus
from policy_radar.models import Source
from policy_radar.sources import SOURCES

log = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(_: FastAPI):
    await db.open_pool()
    yield
    await db.close_pool()


app = FastAPI(title="Policy Radar", lifespan=lifespan)


async def _run(job_id: str, work) -> None:
    """Run one pipeline coroutine and record its outcome on the job row."""
    await db.set_job(job_id, JobStatus.RUNNING)
    try:
        await db.set_job(job_id, JobStatus.SUCCEEDED, await work)
    except Exception as e:
        log.exception("job %s failed", job_id)
        await db.set_job(job_id, JobStatus.FAILED, error=f"{type(e).__name__}: {e}")


async def _start(tasks: BackgroundTasks, kind: JobKind, detail: dict, work) -> dict:
    job_id = await db.create_job(kind, detail)
    tasks.add_task(_run, job_id, work)
    return {"job_id": job_id}


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


@app.post("/guidelines/atomize", status_code=202)
async def atomize(tasks: BackgroundTasks) -> dict:
    """Atomize every ingested guideline document not yet atomized."""
    return await _start(tasks, JobKind.ATOMIZE, {}, pipelines.atomize_pending())


@app.get("/guidelines")
async def list_guidelines() -> list[dict]:
    return await db.list_guidelines()


@app.get("/guidelines/{guideline_id}")
async def get_guideline(guideline_id: str):
    g = await db.get_guideline(guideline_id)
    if g is None:
        raise HTTPException(404, "guideline not found")
    return g


# --- policies -------------------------------------------------------------------


async def _read_uploads(files: list[UploadFile]) -> list[parsing.Upload]:
    """Read and validate uploads. The bytes decide the format, not the declared type."""
    uploads = []
    for f in files:
        content = await f.read()
        name = f.filename or "upload"
        if len(content) > parsing.MAX_UPLOAD_BYTES:
            raise HTTPException(413, f"{name}: larger than {parsing.MAX_UPLOAD_BYTES // 2**20} MB")
        media_type = parsing.sniff_media_type(f.filename, f.content_type, content)
        if media_type is None:
            raise HTTPException(
                415, f"{name}: unsupported format; expected PDF, DOCX, HTML or plain text"
            )
        uploads.append(parsing.Upload(name, content, media_type))
    return uploads


@app.post("/policies/documents", status_code=201)
async def upload_policies(files: list[UploadFile]) -> dict:
    """Store uploaded CPB files as source documents. Parse them with POST /policies/parse."""
    stored, duplicates = [], []
    for u in await _read_uploads(files):
        doc = await pipelines.store_document(db.CPB_SOURCE_KEY, u.content, u.media_type, None)
        (stored if doc else duplicates).append(doc.document_id if doc else u.filename)
    return {"stored": stored, "duplicates": duplicates}


@app.post("/policies/ingest", status_code=202)
async def ingest_policies(files: list[UploadFile], tasks: BackgroundTasks) -> dict:
    """Upload PDF, DOCX, HTML or text policies and parse them into Policies in one background job."""
    uploads = await _read_uploads(files)
    detail = {"files": [u.filename for u in uploads]}
    return await _start(tasks, JobKind.PARSE_CPB, detail, pipelines.ingest_policy_files(uploads))


@app.post("/policies/parse", status_code=202)
async def parse(tasks: BackgroundTasks) -> dict:
    """Parse every uploaded CPB not yet parsed into a Policy."""
    return await _start(tasks, JobKind.PARSE_CPB, {}, pipelines.parse_pending_cpbs())


@app.get("/policies")
async def list_policies() -> list[dict]:
    return await db.list_policies()


@app.get("/policies/{policy_number}")
async def get_policy(policy_number: str):
    p = await db.get_policy(policy_number)
    if p is None:
        raise HTTPException(404, "policy not found")
    return p


# --- jobs -------------------------------------------------------------------------


@app.get("/jobs/{job_id}")
async def get_job(job_id: str) -> dict:
    job = await db.get_job(job_id)
    if job is None:
        raise HTTPException(404, "job not found")
    return job
