"""Fetch one small, bounded sample from each live endpoint into tests/fixtures/.

Run: uv run python scripts/capture_fixtures.py
Fixtures are what the provider served, with list-valued payloads cut to a few items and long
text bodies cut to 20 KB so files stay small; nothing else is altered. Date windows are
relative to today. USPSTF is captured only when USPSTF_API_KEY is set. The response models in
policy_radar/responses are built from, and tested against, these files.
"""

import asyncio
import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx

OUT = Path(__file__).resolve().parent.parent / "tests" / "fixtures"
FR = "https://www.federalregister.gov/api/v1"
ECFR = "https://www.ecfr.gov/api/versioner/v1"
CMS = "https://api.coverage.cms.gov/v1"
NOW = datetime.now(UTC)
RECENT = NOW - timedelta(days=30)
EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"


def save(name: str, content: bytes) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_bytes(content)
    print(f"{name}: {len(content)} bytes")


def save_json(name: str, body: dict, list_path: tuple[str, ...], keep: int = 3) -> None:
    node = body
    for k in list_path[:-1]:
        node = node[k]
    node[list_path[-1]] = node[list_path[-1]][:keep]
    save(name, json.dumps(body, indent=1, sort_keys=True).encode())


async def main() -> None:
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as c:
        for ep, name, field in (("drug/label", "openfda_drug_label", "effective_time"),
                                ("device/510k", "openfda_device_510k", "decision_date")):
            r = await c.get(f"https://api.fda.gov/{ep}.json",
                            params={"search": f"{field}:[{RECENT:%Y%m%d} TO {NOW:%Y%m%d}]",
                                    "sort": f"{field}:desc", "limit": 3})
            print(name, r.status_code)
            r.raise_for_status()
            save(f"{name}.json", r.content)

        r = await c.get(f"{FR}/documents.json", params={
            "conditions[agencies][]": ["centers-for-medicare-medicaid-services"],
            "conditions[type][]": ["RULE", "PRORULE"],
            "conditions[publication_date][gte]": RECENT.date().isoformat(),
            "fields[]": ["document_number", "html_url", "raw_text_url"],
            "order": "newest", "per_page": 3})
        r.raise_for_status()
        body = r.json()
        save("federal_register_list.json", r.content)
        t = await c.get(body["results"][0]["raw_text_url"])
        t.raise_for_status()
        save("federal_register_text.txt", t.content[:20000])

        r = await c.get(f"{ECFR}/versions/title-42.json", params={"issue_date[gte]": RECENT.date().isoformat()})
        r.raise_for_status()
        versions = r.json()
        save_json("ecfr_versions.json", versions, ("content_versions",), keep=5)
        v = next(x for x in versions["content_versions"] if x["substantive"] and not x["removed"])
        x = await c.get(f"{ECFR}/full/{v['date']}/title-42.xml",
                        params={"part": v["part"], "section": v["identifier"]})
        print("ecfr full", x.status_code)
        if x.status_code == 200:
            save("ecfr_section.xml", x.content[:20000])

        r = await c.get(f"{CMS}/reports/national-coverage-ncd/")
        r.raise_for_status()
        report = r.json()
        save_json("cms_ncd_report.json", report, ("data",), keep=3)
        n = report["data"][0]
        d = await c.get(f"{CMS}/data/ncd/",
                        params={"ncdid": n["document_id"], "ncdver": n["document_version"]})
        d.raise_for_status()
        save("cms_ncd_detail.json", d.content)

        r = await c.get(f"{EUTILS}/esearch.fcgi", params={
            "db": "pubmed", "term": '"practice guideline"[Publication Type]', "datetype": "mdat",
            "mindate": f"{RECENT:%Y/%m/%d}", "maxdate": f"{NOW:%Y/%m/%d}", "retmax": 3, "retmode": "json"})
        r.raise_for_status()
        save("pubmed_esearch.json", r.content)
        ids = json.loads(r.text, strict=False)["esearchresult"]["idlist"]
        x = await c.get(f"{EUTILS}/efetch.fcgi", params={
            "db": "pubmed", "id": ",".join(ids), "retmode": "xml", "rettype": "abstract"})
        x.raise_for_status()
        save("pubmed_efetch.xml", x.content)

        if key := os.environ.get("USPSTF_API_KEY"):
            u = await c.get("https://data.uspreventiveservicestaskforce.org/api/json",
                            params={"key": key})
            u.raise_for_status()
            save_json("uspstf.json", u.json(), ("specificRecommendations",), keep=3)
        else:
            print("USPSTF_API_KEY not set: skipping uspstf.json")


asyncio.run(main())
