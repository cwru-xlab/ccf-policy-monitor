"""Background jobs: run one pipeline coroutine and record its outcome on a ``job`` row.

Jobs run in the API process (FastAPI background tasks or the scheduler); a job still running
when the process stops is left in ``running``.
"""

import logging

from fastapi import BackgroundTasks

from policy_radar import db
from policy_radar.enums import JobKind, JobStatus

log = logging.getLogger(__name__)


async def run(job_id: str, work) -> None:
    """Await ``work`` and store its result dict (or its error) on the job."""
    await db.set_job(job_id, JobStatus.RUNNING)
    try:
        await db.set_job(job_id, JobStatus.SUCCEEDED, await work)
    except Exception as e:
        log.exception("job %s failed", job_id)
        await db.set_job(job_id, JobStatus.FAILED, error=f"{type(e).__name__}: {e}")


async def start(tasks: BackgroundTasks, kind: JobKind, detail: dict, work) -> dict:
    """Create a job row and run ``work`` after the response is sent."""
    job_id = await db.create_job(kind, detail)
    tasks.add_task(run, job_id, work)
    return {"job_id": job_id}
