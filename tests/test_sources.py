"""Connector logic against the captured live payloads in tests/fixtures/ (offline).

Live requests are in tests/test_sources_live.py.
"""

import json
from datetime import date
from pathlib import Path

import httpx
import pytest
from openai.lib._pydantic import to_strict_json_schema
from pydantic import ValidationError

from policy_radar import llm, sources
from policy_radar.config import settings

SINCE = date(2026, 9, 1)
FIXTURES = Path(__file__).parent / "fixtures"


def fixture(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def fixture_json(name: str) -> dict:
    return json.loads(fixture(name))


def client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


# --- openFDA ---------------------------------------------------------------------------------


async def test_openfda_stores_each_record_as_served_with_its_public_url():
    body = fixture_json("openfda_device_510k.json")

    async with client(lambda req: httpx.Response(200, json=body)) as c:
        fetched = await sources.openfda_device_510k(c, SINCE)

    assert len(fetched) == len(body["results"])
    assert json.loads(fetched[0].content) == body["results"][0]  # raw record, every field kept
    assert fetched[0].origin_url.endswith(f"ID={body['results'][0]['k_number']}")


async def test_openfda_no_matches_is_an_empty_list_not_an_error():
    async with client(lambda req: httpx.Response(404, json={"error": {"code": "NOT_FOUND"}})) as c:
        assert await sources.openfda_drug_label(c, SINCE) == []


async def test_openfda_rejects_a_record_without_its_date():
    body = fixture_json("openfda_drug_label.json")
    del body["results"][0]["effective_time"]
    async with client(lambda req: httpx.Response(200, json=body)) as c:
        with pytest.raises(ValidationError):
            await sources.openfda_drug_label(c, SINCE)


# --- Federal Register ------------------------------------------------------------------------


async def test_federal_register_fetches_each_listed_text():
    listing = fixture_json("federal_register_list.json")
    listing["next_page_url"] = None

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("documents.json"):
            return httpx.Response(200, json=listing)
        return httpx.Response(200, content=fixture("federal_register_text.txt"),
                              headers={"content-type": "text/plain"})

    async with client(handler) as c:
        fetched = await sources.federal_register(c, SINCE)

    assert [f.origin_url for f in fetched] == [d["html_url"] for d in listing["results"]]


async def test_federal_register_empty_listing_has_no_results_key():
    empty = {"description": "none", "count": 0}
    async with client(lambda req: httpx.Response(200, json=empty)) as c:
        assert await sources.federal_register(c, SINCE) == []


# --- eCFR ------------------------------------------------------------------------------------


def ecfr_handler(versions_by_page: dict[int, dict], requested: list):
    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith(".json"):
            return httpx.Response(200, json=versions_by_page[int(req.url.params["page"])])
        requested.append((req.url.path, req.url.params["section"]))
        return httpx.Response(200, content=fixture("ecfr_section.xml"))

    return handler


async def test_ecfr_takes_newest_substantive_version_per_section():
    base = fixture_json("ecfr_versions.json")["content_versions"][0]

    def version(identifier, day, amended, **kw):
        return {**base, "identifier": identifier, "date": day, "issue_date": day,
                "amendment_date": amended, **kw}

    page = {"content_versions": [
        version("405.1", "2026-09-02", "2026-09-02"),
        version("405.1", "2026-09-10", "2026-09-10"),
        version("405.2", "2026-09-03", "2015-12-19"),  # re-issue of an old amendment
        version("405.3", "2026-09-03", "2026-09-03", substantive=False),
        version("405.4", "2026-09-04", "2026-09-04", removed=True),
    ]}
    requested = []
    async with client(ecfr_handler({1: page}, requested)) as c:
        fetched = await sources.ecfr(c, SINCE)

    assert len(fetched) == len(sources.ECFR_TITLES)
    assert requested[0] == ("/api/versioner/v1/full/2026-09-10/title-42.xml", "405.1")


async def test_ecfr_reads_every_result_page():
    base = fixture_json("ecfr_versions.json")
    first = {**base, "meta": {**base["meta"], "page": 1, "per_page": 1, "total_pages": 2},
             "content_versions": base["content_versions"][:1]}
    second = {**base, "meta": {**base["meta"], "page": 2, "per_page": 1, "total_pages": 2},
              "content_versions": base["content_versions"][1:2]}
    requested = []
    async with client(ecfr_handler({1: first, 2: second}, requested)) as c:
        await sources.ecfr(c, SINCE)

    title_42 = {section for path, section in requested if "title-42" in path}
    assert title_42 == {v["identifier"] for v in base["content_versions"][:2]}


# --- CMS Coverage ----------------------------------------------------------------------------


async def test_cms_coverage_keeps_only_ncds_updated_since():
    report = fixture_json("cms_ncd_report.json")  # first row is 2026-08-12
    report["data"][0]["last_updated_sort"] = "20260905120000"

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/v1/reports/national-coverage-ncd/":
            return httpx.Response(200, json=report)
        return httpx.Response(200, content=fixture("cms_ncd_detail.json"))

    async with client(handler) as c:
        fetched = await sources.cms_coverage(c, SINCE)

    first = report["data"][0]
    assert [f.origin_url.split("?")[1] for f in fetched] == [
        f"ncdid={first['document_id']}&ncdver={first['document_version']}"]
    assert fetched[0].content == fixture("cms_ncd_detail.json")  # bytes as served


# --- USPSTF ----------------------------------------------------------------------------------


async def test_uspstf_without_a_key_fails_before_any_request(monkeypatch):
    monkeypatch.setattr(settings, "uspstf_api_key", "")
    async with client(lambda req: pytest.fail("no request expected")) as c:
        with pytest.raises(RuntimeError, match="USPSTF_API_KEY"):
            await sources.uspstf(c, SINCE)


async def test_uspstf_rejects_the_placeholder_reply_to_a_bad_key(monkeypatch):
    monkeypatch.setattr(settings, "uspstf_api_key", "bad")
    async with client(lambda req: httpx.Response(202, content=fixture("uspstf_nokey_placeholder.json"))) as c:
        with pytest.raises(RuntimeError, match="rejected the API key"):
            await sources.uspstf(c, SINCE)


# --- PubMed ----------------------------------------------------------------------------------


async def test_pubmed_splits_efetch_into_one_document_per_article():
    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("esearch.fcgi"):
            return httpx.Response(200, content=fixture("pubmed_esearch.json"))
        return httpx.Response(200, content=fixture("pubmed_efetch.xml"))

    async with client(handler) as c:
        fetched = await sources.pubmed(c, SINCE)

    ids = fixture_json("pubmed_esearch.json")["esearchresult"]["idlist"]
    assert [f.origin_url for f in fetched] == [f"https://pubmed.ncbi.nlm.nih.gov/{i}/" for i in ids]
    assert all(f.content.startswith(b"<PubmedArticle>") for f in fetched)


async def test_pubmed_esearch_error_raises():
    err = {"esearchresult": {"ERROR": "Invalid db name", "count": "0", "idlist": []}}
    async with client(lambda req: httpx.Response(200, json=err)) as c:
        with pytest.raises(RuntimeError, match="Invalid db name"):
            await sources.pubmed(c, SINCE)


# --- registry --------------------------------------------------------------------------------


def test_extraction_models_are_valid_strict_schemas():
    for model in (llm.ExtractedGuideline, llm.ExtractedPolicy):
        schema = to_strict_json_schema(model)
        assert schema["additionalProperties"] is False
        assert set(schema["required"]) == set(model.model_fields)
