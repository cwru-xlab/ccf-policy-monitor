# Policy Radar

Backend for finding payer policies (CPBs) that may need review after a clinical guideline
changes. This version ingests guidelines from public APIs, parses uploaded CPBs, and stores
both as criteria in Postgres + pgvector. Matching a guideline change to policies is not built
yet.

- **Backend spec:** [docs/BACKEND_SPEC.md](docs/BACKEND_SPEC.md) (PDF:
  [docs/BACKEND_SPEC.pdf](docs/BACKEND_SPEC.pdf)) — tables, keys, object storage, pipelines, API.
- **Ingestion spec:** [docs/INGESTION_SPEC.md](docs/INGESTION_SPEC.md) — what each provider returns and the pydantic model that validates it.
- **Frontend spec:** [docs/FRONTEND_SPEC.md](docs/FRONTEND_SPEC.md) — proposed review UI.

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
```

## Development

```bash
uv run pytest                  # offline: models, connectors against captured fixtures
uv run pytest -m live          # real requests to the keyless endpoints, 3 records each
uv run python scripts/capture_fixtures.py   # re-capture tests/fixtures from the live APIs
uv run ruff check .
```

Re-render the spec PDF after editing the spec:

```bash
cd docs && pandoc BACKEND_SPEC.md -o BACKEND_SPEC.pdf --pdf-engine=weasyprint --css pdf.css
```
