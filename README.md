# ccf-policy-monitor

Monitors external clinical guidelines to detect relevant changes and recommend medical policy revisions for human-in-the-loop review.

- `policy_radar/` — Python backend (below). `frontend/` — Vite + React review UI.

## Policy Radar backend

Backend for finding payer policies (CPBs) that may need review after a clinical guideline
changes. This version ingests guidelines from public APIs, parses uploaded CPBs, and stores
both as criteria in Postgres + pgvector. Matching a guideline change to policies is not built
yet.

- **Backend spec:** [docs/BACKEND_SPEC.md](docs/BACKEND_SPEC.md) (PDF:
  [docs/BACKEND_SPEC.pdf](docs/BACKEND_SPEC.pdf)) — tables, keys, object storage, pipelines, API.
- **Ingestion spec:** [docs/INGESTION_SPEC.md](docs/INGESTION_SPEC.md) — what each provider returns and the pydantic model that validates it.
- **Frontend spec:** [docs/FRONTEND_SPEC.md](docs/FRONTEND_SPEC.md) — proposed review UI.
- **Mapping engine spec:** [docs/MAPPING_ENGINE_SPEC.md](docs/MAPPING_ENGINE_SPEC.md) — agentic guideline discovery (Firecrawl), approvals, update tracking and the schedule.

## Setup

```bash
cp example.env .env                      # then fill in DATABASE_URL and OPENAI_API_KEY
uv sync
uv run python scripts/create_schema.py   # or paste db/schema.sql into the Supabase SQL editor
uv run uvicorn policy_radar.api:app --reload
```

Then, for example:

```bash
curl -X POST localhost:8000/guidelines/ingest/federal_register
curl -X POST localhost:8000/guidelines/atomize
curl -F files=@cpb_0584.pdf localhost:8000/policies/documents
curl -X POST localhost:8000/policies/parse
curl localhost:8000/jobs/<job_id>

# mapping engine (needs FIRECRAWL_API_KEY)
curl -X POST localhost:8000/mapping/discover -H 'Content-Type: application/json' \
     -d '{"policy_document_id": "cpb_upload-<sha16>"}'
curl 'localhost:8000/mapping/proposals?status=proposed'
```

## Deploying the frontend to Vercel

Vercel builds `frontend/` and serves that static app. Dynamic mapping runs in the Python API, which is a separate long-lived process (`uvicorn policy_radar.api:app`). Requests from the deployed site to `/api/...` are proxied to that process.

1. On the API host, set `DATABASE_URL`, the Bedrock credentials, and `FIRECRAWL_API_KEY`, then restart the process. Settings are read at startup. Apply `db/schema.sql` to that database (`uv run python scripts/create_schema.py`). A Firecrawl key saved on the Vercel project never reaches this process.
2. On the Vercel project, set `API_ORIGIN` to the API origin with no path, for example `https://your-api.example.com`, and redeploy. The value is the same host you would curl for `/health`.
3. Optional: set `VITE_API_URL` to that origin at build time to skip the proxy. The API allows browser calls (`CORS_ORIGINS`, default `*`).

The proxy returns as soon as the API does. Discovery still runs in the API process after `POST /mapping/discover` answers, so that process has to stay up for the whole search. Approving a guideline waits on the proxy until the API finishes fetching it; a short host timeout can cut off that wait. The search itself is not one of those waits.

## Development

```bash
uv run pytest                  # offline: models, connectors against captured fixtures
# mapping-engine API tests also run against a disposable Postgres+pgvector database:
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/policy_radar uv run pytest
uv run pytest -m live          # real requests to the keyless endpoints, 3 records each
uv run python scripts/capture_fixtures.py   # re-capture tests/fixtures from the live APIs
uv run ruff check .
```

Re-render the spec PDF after editing the spec:

```bash
cd docs && pandoc BACKEND_SPEC.md -o BACKEND_SPEC.pdf --pdf-engine=weasyprint --css pdf.css
```
