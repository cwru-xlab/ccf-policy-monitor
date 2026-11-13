# Mapping Engine Spec

The mapping engine decides **which guidelines apply to which policy**. It is not the
conflict engine (`POST /conflicts`), which compares the criteria of one guideline with the
criteria of the policies already mapped to it.

Before this spec, mapping was manual only: a user uploaded guideline PDFs and linked them
to policies by hand in the browser. That had no discovery of guidelines from
authoritative bodies and no way to notice when a guideline changed. Manual upload and
manual linking stay; this spec adds an automated path next to them.

## What it does

1. **Discovery.** An agent reads one parsed policy, searches the web through Firecrawl, and
   proposes (a) guideline **authorities** (bodies such as USPSTF, ACOG, NCCN) and (b) specific
   **guideline URLs**, each with a rationale. Nothing is tracked until a user approves it.
2. **Approval.** Every proposed authority and every proposed (guideline URL, policy) pair is
   approved or rejected by a user. Approving a guideline fetches a snapshot of it into
   `source_document` (source key `web_discovery`), so the conflict engine can use it like an
   uploaded guideline. A rejected pair is never proposed again for that policy.
3. **Update detection.** Each approved, unpaused guideline URL is re-fetched; if its content
   changed materially, a `guideline_change` notification is recorded with a one-paragraph
   summary and the new snapshot. Notifications accumulate until marked read.
4. **Schedule.** One schedule (enabled, interval in hours) runs, in the API process:
   discovery again for every policy that has been through discovery, restricted to the
   approved authorities' domains and to recently published pages, then update detection.
   New proposals from scheduled runs wait in the same approval queue.

## Data model (db/schema.sql)

| Table | One row is | Key columns |
|---|---|---|
| `authority` | a publishing body, keyed by its web domain | `authority_id` (domain), `name`, `homepage_url`, `rationale`, `status` (`proposed`/`approved`/`rejected`) |
| `tracked_source` | one guideline URL | `source_id` (`sha256(url)[:16]`), `url`, `title`, `authority_id`, `paused`, `document_id` (current snapshot), `content_sha256` (of the last fetch), `last_checked_at`, `last_changed_at` |
| `source_mapping` | a guideline URL proposed for, or mapped to, one policy | (`source_id`, `policy_document_id`), `rationale`, `origin` (`discovery`/`scheduled`/`manual`), `status` (`proposed`/`approved`/`rejected`) |
| `guideline_change` | one detected material change of a tracked source | `source_id`, `previous_document_id`, `document_id`, `summary`, `detected_at`, `read_at` |
| `discovery_schedule` | the single schedule row | `enabled`, `interval_hours`, `last_run_at`, `next_run_at` |

A source is **tracked** when it has at least one approved mapping and is not paused. Approval
lives on the mapping, so one URL can apply to several policies. Policies are identified by
the id of their uploaded CPB document, the id the frontend already keeps.

## Components

| Module | Responsibility |
|---|---|
| `firecrawl.py` | `search(query, recent, domains)` and `scrape(url)` over Firecrawl's v2 REST API (`FIRECRAWL_API_KEY`) |
| `discovery.py` | The agent: a Bedrock Converse tool loop with tools `search_web`, `read_page`, `submit_proposals`; validates and stores proposals |
| `tracking.py` | Snapshot a URL into `source_document`, check tracked sources for changes, judge materiality with the LLM |
| `scheduler.py` | A background asyncio loop started at API startup that runs the scheduled job when `next_run_at` has passed |
| `mapping_api.py` | The `/mapping` routes below |

### Discovery agent

- Input: the policy's title, coverage effect, codes and criteria; the URLs already proposed,
  mapped or rejected for it (not to be proposed again); in scheduled mode, the approved
  authority domains.
- Tools: `search_web(query, recent_only)` returns up to 8 results (url, title, description);
  `read_page(url)` returns the first 6,000 characters of the page as Markdown;
  `submit_proposals(authorities, guidelines)` ends the run.
- Bounds: at most 12 model turns and 8 tool calls of each kind per run.
- Guards: a proposed guideline URL must have appeared in a search result or a read page in
  this run (no invented URLs); already known URLs are dropped; authorities are keyed by
  domain and an authority already approved or rejected keeps its status.
- Scheduled mode: searches are limited to approved authority domains and to the last month
  (`tbs=qdr:m`). With no approved authorities, scheduled discovery is skipped.

### Snapshots and change detection

- Only public http(s) URLs are fetched: localhost, `.local`/`.internal` names and non-global
  IP addresses are refused before Firecrawl or the direct PDF download sees them.
- A PDF URL is stored as the PDF bytes (so the in-app viewer and the existing extraction work);
  any other page is stored as Firecrawl's main-content Markdown, as `text/plain` (which
  parser.py reads). A `.pdf` URL is downloaded directly first, because Firecrawl bills PDF
  parsing per page; Firecrawl is the fallback when the site refuses a direct download.
- The content hash is over the stored bytes after collapsing whitespace for Markdown.
  Fetches use `maxAge=0` so Firecrawl's cache never hides a change.
- Same hash as the last fetch: only `last_checked_at` moves. Different hash: the LLM gets a
  unified diff of the current snapshot's text and the new text and returns
  `{material, summary}`.
- Material: the new snapshot is stored and becomes current, and a `guideline_change` is
  recorded. Not material (e.g. CMS re-rendering link text between fetches): nothing is stored;
  only the fetch's hash is kept, so the same noise is not sent to the LLM again, while later
  real edits are still diffed against the current snapshot. Storing every noisy fetch would
  also make `POST /guidelines/atomize` re-extract each one.

## API

| Method and path | Does |
|---|---|
| `POST /mapping/discover` `{policy_document_id}` | Start a discovery job (parses the policy first if needed). Returns `{job_id}` |
| `GET /mapping/proposals?status=&policy_document_id=` | Mappings with their source and authority |
| `POST /mapping/proposals/decide` `{source_id, policy_document_id, status}` | Approve (snapshots the source; returns its guideline `document_id`) or reject |
| `GET /mapping/authorities` / `POST /mapping/authorities/{id}/decide` `{status}` | List, approve, reject authorities |
| `GET /mapping/sources` | Tracked sources and the policies each is mapped to |
| `POST /mapping/sources` `{url, policy_document_id}` | Add a URL by hand (approved at once) |
| `PATCH /mapping/sources/{id}` `{paused}` / `DELETE /mapping/sources/{id}` | Pause or resume; stop tracking (its mappings become rejected) |
| `POST /mapping/check-updates` | Start an update-detection job |
| `GET /mapping/changes?unread_only=` / `POST /mapping/changes/{id}/read` | Notifications |
| `GET /mapping/schedule` / `PUT /mapping/schedule` `{enabled, interval_hours}` | Read or set the schedule |
| `POST /mapping/schedule/run` | Run the scheduled job now |

Jobs report through the existing `job` table (`kind` = `discover`, `check_updates`,
`scheduled_run`) and `GET /jobs/{id}`.

## Frontend

- **Document Mappings** page gets a `Manual | Automated` switch (from the dynamic-mapping
  prototype). Manual is unchanged. Automated: pick an uploaded policy, run discovery, then
  approve or reject each proposed authority and guideline. An approved guideline is added to
  the Guideline Database and linked to the policy exactly as a manual mapping would be, so
  review sessions and the conflict engine see it.
- A sub-page **Mapping Automation** (`/mappings/automation`) holds the schedule, the queue of
  pending proposals from scheduled runs, the tracked sources (pause, remove, add a URL), the
  authorities, and the update notifications. The mappings page shows the unread count.

## Not covered

- One schedule for all policies; no per-policy schedule.
- No authentication: decisions are not attributed to a user.
- A job running when the API process stops is left `running` (as for every job).
