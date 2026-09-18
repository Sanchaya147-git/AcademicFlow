# AcademicFlow

An AI-assisted execution intelligence layer connecting faculty/staff reports to academic plans, with explainable matching, human review, preserved evidence and audit history. Not an ERP, attendance system or faculty evaluation tool.

## Current status

The working tree contains FastAPI ingestion, extraction/matching providers, review,
authentication, analytics, SQLAlchemy models, migrations, synthetic seeds and a Next.js
workspace. These pre-existing additions are not yet verified through the complete
PostgreSQL/n8n/browser pipeline. The old Phase 0-only status was stale.

This increment adds text and Excel n8n workflows, routing/API contract tests and local
setup documentation. **Live n8n execution and PostgreSQL migration/seed verification
remain blocked in this environment.** See [development log](DEVELOPMENT_LOG.md) for
actual test results and [n8n instructions](n8n/README.md) for the pending runtime gate.

## Structure and technology

- `frontend/`: Next.js, TypeScript, Tailwind/shadcn, Recharts, TanStack Table.
- `backend/app/`: FastAPI, Pydantic, SQLAlchemy; API, security, extraction, matching and services.
- `database/migrations/`: Alembic migrations; PostgreSQL/pgvector is the target database.
- `n8n/workflows/`: orchestration only; business rules stay in FastAPI.
- `data/`: synthetic seed/sample data and ignored local uploads.
- `scripts/`: local environment and sample generators.
- `docs/`: architecture and phase guidance.

## Local setup

Use Python 3.11 and Node.js 22. Preserve any existing `.env`; never commit secrets.

```bash
cp .env.example .env  # only if .env does not already exist
# Fill database credentials/URL, JWT_SECRET (32+ random characters),
# SEED_ADMIN_PASSWORD and N8N_ENCRYPTION_KEY.
# Alternatively scripts/init_env.py generates local secrets when .env is absent.
python3.11 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
(cd frontend && npm ci)
docker compose up -d postgres n8n
make migrate
make seed
make sample
```

`DATABASE_URL` must agree with the configured PostgreSQL user/password/port/database.
There are no default database passwords. Migrations enable pgvector. `make seed` indexes
the synthetic plan: configure `OPENAI_API_KEY` for real AI or explicitly select
`AI_PROVIDER=demo` for the offline lexical demonstration provider. Demo mode is not
semantic/OpenAI validation. Historical metrics must not be presented as real institution data.

Start in separate terminals:

```bash
make backend   # http://localhost:8000; API documentation at /docs
make frontend  # http://localhost:3000
curl --fail http://localhost:8000/health
```

For Docker n8n to reach the backend, use the host-reachable binding described in
[n8n/README.md](n8n/README.md) instead of `make backend`'s loopback-only binding.
Keep this local prototype behind a trusted-machine firewall.

Sign in using `SEED_ADMIN_EMAIL` and your configured `SEED_ADMIN_PASSWORD`.
Create scoped faculty/coordinator accounts through the administrator API as needed.
n8n has its own owner-account setup at http://localhost:5678; there is no default login.
Import the two workflow JSON files and follow the text/Excel webhook examples in its README.

## Environment

[`.env.example`](.env.example) documents the full configuration:

- Database: `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `DATABASE_PORT`.
- Security/UI: `JWT_SECRET`, `TOKEN_MINUTES`, `COOKIE_SECURE`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`.
- Seed account: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
- AI: `AI_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`.
- Confidence: `AUTO_LINK_THRESHOLD=0.90`, `HUMAN_REVIEW_THRESHOLD=0.50` (fractions).
- Ingestion: `MAX_UPLOAD_BYTES`.
- Orchestration: `N8N_BASE_URL`, `N8N_ENCRYPTION_KEY`, `FASTAPI_BASE_URL`.
- S3/AWS settings and `N8N_WEBHOOK_URL` are reserved, not a claim of implemented deployment/integration.

Missing extraction fields stay null. The short linked-list example cannot guarantee
90% confidence under the conservative missing-signal policy. n8n trusts the backend's
decision, not rounded display percentages, and does not repeat schedule/audit writes.

## Verification

```bash
make test
make lint
# Export structure, real routing JavaScript and mocked-provider API sequence checks:
(cd backend && .venv/bin/python -m pytest tests/test_n8n_contract.py -q)
make format  # modifies files; use only when intending to format
```

Backend tests use SQLite/deterministic providers, not real pgvector/OpenAI.
Frontend lint/type checks do not establish browser/E2E correctness. Do not call the
complete demo verified until migrations, seeds, both n8n webhooks and browser review
paths have been exercised against running services.

See [architecture](docs/ARCHITECTURE.md) and [project rules](AGENTS.md).
