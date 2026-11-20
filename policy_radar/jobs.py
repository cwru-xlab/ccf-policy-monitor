"""Background jobs: run one pipeline coroutine and record its outcome on a ``job`` row.

Jobs run in the API process (FastAPI background tasks or the scheduler); a job still running
when the process stops is left in ``running``.

A running job may report ``detail.progress`` (``phase``, ``label``, ``percent``, ``ceiling``).
``report`` is a no-op outside ``run``, so pipelines can call it unconditionally. ``percent``
is the floor already reached and ``ceiling`` is how far the UI may drift before the next
real step. Nested work uses ``span`` to map a 0–100 report into a slice of the job.
"""

import logging
from contextlib import asynccontextmanager, contextmanager
from contextvars import ContextVar
from dataclasses import dataclass

from fastapi import BackgroundTasks

from policy_radar import db
from policy_radar.enums import JobKind, JobStatus

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class _Band:
    """Maps a nested 0–100 report into this slice of the job (both ends are 0–100)."""

    lo: float = 0
    hi: float = 100


class _Reporter:
    def __init__(self, job_id: str):
        self.job_id = job_id

    async def update(self, phase: str, label: str, percent: float, ceiling: float) -> None:
        band = _current_band()
        width = band.hi - band.lo
        floor = _clamp(band.lo + width * percent / 100)
        cap = max(_clamp(band.lo + width * ceiling / 100), floor)
        await db.set_job(
            self.job_id,
            JobStatus.RUNNING,
            {
                "progress": {
                    "phase": phase,
                    "label": label,
                    "percent": floor,
                    "ceiling": cap,
                }
            },
        )


def _clamp(value: float) -> int:
    return max(0, min(100, round(value)))


def _current_band() -> _Band:
    return _band.get() or _Band()


_reporter: ContextVar[_Reporter | None] = ContextVar("job_progress", default=None)
_band: ContextVar[_Band | None] = ContextVar("job_progress_band", default=None)


@contextmanager
def activate(job_id: str):
    """Install the progress reporter for ``job_id`` on this task."""
    reporter_token = _reporter.set(_Reporter(job_id))
    band_token = _band.set(_Band())
    try:
        yield
    finally:
        _reporter.reset(reporter_token)
        _band.reset(band_token)


async def report(phase: str, label: str, percent: float, ceiling: float) -> None:
    """Record one progress step on the current job. No-op when no job is active."""
    reporter = _reporter.get()
    if reporter is None:
        return
    await reporter.update(phase, label, percent, ceiling)


@asynccontextmanager
async def span(start: float, end: float):
    """Map nested 0–100 reports into ``start``–``end`` percent of the current band."""
    parent = _current_band()
    width = parent.hi - parent.lo
    token = _band.set(
        _Band(parent.lo + width * start / 100, parent.lo + width * end / 100)
    )
    try:
        yield
    finally:
        _band.reset(token)


async def run(job_id: str, work) -> None:
    """Await ``work`` and store its result dict (or its error) on the job."""
    with activate(job_id):
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
