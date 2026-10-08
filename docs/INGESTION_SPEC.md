---
title: Policy Radar — Ingestion Spec v0
---

# Policy Radar — Ingestion Spec v0

Status: **implemented; keyless endpoints verified against live responses on 2026-10-08.**
Scope: the shape of what each guideline provider returns, the pydantic model that validates
it, and how the connectors use those models. The tables, object storage and pipelines stay in
[BACKEND_SPEC.md](BACKEND_SPEC.md); this file is the detail behind its
"Guideline sources" section. Code: `policy_radar/sources.py` (connectors),
`policy_radar/responses/` (models), `tests/fixtures/` (captured payloads).

## Principles

1. **Validate, don't transform.** A connector validates each response with its model, then
   stores the provider's own bytes (`Fetched.content` comes from the raw record, never from
   `model_dump`). Change detection is a hash of those bytes, so re-serialising would create
   false changes.
2. **Fail loudly on shape drift.** A missing or mistyped field we depend on raises
   `ValidationError`, which the ingest job records. Unknown fields do not: provider models
   use `extra="allow"` and are frozen. (Our own models in `models.py` keep `extra="forbid"`.)
3. **Type only what we use.** Ids, dates, URLs, flags and pagination. openFDA labels have
   hundreds of optional section fields; they are kept as extras, not modelled.
4. **Dates are parsed explicitly.** `YYYYMMDD` and `YYYYMMDDhhmmss` go through
   `compact_date`, because pydantic would read a digits-only string as a Unix timestamp.
5. **The data model is untouched.** These models describe provider responses. Mapping a
   response into `Guideline` and `Policy` is atomization (`llm.py`), not ingestion.

## Access

| Class | Keys | Endpoints |
|---|---|---|
| Keyless | `federal_register`, `ecfr`, `cms_coverage` | no key exists |
| Free key, optional | `openfda_drug_label`, `openfda_device_510k`, `pubmed` | work without one; a key raises the rate limit |
| Free key, required | `uspstf` | by request to AHRQ; **not yet exercised against real data** |
| Scraped page | `cdc_acip_adult`, `cdc_acip_child` | no API, no model; bytes are the page |

## Models

All in `policy_radar/responses/`, one module per provider. "Typed" lists the fields the
model requires or reads; every other field the provider sends is kept in `model_extra`.

### openFDA — `openfda.py`

`GET https://api.fda.gov/{drug/label|device/510k}.json?search=<date field>:[YYYYMMDD TO YYYYMMDD]&sort=<field>:desc&limit=1000`.
"No matches" is HTTP **404**, not an empty page. Max 1,000 per page; the connector takes one
page and logs when `meta.results.total` exceeds the cap.

| Model | Typed fields |
|---|---|
| `DrugLabelPage` | `meta` (`last_updated`, `results.{skip, limit, total}`), `results` |
| `DrugLabel` | `set_id`, `id`, `version`, `effective_time` (`YYYYMMDD`), `indications_and_usage`, `dosage_and_administration`, `warnings` (lists of text) |
| `Device510kPage` | same envelope |
| `Device510k` | `k_number`, `decision_date` (ISO), `date_received`, `device_name`, `applicant`, `decision_code`, `clearance_type`, `statement_or_summary` |

Observed `device/510k` record fields (24): `address_1`, `address_2`, `advisory_committee`,
`advisory_committee_description`, `applicant`, `city`, `clearance_type`, `contact`,
`country_code`, `date_received`, `decision_code`, `decision_date`, `decision_description`,
`device_name`, `expedited_review_flag`, `k_number`, `openfda`, `postal_code`,
`product_code`, `review_advisory_committee`, `state`, `statement_or_summary`,
`third_party_flag`, `zip_code`. Label records vary: sampled ones hold 14 to 100+ fields
(`openfda`, `purpose`, `warnings`, `package_label_principal_display_panel`, ...).

### Federal Register — `federal_register.py`

`GET https://www.federalregister.gov/api/v1/documents.json` with agencies HHS, CMS, FDA,
types `RULE` and `PRORULE`, `fields[]=document_number,html_url,raw_text_url`. Pages through
`next_page_url`.

| Model | Typed fields |
|---|---|
| `DocumentList` | `count` (0 if absent), `total_pages`, `next_page_url`, `results` (empty if the key is absent) |
| `Document` | `document_number`, `html_url`, `raw_text_url` |

Quirks: an empty result has **no** `results` or `total_pages` key. `raw_text_url` is served as
`text/plain` but the body is an HTML page wrapping a `<pre>`; it is stored as served and not
modelled. The listing carries no title or date, so those are not available without a wider
`fields[]`.

### eCFR — `ecfr.py`

`GET https://www.ecfr.gov/api/versioner/v1/versions/title-{42|45}.json?issue_date[gte]=…&page=N`,
then `…/full/{date}/title-N.xml?part=…&section=…` for section text (XML, stored as served).

| Model | Typed fields |
|---|---|
| `VersionList` | `meta`, `content_versions` |
| `Meta` | `title`, `result_count`, `latest_amendment_date`, `latest_issue_date`, `page` (default 1), `per_page`, `total_pages` (default 1) |
| `Version` | `identifier` (section number), `part`, `date`, `amendment_date`, `issue_date` (ISO), `substantive`, `removed`, `name`, `subpart`, `type` |

Quirk: **paginated at 1,000** (`total_pages` was 9 for title 42 since 2020). `page`,
`per_page` and `total_pages` are absent when everything fits on one page. The connector reads
every page; before 2026-10-08 it read only the first and silently dropped the rest.

### CMS Coverage — `cms_coverage.py`

`GET https://api.coverage.cms.gov/v1/reports/national-coverage-ncd/` (all NCDs), then
`GET …/data/ncd/?ncdid=&ncdver=` per changed NCD. LCDs need a license-bound token and are not
ingested.

| Model | Typed fields |
|---|---|
| `NcdReport` / `NcdRow` | `document_id` (int), `document_version`, `document_display_id` (`"100.3"`), `title`, `last_updated_sort` (`YYYYMMDDhhmmss`), `document_type`, `chapter` |
| `NcdDetail` / `Ncd` | `document_id` (**string** here), `document_version`, `document_display_id`, `title`, `effective_date`, `effective_end_date`, `implementation_date`, `benefit_category`, `item_service_description`, `indications_limitations` |

Quirks: ids are int in the report and string in the detail. Date fields hold `MM/DD/YYYY`,
`""`, `"N/A"` or, for old NCDs, a sentence ("…the effective date is not available"); `MdyDate`
turns every non-date into `None`. Body text is HTML-escaped twice (`&lt;p&gt;`), so it needs
unescaping before use. Of 345 NCDs, 9 of the first 60 had free text in `effective_date`.

### PubMed — `pubmed.py`

`GET …/entrez/eutils/esearch.fcgi?db=pubmed&term="practice guideline"[Publication Type]&datetype=mdat&mindate=…&maxdate=…&retmode=json`,
then `efetch.fcgi?db=pubmed&id=…&retmode=xml&rettype=abstract` in batches of 200.

| Model | Typed fields |
|---|---|
| `ESearchResponse` / `ESearchResult` | `count`, `idlist`, `error` (the `ERROR` key) |
| `Article` (parsed from one `<PubmedArticle>`) | `pmid`, `title`, `publication_types`, `date_revised`, `journal`, `doi` |

Quirks: errors arrive with HTTP 200 in `esearchresult.ERROR`, and the body can hold control
characters (`json.loads(strict=False)`). A malformed term does not error: PubMed falls back to
an all-fields search. `ArticleTitle` can contain inline markup, so the title is read with
`itertext`. The stored document is the `<PubmedArticle>` element, not the whole response.
The abstract, not the full guideline, is what PubMed provides.

### USPSTF — `uspstf.py`

`GET https://data.uspreventiveservicestaskforce.org/api/json?key=…`.

| Model | Typed fields |
|---|---|
| `Response` | `apiKeyWarning`, `specificRecommendations`, `generalRecommendations` (dict keyed by id) |
| `SpecificRecommendation` | `id`, `general` (string key into `generalRecommendations`), `title`, `grade`, `text`, `rationale` |
| `GeneralRecommendation` | `uspstfAlias` (page slug), `title`, `topicYear` |

**Unverified against real content.** No key was available. The model is built from the API's
reply to a bad key: HTTP **202** with every text field replaced by `apiKeyWarning`, captured as
`tests/fixtures/uspstf_nokey_placeholder.json`. The connector treats a 202 or a non-empty
`apiKeyWarning` as a rejected key. Once a key exists: run `scripts/capture_fixtures.py` with it,
check `grade` against `StrengthSystem.uspstf` (A, B, C, D, I) and tighten types.

## Connector behaviour

| Key | Cap | Pagination | Notes |
|---|---|---|---|
| `openfda_*` | 1,000 (also the API max) | none; one page | 404 means no matches |
| `federal_register` | 1,000 | follows `next_page_url`; one extra request per document | |
| `ecfr` | 1,000 sections per title | all `total_pages` of the version list; one extra request per section | 404 on a section's text is skipped |
| `cms_coverage` | 1,000 | none; one extra request per changed NCD | |
| `pubmed` | 1,000 | none; efetch in batches of 200 | |
| `uspstf` | all | none; `since` is ignored | needs a key |

## Testing

| Suite | Command | What it proves |
|---|---|---|
| Models | `pytest tests/test_responses.py` | each model parses its captured payload; bad dates and missing required fields fail; extras are kept |
| Connectors, offline | `pytest tests/test_sources.py` | request building, filtering, pagination, bytes stored as served, error handling, against fixtures through `httpx.MockTransport` |
| Connectors, live | `pytest -m live` | real requests to the keyless endpoints, capped at 3 records, through the real models. Deselected by default. `uspstf` skips without `USPSTF_API_KEY` |

Re-capture fixtures with `python scripts/capture_fixtures.py` (payloads are cut to a few
records; nothing else is altered).

Verified on 2026-10-08, beyond the fixtures: 1,000 openFDA labels and 1,000 510(k)s, three
pages of eCFR titles 42 and 45, all 345 CMS NCDs and their detail records, 214 Federal
Register rules, and 200 PubMed articles all validated.

## Open points

- **USPSTF** is unverified; see above.
- **Federal Register `raw_text_url`** returns an HTML page labelled `text/plain`. Atomization
  treats it as text today; stripping the wrapper is a decision for the atomize step.
- **CMS body text** is double HTML-escaped; unescape before sending to the LLM.
- **eCFR volume**: a first run with a long `since` can hit 9+ pages and the 1,000-section cap
  per title, and each section is a separate request.
- **PubMed** returns abstracts only; full-text guidelines are on publisher sites.
