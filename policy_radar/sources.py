"""One fetch function per guideline source, and the SOURCES registry the API exposes.

Each registry key has a row in the ``source`` table (db/schema.sql) naming its authority.

Each function takes an httpx client and a ``since`` date and returns the files published or
changed since then, one ``Fetched`` per document, as the source served them. Unchanged files
are harmless: storage skips bytes it already holds. Endpoint details were verified against
live responses on 2026-09-22; see docs/BACKEND_SPEC.md "Guideline sources".
"""

import json
import logging
import xml.etree.ElementTree as ET
from collections.abc import Awaitable, Callable
from datetime import UTC, date, datetime
from typing import NamedTuple

import httpx

from policy_radar.config import settings

log = logging.getLogger(__name__)

MAX_RECORDS_PER_ENDPOINT = 1000  # bounds LLM cost per run; logged when hit


class Fetched(NamedTuple):
    content: bytes
    media_type: str
    origin_url: str | None


def _json(record: dict) -> bytes:
    return json.dumps(record, sort_keys=True, indent=1).encode()


# --- openFDA -------------------------------------------------------------------

_OPENFDA = {  # endpoint -> (date field, record id field, public URL template)
    "drug/label": ("effective_time", "set_id", "https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid={}"),
    "device/510k": ("decision_date", "k_number", "https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID={}"),
}


async def _openfda(client: httpx.AsyncClient, since: date, endpoint: str) -> list[Fetched]:
    """Records of one openFDA endpoint dated on or after ``since``, newest first."""
    date_field, id_field, url = _OPENFDA[endpoint]
    params = {
        "search": f"{date_field}:[{since:%Y%m%d} TO {datetime.now(UTC):%Y%m%d}]",
        "sort": f"{date_field}:desc",
        "limit": MAX_RECORDS_PER_ENDPOINT,
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
    if body["meta"]["results"]["total"] > MAX_RECORDS_PER_ENDPOINT:
        log.warning("openfda %s: %d records, kept newest %d", endpoint,
                    body["meta"]["results"]["total"], MAX_RECORDS_PER_ENDPOINT)
    return [
        Fetched(_json(rec), "application/json", url.format(rec.get(id_field, "")))
        for rec in body["results"]
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
        "per_page": 1000,
    }
    r = await client.get("https://www.federalregister.gov/api/v1/documents.json", params=params)
    results = []
    while True:
        r.raise_for_status()
        page = r.json()
        results += page.get("results", [])
        if not page.get("next_page_url") or len(results) >= MAX_RECORDS_PER_ENDPOINT:
            break
        r = await client.get(page["next_page_url"])
    out = []
    for doc in results[:MAX_RECORDS_PER_ENDPOINT]:
        text = await client.get(doc["raw_text_url"])
        text.raise_for_status()
        out.append(Fetched(text.content, "text/plain", doc["html_url"]))
    return out


# --- eCFR ------------------------------------------------------------------------

ECFR_TITLES = (42, 45)  # Public Health (Medicare/Medicaid); Public Welfare (HIPAA, ACA)


async def ecfr(client: httpx.AsyncClient, since: date) -> list[Fetched]:
    """The current text of every section substantively amended since ``since``."""
    base = "https://www.ecfr.gov/api/versioner/v1"
    out = []
    for title in ECFR_TITLES:
        r = await client.get(f"{base}/versions/title-{title}.json",
                             params={"issue_date[gte]": since.isoformat()})
        r.raise_for_status()
        latest: dict[str, dict] = {}  # section identifier -> newest version
        for v in r.json()["content_versions"]:
            # a new issue_date alone can be a re-issue of an old amendment
            amended = v["substantive"] and not v["removed"] and v["amendment_date"] >= since.isoformat()
            newer = v["identifier"] not in latest or v["date"] > latest[v["identifier"]]["date"]
            if amended and newer:
                latest[v["identifier"]] = v
        for v in latest.values():
            x = await client.get(f"{base}/full/{v['date']}/title-{title}.xml",
                                 params={"part": v["part"], "section": v["identifier"]})
            if x.status_code == 404:  # date not yet published in full text
                continue
            x.raise_for_status()
            url = f"https://www.ecfr.gov/current/title-{title}/section-{v['identifier']}"
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
    changed = [n for n in r.json()["data"] if n["last_updated_sort"][:8] >= f"{since:%Y%m%d}"]
    out = []
    for n in changed:
        d = await client.get(f"{base}/data/ncd/",
                             params={"ncdid": n["document_id"], "ncdver": n["document_version"]})
        d.raise_for_status()
        url = ("https://www.cms.gov/medicare-coverage-database/view/ncd.aspx"
               f"?ncdid={n['document_id']}&ncdver={n['document_version']}")
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
    data = r.json()
    if r.status_code == 202 or data.get("apiKeyWarning"):
        raise RuntimeError(f"USPSTF rejected the API key: {data.get('apiKeyWarning')}")
    general = data["generalRecommendations"]
    out = []
    for rec in data["specificRecommendations"]:
        topic = general.get(str(rec.get("general")), {})
        url = f"https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/{topic.get('uspstfAlias', '')}"
        out.append(Fetched(_json({"recommendation": rec, "topic": topic}), "application/json", url))
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
    result = json.loads(r.text, strict=False)["esearchresult"]  # errors can hold control chars
    if "ERROR" in result:
        raise RuntimeError(f"PubMed esearch: {result['ERROR']}")
    ids = result["idlist"]
    out = []
    for i in range(0, len(ids), 200):
        x = await client.get(f"{_EUTILS}/efetch.fcgi", params={
            "db": "pubmed", "id": ",".join(ids[i:i + 200]), "retmode": "xml",
            "rettype": "abstract", **key,
        })
        x.raise_for_status()
        for article in ET.fromstring(x.content).iter("PubmedArticle"):
            pmid = article.findtext("MedlineCitation/PMID")
            out.append(Fetched(ET.tostring(article, encoding="utf-8"), "application/xml",
                               f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"))
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
