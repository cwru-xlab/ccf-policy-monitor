"""The mapping engine end to end through the HTTP API, on a real Postgres.

Firecrawl, the discovery model and the change judge are faked; everything else (schema,
SQL, snapshots in object storage, jobs) is real. Skipped unless TEST_DATABASE_URL points at
a disposable database with pgvector available, e.g.

    TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/policy_radar uv run pytest
"""

import asyncio
import os
from datetime import date
from pathlib import Path

import asyncpg
import httpx
import pytest

from policy_radar import db, discovery, firecrawl, llm, tracking
from policy_radar.api import app
from policy_radar.config import settings
from policy_radar.models import Policy, PolicyCriterion, SourceDocument

DATABASE_URL = os.getenv("TEST_DATABASE_URL")
SCHEMA = (Path(__file__).parent.parent / "db" / "schema.sql").read_text()
POLICY_DOC = "cpb_upload-0000000000000001"
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="TEST_DATABASE_URL is not set")


@pytest.fixture
async def client(monkeypatch, tmp_path):
    conn = await asyncpg.connect(DATABASE_URL)
    await conn.execute("drop schema public cascade; create schema public")
    await conn.execute(SCHEMA)
    await conn.execute(SCHEMA)  # idempotent
    await conn.close()
    monkeypatch.setattr(settings, "database_url", DATABASE_URL)
    monkeypatch.setattr(settings, "storage_root", tmp_path)
    monkeypatch.setattr(settings, "firecrawl_api_key", "fc-test")
    await db.open_pool()
    await _seed_policy()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://t") as c:
        yield c
    await db.close_pool()


async def _seed_policy() -> None:
    await db.insert_source_document(SourceDocument(
        document_id=POLICY_DOC, source_key=db.CPB_SOURCE_KEY, retrieved_at="2026-11-01T00:00:00Z",
        storage_uri="cpb_upload/x.pdf", content_sha256="0" * 64, media_type="application/pdf",
    ))
    policy = Policy(
        policy_number="0516", doc_type="medical_clinical_policy_bulletin",
        title="Colorectal Cancer Screening", coverage_effect="covered",
        effective_date=date(2026, 1, 1), document_id=POLICY_DOC,
        criteria=(PolicyCriterion(criterion_id="0516:1", parent_id="0516",
                                  text="Colonoscopy every 10 years from age 50."),),
    )
    await db.save_policy(policy, [[0.0] * 1024])


class FakeWeb:
    """Firecrawl stand-in: fixed search results and editable page contents."""

    def __init__(self):
        self.pages = {
            "https://www.uspstf.org/crc": "# CRC\nScreen adults aged 45 to 75.\n",
            "https://www.cancer.org/crc-guideline": "# ACS\nStart at 45.\n",
        }
        self.searches = []

    async def search(self, query, recent=False, domains=None):
        self.searches.append((query, recent, domains))
        return [firecrawl.SearchResult(u, u, "") for u in self.pages]

    async def scrape(self, url):
        return firecrawl.Page(url, f"Title of {url}", self.pages[url], "text/html")


def _agent(*guideline_urls):
    """A discovery model that searches once, then proposes ``guideline_urls``."""
    def converse(messages):
        if len(messages) == 1:
            use = {"toolUseId": "s", "name": "search_web", "input": {"query": "crc"}}
        else:
            use = {"toolUseId": "f", "name": "submit_proposals", "input": {
                "authorities": [{"name": "USPSTF", "homepage_url": "https://www.uspstf.org/",
                                 "rationale": "Federal preventive recommendations."}],
                "guidelines": [{"url": u, "title": u, "rationale": "Same topic."}
                               for u in guideline_urls],
            }}
        return {"output": {"message": {"role": "assistant", "content": [{"toolUse": use}]}}}
    return converse


@pytest.fixture
def web(monkeypatch):
    fake = FakeWeb()
    monkeypatch.setattr(firecrawl, "search", fake.search)
    monkeypatch.setattr(firecrawl, "scrape", fake.scrape)
    return fake


async def _job(client, response) -> dict:
    assert response.status_code == 202, response.text
    job = (await client.get(f"/jobs/{response.json()['job_id']}")).json()
    assert job["status"] == "succeeded", job
    return job["detail"]


async def _discover(client, monkeypatch, *urls) -> dict:
    monkeypatch.setattr(discovery, "_converse", _agent(*urls))
    return await _job(client, await client.post(
        "/mapping/discover", json={"policy_document_id": POLICY_DOC}))


async def test_discover_approve_track_and_notify(client, web, monkeypatch):
    detail = await _discover(client, monkeypatch, "https://www.uspstf.org/crc/",
                             "https://www.cancer.org/crc-guideline", "https://invented.org/x")
    assert detail["guidelines_proposed"] == 2
    assert detail["dropped_unverified"] == ["https://invented.org/x"]

    proposals = (await client.get("/mapping/proposals", params={"status": "proposed"})).json()
    by_url = {p["url"]: p for p in proposals}
    assert set(by_url) == {"https://www.uspstf.org/crc", "https://www.cancer.org/crc-guideline"}
    assert by_url["https://www.uspstf.org/crc"]["authority_name"] == "USPSTF"

    uspstf, acs = by_url["https://www.uspstf.org/crc"], by_url["https://www.cancer.org/crc-guideline"]
    approved = (await client.post("/mapping/proposals/decide", json={
        "source_id": uspstf["source_id"], "policy_document_id": POLICY_DOC, "status": "approved",
    })).json()
    assert approved["status"] == "approved" and approved["document_id"].startswith("web_discovery-")
    doc = await db.get_source_document(approved["document_id"])
    assert doc.media_type == "text/plain" and doc.origin_url == "https://www.uspstf.org/crc"
    await client.post("/mapping/proposals/decide", json={
        "source_id": acs["source_id"], "policy_document_id": POLICY_DOC, "status": "rejected"})

    # a second run proposes neither the approved nor the rejected URL again
    again = await _discover(client, monkeypatch, "https://www.uspstf.org/crc",
                            "https://www.cancer.org/crc-guideline")
    assert again["guidelines_proposed"] == 0

    # unchanged page: no notification and no LLM call
    async def judge(title, diff):
        judge.diffs.append(diff)
        material = "40 to 75" in diff
        return llm.ChangeVerdict(material=material, summary="Start age lowered to 40.")
    judge.diffs = []
    monkeypatch.setattr(llm, "judge_change", judge)
    detail = await _job(client, await client.post("/mapping/check-updates"))
    assert detail == {"checked": 1, "changed": 0, "minor_changes": 0, "failed": []}
    assert judge.diffs == []

    # page noise: judged once, stores nothing, and the same noise is not judged again
    web.pages["https://www.uspstf.org/crc"] = "# CRC \nScreen adults aged 45 to 75.\n[0](x)\n"
    for expected_minor in (1, 0):
        detail = await _job(client, await client.post("/mapping/check-updates"))
        assert detail["minor_changes"] == expected_minor and detail["changed"] == 0
    assert len(judge.diffs) == 1
    assert (await db.get_source(uspstf["source_id"]))["document_id"] == approved["document_id"]

    web.pages["https://www.uspstf.org/crc"] = "# CRC\nScreen adults aged 40 to 75.\n"
    detail = await _job(client, await client.post("/mapping/check-updates"))
    assert detail["changed"] == 1 and "+Screen adults aged 40 to 75." in judge.diffs[-1]
    changes = (await client.get("/mapping/changes", params={"unread_only": True})).json()
    assert [c["summary"] for c in changes] == ["Start age lowered to 40."]
    assert changes[0]["previous_document_id"] == approved["document_id"]
    await client.post(f"/mapping/changes/{changes[0]['change_id']}/read")
    assert (await client.get("/mapping/changes", params={"unread_only": True})).json() == []

    # pausing skips the source; untracking removes it from the list
    sid = uspstf["source_id"]
    assert (await client.patch(f"/mapping/sources/{sid}", json={"paused": True})).status_code == 200
    detail = await _job(client, await client.post("/mapping/check-updates"))
    assert detail["checked"] == 0
    assert (await client.delete(f"/mapping/sources/{sid}")).json()["mappings_rejected"] == 1
    assert (await client.get("/mapping/sources")).json() == []


async def test_authorities_scope_scheduled_runs(client, web, monkeypatch):
    await _discover(client, monkeypatch, "https://www.uspstf.org/crc")
    [authority] = (await client.get("/mapping/authorities")).json()
    assert authority["authority_id"] == "uspstf.org" and authority["status"] == "proposed"

    # no approved authority: scheduled discovery is skipped
    web.searches.clear()
    detail = await _job(client, await client.post("/mapping/schedule/run"))
    assert detail["discovery"][0]["skipped"] == "no approved authorities" and not web.searches

    await client.post("/mapping/authorities/uspstf.org/decide", json={"status": "approved"})
    detail = await _job(client, await client.post("/mapping/schedule/run"))
    assert web.searches == [("crc", True, ["uspstf.org"])]
    assert detail["discovery_failed"] == []


async def test_manual_source_is_tracked_at_once(client, web):
    response = await client.post("/mapping/sources", json={
        "url": "https://www.cancer.org/crc-guideline", "policy_document_id": POLICY_DOC})
    assert response.status_code == 201 and response.json()["status"] == "approved"
    [source] = (await client.get("/mapping/sources")).json()
    assert source["policy_document_ids"] == [POLICY_DOC] and source["document_id"]


async def test_schedule_claims_a_due_run_once(client):
    saved = (await client.put("/mapping/schedule",
                              json={"enabled": True, "interval_hours": 24})).json()
    assert saved["enabled"] and saved["next_run_at"] is not None
    assert not await db.claim_scheduled_run()  # not due yet
    await db.pool().execute("update discovery_schedule set next_run_at = now() - interval '1m'")
    claims = await asyncio.gather(*(db.claim_scheduled_run() for _ in range(5)))
    assert claims.count(True) == 1
    off = (await client.put("/mapping/schedule", json={"enabled": False, "interval_hours": 24}))
    assert off.json()["next_run_at"] is None


async def test_unknown_policy_and_missing_key(client, monkeypatch):
    missing = await client.post("/mapping/discover", json={"policy_document_id": "nope"})
    assert missing.status_code == 404
    monkeypatch.setattr(settings, "firecrawl_api_key", "")
    response = await client.post("/mapping/discover", json={"policy_document_id": POLICY_DOC})
    assert response.status_code == 503
    assert (await client.get("/mapping/schedule")).json()["firecrawl_configured"] is False


def test_snapshot_ids_match_stored_documents():
    snap = tracking.Snapshot(b"x", "text/plain", "ab" * 32, "t")
    assert f"{db.WEB_DISCOVERY_SOURCE_KEY}-{snap.sha256[:16]}" == "web_discovery-abababababababab"
