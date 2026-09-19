# Development log

## Phase 0 — repository inspection and architecture

### Completed
- Inspected existing source, dependency manifests, local instructions, tests, environment template, Compose, and PRD. Initial Git working tree was clean.
- Preserved FastAPI health endpoint, configuration layout, Next.js starter, and existing directories. No application features added.
- Added root AGENTS.md and docs/ARCHITECTURE.md with module ownership, data invariants, security rules, confidence caveats, and phase gates.
- Added explicit implementation status to README. Replaced example credential-like values with blanks; documented future variables as not implemented. Extended ignore rules for secrets/uploads/generated files.

### Current architecture
Backend: FastAPI with Pydantic settings in app/config.py, explicit frontend CORS, GET /health, one health test. SQLAlchemy dependencies exist but no models/sessions/migrations. Frontend: Next.js App Router, TypeScript, Tailwind and shadcn button/landing page. Compose describes pgvector PostgreSQL and n8n; no workflow exports. See architecture document for proposed modules.

### Environment
Node v22.22.3; npm 10.9.8. System Python 3.14.7 has no pytest; existing backend/.venv uses Python 3.11.15 with dependencies installed. PostgreSQL client 18.4 exists; pg_isready reports no local server. Docker unavailable in this WSL distro. Existing frontend dependencies are installed.

Current consumed settings: APP_ENV, APP_PORT, FRONTEND_URL, DATABASE_URL (connection not yet used). Compose additionally uses DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME, DATABASE_PORT and legacy N8N_BASIC_AUTH_* variables. Other .env.example variables document planned integrations only. APP_PORT does not override uvicorn CLI arguments.

### Verification and exact commands
- `python3 -m pytest backend/tests -q`: failed because system Python lacks pytest. Correct interpreter and working directory used below; no dependency bypass.
- `cd backend && .venv/bin/python -m pytest -q`: **1 passed**. Existing pytest-asyncio fixture-scope warning and multipart deprecation warning remain.
- `cd frontend && npm run lint`: **passed** on rerun with 240-second timeout. Initial combined lint/type-check command timed out at 120 seconds.
- `cd frontend && ./node_modules/.bin/tsc --noEmit --incremental false`: **passed**.
- Started `cd backend && .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010`; polled `curl -fsS http://127.0.0.1:8010/health`: **200**, `{"status":"ok"}`. Temporary server stopped afterward.
- `docker --version`: unavailable; `pg_isready`: no response. Database/n8n tests not possible.
- Frontend browser/startup/build and E2E are not verified in Phase 0. No frontend test suite exists yet.

### Known issues and next steps
1. Phase 1: remove hard-coded database credential defaults from app/config.py and Compose; require environment configuration without requiring database access for liveness tests.
2. Review/pin n8n image and supported owner authentication; README's inherited default basic-auth claim is not verified. Restrict local service bindings.
3. Standardize Python 3.11 setup, dependency compatibility/security review, formatting, lint/type commands, and test configuration. Do not assume current pinned packages support system Python 3.14.
4. Enable Docker Desktop WSL integration or supply a real local PostgreSQL/pgvector service before Phase 2 migrations and seed tests.
5. Resolve missing-signal confidence policy before Phase 5: supplied formula does not guarantee 90% for the incomplete linked-lists example. Never invent extraction context to satisfy the demo.
6. Add foundation frontend smoke verification in Phase 1; implement no extraction or matching yet.

Phase 0 is complete as inspection/documentation, not as implementation of later phases. Await Phase 1 authorization.

## Continuation — Phase 6 orchestration increment

### Inspection and scope
- On resuming, the working tree already contained extensive uncommitted models,
  migrations, seed data, backend providers/services/tests and frontend workspace changes.
  Preserved these rather than regenerating them. The Phase 0-only README/log were stale.
- Baseline: 19 backend tests passed; backend Ruff passed. No nested n8n/backend rules
  were found. Frontend files were not changed.
- Selected the missing n8n phase as one bounded increment. Later phase code being present
  does not establish that its PostgreSQL, security, browser or end-to-end gates are complete.

### Added
- Inactive text and Excel n8n exports: ingest → extract → split all events → match →
  route/group backend decisions → respond once. Empty extraction is handled; unknown
  decisions fail rather than inventing a result. Spreadsheet row errors are returned.
- Forwarded caller JWT on every backend call; no shared administrator credential.
  Backend remains responsible for permissions, confidence, transactional links/schedule/audit.
- Disabled persisted workflow execution data and automatic request retries; documented
  partial commits, token expiry, privacy and report-creation idempotency limitations.
- Configurable Compose FASTAPI_BASE_URL, with Docker-host default documented in .env.example.
- n8n setup/test instructions and refreshed README/architecture status. Existing .gitignore
  already excludes local n8n state, credentials and uploads; no change was needed.
- Eight regression/contract tests covering both exports, JavaScript routing, multi-row
  Excel/text API sequences, absent auth and repository configuration paths.

### Verification / exact commands
- `cd backend && .venv/bin/python -m pytest -q`: **27 passed** (including 8 new tests).
  SQLite and deterministic providers only; not PostgreSQL/pgvector validation.
- `cd backend && .venv/bin/ruff check app tests`: **passed**.
- `backend/.venv/bin/ruff format backend/tests/test_n8n_contract.py`: formatted the new file;
  `cd backend && .venv/bin/ruff format --check tests/test_n8n_contract.py`: **passed**.
- `cd frontend && npm run lint && npm run typecheck`: **passed**, with one existing
  `react-hooks/incompatible-library` warning for TanStack useReactTable. No lint errors.
- Started `.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010` from
  backend and requested `/health`: **200 {"status":"ok"}**; stopped the temporary server.
  First smoke attempt's 10-second startup budget timed out; rerun with 60 seconds passed.
- `docker version`: Docker WSL integration unavailable.
- `n8n --version`: **2.12.3** from host npm installation; Compose pins **2.0.3**.
- `N8N_USER_FOLDER=$(mktemp -d /tmp/academicflow-n8n-check-XXXXXX) N8N_DIAGNOSTICS_ENABLED=false n8n import:workflow --input=/mnt/d/vibe/AcademicFlow/n8n/workflows/academicflow_text_ingestion.json`:
  **timed out at 120 seconds**. CLI help also timed out at 30 seconds. No live import
  or webhook execution is claimed. Inspected installed node definitions for binary
  multipart field handling and Split Out parameters; this is not runtime verification.

### Errors resolved during this increment
- Initial test import used `test_workflows` instead of `tests.test_workflows`; fixed
  the package import and reran successfully.
- An attempted configuration root-path change was incorrect. The new regression test
  caught it; reverted the change. The original `parents[2]` correctly resolves root .env
  and uploads. There is no net configuration-path change.
- New test formatting check initially failed; formatted only the new file, then passed.

### Gate / next steps
Phase 6 files and contract checks are implemented; its live-runtime gate remains OPEN.
Enable Docker Desktop WSL integration (or provide working native services), migrate/seed
PostgreSQL, import both workflows into the pinned n8n version, and test authenticated text,
Excel, empty/error and multi-event paths using n8n/README.md. Do not call the full demo
complete or advance blindly past this blocker. Existing later-phase code still needs its
own validation, including browser tests, production build and PostgreSQL concurrency.

## Local teacher authentication setup
- Restarted the existing PostgreSQL 18 cluster at `/tmp/academicflow-pgdata` on
  `127.0.0.1:5439`, preserving its existing schema/data. Initial start lacked its
  custom port/socket options; corrected with `pg_ctl -o '-p 5439 -h 127.0.0.1
  -k /tmp -c extension_control_path=/tmp/academicflow-pgdev'`.
- Created the user-requested local test teacher with FACULTY role and CSE scope,
  using the existing scrypt password hashing. Recorded USER_CREATED in the same
  database transaction with local CLI provenance. No password/token added to files.
- Verified live POST `/api/auth/login` and authenticated GET `/api/auth/me`: both
  HTTP 200. This confirms the existing local PostgreSQL/auth path, not full n8n E2E.
- The database resides under `/tmp`; do not treat it as durable production storage.

## Local login account update — sanchaya123
- Restarted the local PostgreSQL cluster at `/tmp/academicflow-pgdata` on `127.0.0.1:5439` with the existing custom extension path.
- Added local FACULTY/CSE login `sanchaya123` using the existing scrypt password hashing and recorded an audit row in the same transaction. No password/token was added to project files.
- Verified live POST `/api/auth/login` and authenticated GET `/api/auth/me`: both returned HTTP 200 for this account.
