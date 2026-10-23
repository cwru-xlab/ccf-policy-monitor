"""Upload -> store -> parse pipeline and its endpoint, with the database, storage and model faked."""

import asyncio
from datetime import date

import httpx
import pytest

from policy_radar import api, db, llm, parsing, pipelines
from policy_radar.enums import CoverageEffect, PolicyDocumentType


class Fake:
    """In-memory stand-ins for the database, object storage and the model."""

    def __init__(self, monkeypatch, fail_numbers=()):
        self.ids: set[str] = set()
        self.saved: list = []
        self.jobs: dict[str, dict] = {}
        self.in_flight = 0
        self.peak = 0
        self.fail_numbers = set(fail_numbers)
        monkeypatch.setattr(pipelines.storage, "put", lambda key, content: None)
        monkeypatch.setattr(db, "insert_source_document", self.insert)
        monkeypatch.setattr(llm, "extract", self.extract)
        monkeypatch.setattr(llm, "embed", self.embed)
        monkeypatch.setattr(db, "save_policy", self.save)
        monkeypatch.setattr(db, "create_job", self.create_job)
        monkeypatch.setattr(db, "set_job", self.set_job)

    async def insert(self, doc):
        new = doc.document_id not in self.ids
        self.ids.add(doc.document_id)
        return new

    async def extract(self, schema, instructions, doc):
        self.in_flight += 1
        self.peak = max(self.peak, self.in_flight)
        await asyncio.sleep(0.01)
        self.in_flight -= 1
        number = doc.content_sha256[:4]
        if number in self.fail_numbers:
            raise ValueError("model returned no parsable output")
        crit = llm.ExtractedCriterion(text=f"criterion of {number}", concept_words=["x"])
        return llm.ExtractedPolicy(
            policy_number=number, doc_type=PolicyDocumentType.MEDICAL_CLINICAL_POLICY_BULLETIN,
            title="t", coverage_effect=CoverageEffect.COVERED, effective_date=date(2026, 1, 1),
            last_reviewed=None, codes=[], criteria=[crit],
        )

    async def embed(self, texts):
        return [[0.0] for _ in texts]

    async def save(self, policy, embeddings):
        self.saved.append(policy)

    async def create_job(self, kind, detail):
        self.jobs["j1"] = {"kind": kind, "detail": detail}
        return "j1"

    async def set_job(self, job_id, status, detail=None, error=None):
        self.jobs[job_id].update(status=status, result=detail, error=error)


def upload(text: str, name: str = "a.txt") -> parsing.Upload:
    return parsing.Upload(name, text.encode(), parsing.TEXT)


async def test_new_files_are_parsed_into_policies_and_duplicates_are_skipped(monkeypatch):
    fake = Fake(monkeypatch)
    first = await pipelines.ingest_policy_files([upload("one"), upload("two")])
    assert first["processed"] == 2 and first["failed"] == [] and len(fake.saved) == 2
    assert fake.saved[0].criteria[0].criterion_id.endswith(":1")
    again = await pipelines.ingest_policy_files([upload("one", "renamed.txt")])
    assert again["stored"] == [] and again["duplicates"] == ["renamed.txt"] and len(fake.saved) == 2


async def test_one_failing_document_does_not_stop_the_rest(monkeypatch):
    import hashlib

    bad = hashlib.sha256(b"bad").hexdigest()[:4]
    fake = Fake(monkeypatch, fail_numbers={bad})
    result = await pipelines.ingest_policy_files([upload("bad"), upload("good")])
    assert result["processed"] == 1 and len(fake.saved) == 1
    assert "ValueError" in result["failed"][0]["error"]


async def test_parsing_runs_concurrently_but_within_the_bound(monkeypatch):
    fake = Fake(monkeypatch)
    await pipelines.ingest_policy_files([upload(str(i)) for i in range(12)])
    assert 1 < fake.peak <= pipelines.PARSE_CONCURRENCY


@pytest.fixture
async def client():
    transport = httpx.ASGITransport(app=api.app)  # no lifespan: no real database pool
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def test_endpoint_returns_202_with_a_job_and_runs_the_pipeline(monkeypatch, client):
    fake = Fake(monkeypatch)
    resp = await client.post("/policies/ingest", files=[("files", ("cpb.txt", b"hello", "text/plain"))])
    assert resp.status_code == 202 and resp.json() == {"job_id": "j1"}
    assert fake.jobs["j1"]["detail"] == {"files": ["cpb.txt"]}
    assert fake.jobs["j1"]["status"] == "succeeded" and len(fake.saved) == 1


async def test_endpoint_rejects_unsupported_formats_before_creating_a_job(monkeypatch, client):
    fake = Fake(monkeypatch)
    resp = await client.post("/policies/ingest", files=[("files", ("x.exe", b"MZ\x00\x00", "application/octet-stream"))])
    assert resp.status_code == 415 and fake.jobs == {}


async def test_endpoint_rejects_oversized_files(monkeypatch, client):
    Fake(monkeypatch)
    monkeypatch.setattr(parsing, "MAX_UPLOAD_BYTES", 4)
    resp = await client.post("/policies/ingest", files=[("files", ("big.txt", b"12345", "text/plain"))])
    assert resp.status_code == 413
