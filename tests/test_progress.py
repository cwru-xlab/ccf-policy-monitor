"""Progress reported on a job while a CPB is parsed or a discovery agent runs."""

from datetime import UTC, datetime

from policy_radar import discovery, firecrawl, jobs, llm, pipelines
from policy_radar.enums import CodeSystem, CoverageEffect, JobStatus, PolicyDocumentType
from policy_radar.models import SourceDocument


def _doc(document_id: str = "doc-1") -> SourceDocument:
    return SourceDocument(
        document_id=document_id,
        source_key="cpb_upload",
        retrieved_at=datetime(2026, 3, 15, tzinfo=UTC),
        storage_uri=f"cpb_upload/{document_id}.txt",
        content_sha256="a" * 64,
        media_type="text/plain",
        origin_url=None,
    )


def _record(monkeypatch):
    """Capture ``set_job`` calls and merge detail the way ``jsonb ||`` does."""
    stored: dict = {"detail": {}}
    updates: list[dict] = []

    async def fake_set_job(job_id, status, detail=None, error=None):
        stored["job_id"] = job_id
        stored["status"] = status
        stored["error"] = error
        stored["detail"] = {**stored["detail"], **(detail or {})}
        if detail and "progress" in detail:
            updates.append(detail["progress"])

    monkeypatch.setattr(jobs.db, "set_job", fake_set_job)
    return stored, updates


def _patch_parse(monkeypatch):
    async def fake_extract(schema, instructions, doc, parsed=None):
        assert parsed is not None and "99213" in parsed.markdown
        return llm.ExtractedPolicy(
            policy_number="0584",
            doc_type=PolicyDocumentType.MEDICAL_CLINICAL_POLICY_BULLETIN,
            title="Test CPB",
            coverage_effect=CoverageEffect.COVERED,
            effective_date=None,
            last_reviewed=None,
            codes=[llm.ExtractedCode(system=CodeSystem.CPT, value="99213")],
            criteria=[llm.ExtractedCriterion(text="Age 18 or older", concept_words=["age"])],
        )

    async def fake_embed(texts):
        return [[0.0] * 4 for _ in texts]

    async def fake_save(policy, embeddings):
        return None

    monkeypatch.setattr(pipelines.llm, "extract", fake_extract)
    monkeypatch.setattr(pipelines.llm, "embed", fake_embed)
    monkeypatch.setattr(pipelines.db, "save_policy", fake_save)
    monkeypatch.setattr(pipelines.storage, "get", lambda uri: b"CPT 99213 is covered.\n")


async def test_report_is_a_noop_without_a_job(monkeypatch):
    stored, updates = _record(monkeypatch)
    _patch_parse(monkeypatch)
    await jobs.report("reading", "Reading the document", 0, 10)
    await pipelines._parse_cpb(_doc())
    assert updates == []
    assert stored["detail"] == {}


async def test_parse_reports_stage_floors_in_order(monkeypatch):
    _stored, updates = _record(monkeypatch)
    _patch_parse(monkeypatch)
    with jobs.activate("job-1"):
        await pipelines._parse_cpb(_doc())
    assert [(u["phase"], u["percent"], u["ceiling"], u["label"]) for u in updates] == [
        ("reading", 0, 10, "Reading the document"),
        ("extracting", 10, 78, "Extracting coverage criteria"),
        ("codes", 78, 86, "Finding billing codes"),
        ("embedding", 86, 96, "Embedding criteria"),
        ("saving", 96, 100, "Saving the policy"),
    ]


async def test_parse_scales_each_document_into_an_equal_slice(monkeypatch):
    _stored, updates = _record(monkeypatch)
    _patch_parse(monkeypatch)

    async def unparsed():
        return [_doc("doc-1"), _doc("doc-2")]

    monkeypatch.setattr(pipelines.db, "unparsed_cpbs", unparsed)
    with jobs.activate("job-1"):
        result = await pipelines.parse_pending_cpbs()
    assert result == {"processed": 2, "failed": []}
    assert updates[0]["label"] == "Document 1 of 2 — Reading the document"
    assert updates[0]["percent"] == 0
    second = next(u for u in updates if u["label"] == "Document 2 of 2 — Reading the document")
    assert second["percent"] == 50
    assert second["ceiling"] == 55
    assert updates[-1]["label"] == "Document 2 of 2 — Saving the policy"
    assert updates[-1]["percent"] == 98
    assert updates[-1]["ceiling"] == 100


async def test_progress_survives_the_result_merge(monkeypatch):
    stored, updates = _record(monkeypatch)

    async def work():
        await jobs.report("extracting", "Extracting coverage criteria", 10, 78)
        return {"processed": 1, "failed": []}

    await jobs.run("job-1", work())
    assert stored["status"] == JobStatus.SUCCEEDED
    assert stored["error"] is None
    assert stored["detail"]["processed"] == 1
    assert stored["detail"]["failed"] == []
    assert updates[-1] == {
        "phase": "extracting",
        "label": "Extracting coverage criteria",
        "percent": 10,
        "ceiling": 78,
    }
    assert stored["detail"]["progress"] == updates[-1]


def _reply(*content):
    return {"output": {"message": {"role": "assistant", "content": list(content)}}}


def _use(tool_id, name, **args):
    return {"toolUse": {"toolUseId": tool_id, "name": name, "input": args}}


async def test_agent_reports_a_search_then_finishes(monkeypatch):
    _stored, updates = _record(monkeypatch)

    async def search(query, recent=False, domains=None):
        return [firecrawl.SearchResult("https://a.org/guide/", "Guide", "about it")]

    async def scrape(url):
        return firecrawl.Page(url, "Guide", "See https://a.org/guide.pdf", "text/html")

    monkeypatch.setattr(discovery.firecrawl, "search", search)
    monkeypatch.setattr(discovery.firecrawl, "scrape", scrape)
    replies = [
        _reply(
            _use("1", "search_web", query="mammography USPSTF guideline"),
            _use("2", "read_page", url="https://a.org/guide"),
        ),
        _reply(_use("3", "submit_proposals", authorities=[], guidelines=[])),
    ]

    def converse(messages):
        return replies.pop(0)

    with jobs.activate("job-1"):
        await discovery.run_agent("brief", None, converse=converse)

    labels = [u["label"] for u in updates]
    assert "Searching: mammography USPSTF guideline" in labels
    assert "Reading a.org" in labels
    assert updates[-1]["phase"] == "proposing"
    assert updates[-1]["percent"] == 100
    assert updates[-1]["ceiling"] == 100
    assert [u["percent"] for u in updates] == sorted(u["percent"] for u in updates)
    # The curve stops short of done until submit.
    assert all(u["percent"] <= 92 for u in updates[:-1])


async def test_span_maps_a_child_report_into_its_slice(monkeypatch):
    _stored, updates = _record(monkeypatch)
    with jobs.activate("job-1"):
        async with jobs.span(0, 30):
            await jobs.report("reading", "Reading the document", 0, 10)
            await jobs.report("saving", "Saving the policy", 96, 100)
    assert updates[0] == {
        "phase": "reading",
        "label": "Reading the document",
        "percent": 0,
        "ceiling": 3,
    }
    assert updates[1]["percent"] == 29
    assert updates[1]["ceiling"] == 30
