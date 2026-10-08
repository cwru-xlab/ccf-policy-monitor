"""Per-provider response models against the captured live payloads in tests/fixtures/.

Re-capture with ``python scripts/capture_fixtures.py``. The USPSTF fixture is the API's
no-key placeholder (no key was available), so it proves the envelope, not real content.
"""

import json
from datetime import date
from pathlib import Path

import pytest
from pydantic import ValidationError

from policy_radar.responses import cms_coverage, ecfr, federal_register, openfda, pubmed, uspstf
from policy_radar.responses.base import compact_date

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


# --- shared date parsing -------------------------------------------------------------


@pytest.mark.parametrize("raw, expected", [
    ("20261003", date(2026, 10, 3)),            # openFDA effective_time
    ("20260812133308", date(2026, 8, 12)),      # CMS last_updated_sort
    ("2026-09-27", date(2026, 9, 27)),          # ISO
])
def test_compact_date_reads_calendar_dates_not_timestamps(raw, expected):
    assert compact_date(raw) == expected


@pytest.mark.parametrize("raw", ["", "N/A", "2026", "20261345", "not a date"])
def test_compact_date_rejects_garbage(raw):
    with pytest.raises(ValueError):
        compact_date(raw)


@pytest.mark.parametrize("raw, expected", [
    ("06/11/1985", date(1985, 6, 11)),
    ("", None),
    ("N/A", None),
    ("This is a longstanding national coverage determination and the effective date is not available.", None),
])
def test_cms_dates_that_are_not_dates_become_none(raw, expected):
    assert cms_coverage.Ncd(document_id="1", document_version=1, document_display_id="1.1",
                            title="t", effective_date=raw).effective_date == expected


# --- openFDA ---------------------------------------------------------------------------


def test_drug_label_page_validates_and_parses_effective_time():
    page = openfda.DrugLabelPage.model_validate(load("openfda_drug_label.json"))
    assert page.meta.results.total >= len(page.results) > 0
    label = page.results[0]
    assert label.set_id and label.effective_time.year >= 2026
    assert label.indications_and_usage is None or isinstance(label.indications_and_usage[0], str)


def test_510k_page_validates_and_parses_decision_date():
    page = openfda.Device510kPage.model_validate(load("openfda_device_510k.json"))
    clearance = page.results[0]
    assert clearance.k_number.startswith(("K", "DEN", "P"))
    assert isinstance(clearance.decision_date, date)


def test_openfda_keeps_unmodelled_fields():
    page = openfda.Device510kPage.model_validate(load("openfda_device_510k.json"))
    assert "advisory_committee" in page.results[0].model_extra


def test_openfda_record_missing_its_id_fails():
    body = load("openfda_device_510k.json")
    del body["results"][0]["k_number"]
    with pytest.raises(ValidationError):
        openfda.Device510kPage.model_validate(body)


# --- Federal Register --------------------------------------------------------------------


def test_federal_register_list_validates():
    page = federal_register.DocumentList.model_validate(load("federal_register_list.json"))
    assert page.count >= len(page.results) == 3
    assert page.results[0].raw_text_url.endswith(".txt")
    assert page.next_page_url and page.next_page_url.startswith("https://")


def test_federal_register_empty_result_has_no_results_key():
    page = federal_register.DocumentList.model_validate({"description": "none", "count": 0})
    assert page.results == () and page.next_page_url is None


# --- eCFR ----------------------------------------------------------------------------------


def test_ecfr_versions_validate():
    versions = ecfr.VersionList.model_validate(load("ecfr_versions.json"))
    v = versions.content_versions[0]
    assert v.substantive is True and v.removed is False
    assert isinstance(v.amendment_date, date) and v.part == "405"


# --- CMS Coverage ----------------------------------------------------------------------------


def test_cms_report_validates_and_parses_sort_timestamp():
    report = cms_coverage.NcdReport.model_validate(load("cms_ncd_report.json"))
    row = report.data[0]
    assert row.document_id == 108 and row.last_updated_sort == date(2026, 8, 12)


def test_cms_detail_validates_and_ids_are_strings():
    detail = cms_coverage.NcdDetail.model_validate(load("cms_ncd_detail.json"))
    ncd = detail.data[0]
    assert ncd.document_id == "108"  # the report says int 108; the detail says "108"
    assert ncd.effective_date == date(1985, 6, 11)
    assert ncd.effective_end_date is None  # served as "N/A"


# --- PubMed ----------------------------------------------------------------------------------


def test_pubmed_esearch_validates():
    result = pubmed.ESearchResponse.model_validate(load("pubmed_esearch.json")).esearchresult
    assert result.count >= len(result.idlist) == 3 and result.error is None


def test_pubmed_esearch_error_is_surfaced():
    body = {"esearchresult": {"ERROR": "Invalid db name", "count": "0", "idlist": []}}
    assert pubmed.ESearchResponse.model_validate(body).esearchresult.error == "Invalid db name"


def test_pubmed_articles_parse_from_efetch_xml():
    articles = pubmed.parse_articles((FIXTURES / "pubmed_efetch.xml").read_bytes())
    assert len(articles) == 3
    a = articles[0]
    assert a.pmid == "42838840" and a.title.startswith("Appraisal of Clinical Practice Guideline")
    assert "Practice Guideline" in a.publication_types
    assert a.date_revised == date(2026, 10, 6)


def test_pubmed_article_without_pmid_fails():
    with pytest.raises(ValueError):
        pubmed.parse_articles(b"<PubmedArticleSet><PubmedArticle><MedlineCitation/>"
                              b"</PubmedArticle></PubmedArticleSet>")


# --- USPSTF ----------------------------------------------------------------------------------


def test_uspstf_placeholder_is_recognised_as_a_missing_key():
    data = uspstf.Response.model_validate(load("uspstf_nokey_placeholder.json"))
    assert data.api_key_warning and data.api_key_warning.startswith("! Starting 2021-03-01")
    assert data.specific_recommendations[0].grade == "A"
    assert data.specific_recommendations[0].general == "1"
    assert "1" in data.general_recommendations


def test_uspstf_accepts_a_numeric_general_key_and_missing_optional_fields():
    body = {"specificRecommendations": [{"general": 7}], "generalRecommendations": {"7": {}}}
    data = uspstf.Response.model_validate(body)
    assert data.specific_recommendations[0].general == "7"
    assert data.general_recommendations["7"].uspstf_alias is None
    assert data.api_key_warning is None
