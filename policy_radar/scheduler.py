"""The scheduled mapping-engine run, and the loop that starts it when it is due.

One loop per API process polls ``discovery_schedule``; ``db.claim_scheduled_run`` claims a
due run atomically, so several processes (or ``--reload``) still run it once.
"""

import asyncio
import logging

from policy_radar import db, discovery, jobs, tracking
from policy_radar.config import settings
from policy_radar.enums import JobKind

log = logging.getLogger(__name__)


async def scheduled_run() -> dict:
    """Discovery for every policy that has been through discovery, then update detection."""
    runs, failed = [], []
    for policy_document_id in await db.discovered_policies():
        try:
            runs.append(await discovery.discover(policy_document_id, scheduled=True))
        except Exception as e:  # noqa: BLE001 — one policy must not stop the run
            failed.append({"policy_document_id": policy_document_id,
                           "error": f"{type(e).__name__}: {e}"})
    return {"discovery": runs, "discovery_failed": failed,
            "updates": await tracking.check_updates()}


async def _tick() -> None:
    if await db.claim_scheduled_run():
        job_id = await db.create_job(JobKind.SCHEDULED_RUN, {"trigger": "schedule"})
        await jobs.run(job_id, scheduled_run())


async def loop() -> None:
    """Poll forever; cancelled at API shutdown."""
    while True:
        try:
            await _tick()
        except Exception:  # keep polling after a database hiccup
            log.exception("scheduler tick failed")
        await asyncio.sleep(settings.scheduler_poll_seconds)
