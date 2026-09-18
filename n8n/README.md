# AcademicFlow n8n orchestration (local MVP)

## Responsibility

Import `workflows/academicflow_text_ingestion.json` and
`workflows/academicflow_excel_ingestion.json`. They are inactive by default.

Each workflow performs:

1. Receive a POST webhook, retaining the caller's Authorization header.
2. Call FastAPI text or spreadsheet ingestion. FastAPI validates content and ownership.
3. Call extraction (for Excel, returns already parsed events without an LLM call).
4. Split the extraction response and match **every** event.
5. Group results by the backend's `AUTO_LINK`, `HUMAN_REVIEW`, or `UNMATCHED` decision.
6. Return one JSON response, including spreadsheet validation errors and all candidates.

Grouping routes results without additional mutation calls. Linking, schedule updates,
review-queue persistence, and audit writes already happen transactionally in FastAPI's
matching service. n8n must not apply them a second time. There are no copied confidence
thresholds. Empty extraction returns zero matched events. Unknown decisions fail closed.

## Start and import

- Configure the root `.env` from `.env.example`; do not overwrite an existing file.
- Set a random `N8N_ENCRYPTION_KEY` and the database credentials required by Compose.
- `docker compose up -d postgres n8n`
- Open http://localhost:5678 and create the local n8n owner account. There are **no**
  default `admin/admin` credentials. Import both workflow JSON files via the editor.
- Start FastAPI, migrate, and seed as documented in the root README.
- For Docker n8n, FastAPI must listen on an interface reachable from the container,
  e.g. `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000`.
  Keep the machine firewall restricted to your trusted local environment.
- Publish/activate workflows for `/webhook/...`, or click **Listen for test event**
  and use `/webhook-test/...` for a single test invocation.

Environment:

| Variable | Purpose |
| --- | --- |
| `N8N_BASE_URL` | External local webhook base, default `http://localhost:5678` |
| `FASTAPI_BASE_URL` | Backend URL visible from n8n; Docker: `http://host.docker.internal:8000`; native: `http://localhost:8000` |
| `N8N_ENCRYPTION_KEY` | Random persistent n8n encryption secret |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` | Compose permits HTTP nodes to read the backend URL |

Only trusted local administrators should edit workflows: environment access is enabled.
The workflows forward the caller's short-lived FastAPI JWT on **every** API request.
No privileged shared service credential or OpenAI key is stored in the exports.
FastAPI validates JWT, role, ownership and department scope; a spoofed `submitted_by`
is rejected. These webhooks are local-only, not a production public gateway.

## Test text and Excel

Sign in through `POST /api/auth/login` with a seeded account. Put the returned
`access_token` into your shell without committing it or pasting it into a workflow:

```bash
read -rs -p 'FastAPI access token: ' AF_TOKEN; echo
export N8N_BASE_URL=http://localhost:5678
curl --fail-with-body "$N8N_BASE_URL/webhook/academicflow/text" \
  -H "Authorization: Bearer $AF_TOKEN" -H 'Content-Type: application/json' \
  -d '{"source_type":"FREE_TEXT","content":"Finished linked lists today for CSE-C."}'

# Run `make sample` from the repository root if the sample is missing.
curl --fail-with-body "$N8N_BASE_URL/webhook/academicflow/excel" \
  -H "Authorization: Bearer $AF_TOKEN" \
  -F 'file=@data/samples/sample_faculty_reports.xlsx'
unset AF_TOKEN
```

Use multipart field **file**, once, for Excel. Do not manually set its Content-Type
boundary. The exported Webhook preserves the multipart field name as binary `file`.
Do not enable a custom binary-field prefix in the Webhook node.

Response fields: `report_id`, `ingestion` (including Excel row counts/errors),
`matched_events`, and `routes` with three arrays of complete matching responses.
Candidates retain confidence, explanations and source event IDs. An incomplete linked
list report is **not guaranteed to auto-link**: the existing conservative scoring policy
leaves missing course/department signals at zero. Never add invented fields to force it.

## Failure, retry and privacy limits

- HTTP nodes stop on backend errors and have a 120-second request timeout. A failed
  workflow must not be treated as a successful ingestion. Native n8n errors may not
  preserve the backend's HTTP status/body in the webhook response.
- Automatic workflow retries are intentionally disabled: report creation does not yet
  support an idempotency key. Resubmitting the webhook creates another report.
- After partial failure, find the preserved report in `/api/reports` and resume
  extraction/matching via its IDs instead of resubmitting. Earlier events may already
  have committed. Multi-event processing is not one cross-request transaction.
- JWT expiry can interrupt a long spreadsheet run. Obtain a new token to resume.
- Successful/error execution persistence and manual execution saving are disabled in
  exports because webhook input contains bearer tokens and source evidence. Tokens
  remain visible during editor execution; use only trusted local access. Compose also
  prunes executions after 24 hours. FastAPI, not n8n execution history, owns the audit.
- No notifications, durable background jobs, public ingress hardening or automatic
  workflow recovery are claimed in this phase.

## Verification status

`cd backend && .venv/bin/python -m pytest tests/test_n8n_contract.py -q`
checks exports, executes their actual JavaScript routing code with Node, and exercises
text/Excel API sequences using deterministic providers and SQLite. This is **not**
pgvector testing or proof of execution inside n8n.

Live validation is pending: Docker is unavailable in this WSL environment. Installed
host n8n reports 2.12.3 (Compose pins 2.0.3), but an isolated CLI import timed out after
120 seconds. Verify both imports and the curl paths above before calling this phase
runtime-verified or proceeding to the end-to-end demo gate.
