"""Connector logic against canned responses shaped like the live APIs (checked 2026-09-22)."""

import json
from datetime import date

import httpx
from openai.lib._pydantic import to_strict_json_schema

from policy_radar import llm, sources

SINCE = date(2026, 9, 1)


def _client(routes: dict[str, httpx.Response]) -> httpx.AsyncClient:
    """A client answering each request from ``routes``, keyed by URL path."""
    return httpx.AsyncClient(transport=httpx.MockTransport(lambda req: routes[req.url.path]))


async def test_cms_coverage_keeps_only_ncds_updated_since():
    ncds = {"data": [
        {"document_id": 1, "document_version": 2, "last_updated_sort": "20260905120000"},
        {"document_id": 3, "document_version": 1, "last_updated_sort": "20250101000000"},
    ]}
    async with _client({
        "/v1/reports/national-coverage-ncd/": httpx.Response(200, json=ncds),
        "/v1/data/ncd/": httpx.Response(200, json={"data": [{"title": "x"}]}),
    }) as c:
        fetched = await sources.cms_coverage(c, SINCE)
    assert [f.origin_url.split("?")[1] for f in fetched] == ["ncdid=1&ncdver=2"]


async def test_ecfr_takes_newest_substantive_version_per_section():
    versions = {"content_versions": [
        {"identifier": "405.1", "part": "405", "date": "2026-09-02", "amendment_date": "2026-09-02",
         "substantive": True, "removed": False},
        {"identifier": "405.1", "part": "405", "date": "2026-09-10", "amendment_date": "2026-09-10",
         "substantive": True, "removed": False},
        {"identifier": "405.2", "part": "405", "date": "2026-09-03", "amendment_date": "2015-12-19",
         "substantive": True, "removed": False},  # re-issue of an old amendment
        {"identifier": "405.3", "part": "405", "date": "2026-09-03", "amendment_date": "2026-09-03",
         "substantive": False, "removed": False},
    ]}
    requested = []

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith(".json"):
            return httpx.Response(200, json=versions)
        requested.append((req.url.path, req.url.params["section"]))
        return httpx.Response(200, content=b"<DIV8/>")

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
        fetched = await sources.ecfr(c, SINCE)
    assert len(fetched) == len(sources.ECFR_TITLES)
    assert requested[0] == ("/api/versioner/v1/full/2026-09-10/title-42.xml", "405.1")


async def test_pubmed_splits_efetch_into_one_document_per_article():
    search = {"esearchresult": {"count": "2", "idlist": ["11", "22"]}}
    articles = (b"<PubmedArticleSet>"
                b"<PubmedArticle><MedlineCitation><PMID>11</PMID></MedlineCitation></PubmedArticle>"
                b"<PubmedArticle><MedlineCitation><PMID>22</PMID></MedlineCitation></PubmedArticle>"
                b"</PubmedArticleSet>")
    async with _client({
        "/entrez/eutils/esearch.fcgi": httpx.Response(200, text=json.dumps(search)),
        "/entrez/eutils/efetch.fcgi": httpx.Response(200, content=articles),
    }) as c:
        fetched = await sources.pubmed(c, SINCE)
    assert [f.origin_url for f in fetched] == [
        "https://pubmed.ncbi.nlm.nih.gov/11/", "https://pubmed.ncbi.nlm.nih.gov/22/"]
    assert all(f.content.startswith(b"<PubmedArticle>") for f in fetched)


def test_extraction_models_are_valid_strict_schemas():
    for model in (llm.ExtractedGuideline, llm.ExtractedPolicy):
        schema = to_strict_json_schema(model)
        assert schema["additionalProperties"] is False
        assert set(schema["required"]) == set(model.model_fields)
