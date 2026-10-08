"""One fetch function per guideline source, and the SOURCES registry the API exposes.

Each registry key has a row in the ``source`` table (db/schema.sql) naming its authority.

Each function takes an httpx client and a ``since`` date and returns the files published or
changed since then, one ``Fetched`` per document, as the source served them. Every response is
validated by its model in ``policy_radar/responses`` first, so a changed provider fails the
run loudly; the stored bytes are the provider's, never a re-serialised model. Unchanged files
are harmless: storage skips bytes it already holds. Endpoint details and response shapes: docs/INGESTION_SPEC.md.
"""

import json
import logging
import xml.etree.ElementTree as ET
from collections.abc import Awaitable, Callable
from datetime import UTC, date, datetime
from typing import NamedTuple

import httpx

from policy_radar.config import settings
from policy_radar.responses import cms_coverage as cms_models
from policy_radar.responses import ecfr as ecfr_models
from policy_radar.responses import federal_register as federal_register_models
from policy_radar.responses import openfda
from policy_radar.responses import pubmed as pubmed_models
from policy_radar.responses import uspstf as uspstf_models

log = logging.getLogger(__name__)

MAX_RECORDS_PER_ENDPOINT = 1000  # bounds LLM cost per run; logged when hit


class Fetched(NamedTuple):
    content: bytes
    media_type: str
    origin_url: str | None


def _json(record: dict) -> bytes:
    return json.dumps(record, sort_keys=True, indent=1).encode()


# --- openFDA -------------------------------------------------------------------

_OPENFDA = {  # endpoint -> (page model, date field, record id field, public URL template)
    "drug/label": (openfda.DrugLabelPage, "effective_time", "set_id",
                   "https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid={}"),
    "device/510k": (openfda.Device510kPage, "decision_date", "k_number",
                    "https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID={}"),
}


async def _openfda(client: httpx.AsyncClient, since: date, endpoint: str) -> list[Fetched]:
    """Records of one openFDA endpoint dated on or after ``since``, newest first."""
    page_model, date_field, id_field, url = _OPENFDA[endpoint]
    params = {
        "search": f"{date_field}:[{since:%Y%m%d} TO {datetime.now(UTC):%Y%m%d}]",
        "sort": f"{date_field}:desc",
        "limit": min(MAX_RECORDS_PER_ENDPOINT, 1000),
    }
    if settings.openfda_api_key:
        params["api_key"] = settings.openfda_api_key
    # One page of 1000 (openFDA's max) is the whole cap, so no pagination. Raising the cap
    # needs the `Link: rel="Next"` header followed (https://open.fda.gov/apis/paging/).
    r = await client.get(f"https://api.fda.gov/{endpoint}.json", params=params)
    if r.status_code == 404:  # openFDA's answer to "no matches"
        return []
    r.raise_for_status()
    body = r.json()
    page = page_model.model_validate(body)
    if page.meta.results.total > MAX_RECORDS_PER_ENDPOINT:
        log.warning("openfda %s: %d records, kept newest %d", endpoint,
                    page.meta.results.total, MAX_RECORDS_PER_ENDPOINT)
    return [
        Fetched(_json(raw), "application/json", url.format(getattr(rec, id_field)))
        for raw, rec in zip(body["results"], page.results)
    ]


async def openfda_drug_label(client: httpx.AsyncClient, since: date) -> list[Fetched]:
    """Drug label versions effective on or after ``since``."""
    return await _openfda(client, since, "drug/label")


async def openfda_device_510k(client: httpx.AsyncClient, since: date) -> list[Fetched]:
    """510(k) clearances decided on or after ``since``."""
    return await _openfda(client, since, "device/510k")


# --- Federal Register -----------------------------------------------------------


async def federal_register(client: httpx.AsyncClient, since: date) -> list[Fetched]:
    """Final and proposed rules from HHS, CMS and FDA published since ``since``, as raw text."""
    params = {
        "conditions[agencies][]": [
            "health-and-human-services-department",
            "centers-for-medicare-medicaid-services",
            "food-and-drug-administration",
        ],
        "conditions[type][]": ["RULE", "PRORULE"],
        "conditions[publication_date][gte]": since.isoformat(),
        "fields[]": ["document_number", "html_url", "raw_text_url"],
        "order": "newest",
        "per_page": min(MAX_RECORDS_PER_ENDPOINT, 1000),
    }
    r = await client.get("https://www.federalregister.gov/api/v1/documents.json", params=params)
    docs: list[federal_register_models.Document] = []
    while True:
        r.raise_for_status()
        page = federal_register_models.DocumentList.model_validate(r.json())
        docs += page.results
        if not page.next_page_url or len(docs) >= MAX_RECORDS_PER_ENDPOINT:
            break
        r = await client.get(page.next_page_url)
    out = []
    for doc in docs[:MAX_RECORDS_PER_ENDPOINT]:
        text = await client.get(doc.raw_text_url)
        text.raise_for_status()
        out.append(Fetched(text.content, "text/plain", doc.html_url))
    return out


# --- eCFR ------------------------------------------------------------------------

ECFR_TITLES = (42, 45)  # Public Health (Medicare/Medicaid); Public Welfare (HIPAA, ACA)


async def _ecfr_versions(client: httpx.AsyncClient, base: str, title: int, since: date):
    """Every version of title ``title`` issued since ``since``, across all result pages."""
    versions, page = [], 1
    while True:
        r = await client.get(f"{base}/versions/title-{title}.json",
                             params={"issue_date[gte]": since.isoformat(), "page": page})
        r.raise_for_status()
        listing = ecfr_models.VersionList.model_validate(r.json())
        versions += listing.content_versions
        if listing.meta is None or page >= listing.meta.total_pages:
            return versions
        page += 1


async def ecfr(client: httpx.AsyncClient, since: date) -> list[Fetched]:
    """The current text of every section substantively amended since ``since``."""
    base = "https://www.ecfr.gov/api/versioner/v1"
    out = []
    for title in ECFR_TITLES:
        latest: dict[str, ecfr_models.Version] = {}  # section identifier -> newest version
        for v in await _ecfr_versions(client, base, title, since):
            # a new issue_date alone can be a re-issue of an old amendment
            amended = v.substantive and not v.removed and v.amendment_date >= since
            newer = v.identifier not in latest or v.date > latest[v.identifier].date
            if amended and newer:
                latest[v.identifier] = v
        if len(latest) > MAX_RECORDS_PER_ENDPOINT:
            log.warning("ecfr title %d: %d sections, kept %d", title, len(latest),
                        MAX_RECORDS_PER_ENDPOINT)
        for v in list(latest.values())[:MAX_RECORDS_PER_ENDPOINT]:
            x = await client.get(f"{base}/full/{v.date.isoformat()}/title-{title}.xml",
                                 params={"part": v.part, "section": v.identifier})
            if x.status_code == 404:  # date not yet published in full text
                continue
            x.raise_for_status()
            url = f"https://www.ecfr.gov/current/title-{title}/section-{v.identifier}"
            out.append(Fetched(x.content, "application/xml", url))
    return out


# --- CMS Medicare Coverage Database -----------------------------------------------


async def cms_coverage(client: httpx.AsyncClient, since: date) -> list[Fetched]:
    """National Coverage Determinations updated since ``since``.

    LCDs are left out: their detail endpoint needs a token whose request accepts the
    AMA/ADA/AHA license terms, which is a decision for a person, not this code.
    """
    base = "https://api.coverage.cms.gov/v1"
    r = await client.get(f"{base}/reports/national-coverage-ncd/")
    r.raise_for_status()
    report = cms_models.NcdReport.model_validate(r.json())
    changed = [n for n in report.data if n.last_updated_sort >= since]
    out = []
    for n in changed[:MAX_RECORDS_PER_ENDPOINT]:
        d = await client.get(f"{base}/data/ncd/",
                             params={"ncdid": n.document_id, "ncdver": n.document_version})
        d.raise_for_status()
        cms_models.NcdDetail.model_validate(d.json())
        url = ("https://www.cms.gov/medicare-coverage-database/view/ncd.aspx"
               f"?ncdid={n.document_id}&ncdver={n.document_version}")
        out.append(Fetched(d.content, "application/json", url))
    return out


# --- USPSTF --------------------------------------------------------------------------


async def uspstf(client: httpx.AsyncClient, since: date) -> list[Fetched]:
    """Every current USPSTF recommendation, one document per specific recommendation.

    The API has no per-recommendation dates, so ``since`` is ignored: the whole set is
    fetched and storage keeps only records whose bytes changed.
    """
    if not settings.uspstf_api_key:
        raise RuntimeError("USPSTF_API_KEY is not set")
    r = await client.get("https://data.uspreventiveservicestaskforce.org/api/json",
                         params={"key": settings.uspstf_api_key})
    r.raise_for_status()
    raw = r.json()
    data = uspstf_models.Response.model_validate(raw)
    if r.status_code == 202 or data.api_key_warning:  # the placeholder reply to a bad key
        raise RuntimeError(f"USPSTF rejected the API key: {data.api_key_warning}")
    out = []
    for raw_rec, rec in zip(raw["specificRecommendations"], data.specific_recommendations):
        topic = data.general_recommendations.get(rec.general)
        url = ("https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/"
               f"{topic.uspstf_alias if topic else ''}")
        out.append(Fetched(
            _json({"recommendation": raw_rec, "topic": raw["generalRecommendations"].get(rec.general, {})}),
            "application/json", url))
    return out


# --- PubMed ------------------------------------------------------------------------------

_EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"


async def pubmed(client: httpx.AsyncClient, since: date) -> list[Fetched]:
    """PubMed records of publication type "practice guideline" modified since ``since``."""
    key = {"api_key": settings.ncbi_api_key} if settings.ncbi_api_key else {}
    r = await client.get(f"{_EUTILS}/esearch.fcgi", params={
        "db": "pubmed", "term": '"practice guideline"[Publication Type]', "datetype": "mdat",
        "mindate": f"{since:%Y/%m/%d}", "maxdate": f"{datetime.now(UTC):%Y/%m/%d}",
        "retmax": MAX_RECORDS_PER_ENDPOINT, "retmode": "json", **key,
    })
    r.raise_for_status()
    # errors can hold control chars
    result = pubmed_models.ESearchResponse.model_validate(json.loads(r.text, strict=False)).esearchresult
    if result.error:
        raise RuntimeError(f"PubMed esearch: {result.error}")
    if result.count > MAX_RECORDS_PER_ENDPOINT:
        log.warning("pubmed: %d records, kept %d", result.count, MAX_RECORDS_PER_ENDPOINT)
    out = []
    for i in range(0, len(result.idlist), 200):
        x = await client.get(f"{_EUTILS}/efetch.fcgi", params={
            "db": "pubmed", "id": ",".join(result.idlist[i:i + 200]), "retmode": "xml",
            "rettype": "abstract", **key,
        })
        x.raise_for_status()
        for node in ET.fromstring(x.content).iter("PubmedArticle"):
            article = pubmed_models.article_from_xml(node)  # validates; the stored bytes stay raw
            out.append(Fetched(ET.tostring(node, encoding="utf-8"), "application/xml",
                               f"https://pubmed.ncbi.nlm.nih.gov/{article.pmid}/"))
    return out


# --- Web pages without an API ---------------------------------------------------------------


async def _web_page(client: httpx.AsyncClient, url: str) -> list[Fetched]:
    """The current content of one page. No dates: a change is a change in the page's bytes."""
    r = await client.get(url)
    r.raise_for_status()
    media_type = r.headers.get("content-type", "text/html").split(";")[0]
    return [Fetched(r.content, media_type, url)]


async def cdc_acip_adult(client: httpx.AsyncClient, since: date) -> list[Fetched]:
    """The ACIP adult immunization schedule page. ``since`` is ignored."""
    return await _web_page(client, "https://www.cdc.gov/vaccines/hcp/imz-schedules/adult-age.html")


async def cdc_acip_child(client: httpx.AsyncClient, since: date) -> list[Fetched]:
    """The ACIP child and adolescent immunization schedule page. ``since`` is ignored."""
    return await _web_page(
        client, "https://www.cdc.gov/vaccines/hcp/imz-schedules/child-adolescent-age.html"
    )


SOURCES: dict[str, Callable[[httpx.AsyncClient, date], Awaitable[list[Fetched]]]] = {
    "openfda_drug_label": openfda_drug_label,
    "openfda_device_510k": openfda_device_510k,
    "federal_register": federal_register,
    "ecfr": ecfr,
    "cms_coverage": cms_coverage,
    "uspstf": uspstf,
    "pubmed": pubmed,
    "cdc_acip_adult": cdc_acip_adult,
    "cdc_acip_child": cdc_acip_child,
}
