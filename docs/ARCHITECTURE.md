# AcademicFlow architecture — Phase 0 proposal

## Scope and ownership
AcademicFlow connects reported academic execution to institutional plans. It is not an ERP, attendance system, timetable generator, faculty evaluation system, or chatbot. Build locally first; AWS deployment and voice processing come later.

Pipeline: report → input validation → extraction → normalization → embeddings → pgvector candidates → domain rules and confidence → auto-link / review / unmatched → schedule synchronization and audit → analytics.

FastAPI owns validation, business rules, persistence, authorization, and AI integrations. n8n orchestrates API calls, never duplicates confidence or update logic. Next.js presents real API data and human decisions. PostgreSQL is the source of truth; object storage preserves original uploads.

## Proposed structure (retain existing repository root)
- `frontend/app/`: routes and responsive layouts; `components/`, `lib/`, `types/`, `hooks/`: reusable UI, API client, types, hooks.
- `backend/app/api/`: thin routers and dependencies.
- `backend/app/config.py`: existing configuration entry point; retain rather than relocate unnecessarily.
- `backend/app/core/`: security and shared infrastructure.
- `backend/app/db/`, `models/`, `schemas/`: sessions, SQLAlchemy entities, Pydantic contracts.
- `backend/app/services/`: ingestion, review, synchronization, audit, analytics.
- `backend/app/extraction/`: provider abstraction, prompts, validated extraction.
- `backend/app/matching/`: embeddings, retrieval, rules, scoring, explanations.
- `backend/tests/`: deterministic unit tests and real PostgreSQL integration tests.
- `database/migrations/`: Alembic; preserve the existing database directory.
- `data/seed/`, `data/samples/`, `data/uploads/`: synthetic fixtures and ignored local uploads.
- `n8n/workflows/`, `docs/`, `scripts/`: orchestration, documentation, developer commands.

These are planned modules, not a claim that functionality exists.

## Data and trust rules
Use UUID primary keys and unique human-readable plan/report identifiers. Preserve the semester → department → course → unit → activity → executable session hierarchy. Reports retain original content and file metadata. Extracted events retain exact source evidence and nullable missing fields. An explicit execution/activity link table supports many-to-many relationships. Matches retain candidates, signal scores, explanations, and decision provenance. Audit records retain actor, timestamps, and before/after state.

Linking, schedule updates, and audit writes must be one transaction. Retries must not duplicate events or links. Review must protect against concurrent or stale decisions. Multiple partial executions must not blindly sum completion percentages or overwrite previous evidence. Define aggregation semantics before synchronization implementation.

Extraction is separate from matching. Do not infer course from topic. Resolve relative dates only from explicit report metadata; a yearless date must not invent a year. Provider mocks are test-only and clearly identified.

## Confidence policy
Configurable MVP defaults: score >= 0.90 auto-links; 0.50 <= score < 0.90 enters review; score < 0.50 remains unmatched. Route on unrounded scores; display percentages. Preserve all unmatched events, including when retrieval returns no candidates.

Proposed baseline: 0.55 semantic + 0.20 course + 0.10 department + 0.10 class + 0.05 context. Record missing signals separately from contradictory signals. Contradictions must prevent unsafe auto-linking. Fuzzy/unit/faculty signals must not silently double-count evidence. Ambiguous competing candidates require review.

**Open design decision before Phase 5:** “Finished linked lists today for CSE-C” has no explicit course or department. With missing signals scored zero, even perfect semantic/class/context scores yield only 0.70. The requested automatic-link demonstration cannot be guaranteed with that formula. Document and test an evidence-coverage policy and legitimate master-plan context resolution before changing the formula; never fabricate extracted fields or tune mock outputs merely to force 90%.

## Security and integrations
Environment-only secrets; explicit CORS; backend-only OpenAI calls. JWT/session authentication with FACULTY, LAB_STAFF, COORDINATOR, HOD, ADMIN roles plus ownership/department scoping. Do not expose unauthenticated mutation endpoints as a working MVP. Limit and validate uploads, including decompression limits; preserve unknown columns and row errors. Use timezone-aware timestamps and explicit local academic dates.

OpenAI extraction/embedding providers use bounded retries and timeouts. pgvector embedding dimension must match the configured model; model changes require explicit re-embedding. S3-compatible storage is an interface with local storage first. n8n uses backend decision values, not separately hard-coded thresholds.

## Delivery gates
Use the detailed phase numbering supplied by the user: 0 architecture, 1 foundation, 2 database, 3 API, 4 extraction, 5 matching, 6 n8n, 7 dashboard, 8 review, 9 security, 10 robust Excel, 11 historical analytics, 12 E2E demo, 13 final review. The opening summary differs; detailed phase definitions govern.

At each phase: test, lint/type-check where applicable, smoke-test services when available, fix failures, record blockers and exact verification commands. Stop at each phase boundary. Never present planned features, stubs, synthetic analytics, or untested integrations as complete.

## Current increment — n8n orchestration

The Phase 0 proposal above is retained as design history, not a current implementation
inventory. Existing working-tree backend/frontend modules extend beyond that baseline;
full integration validation remains pending. See README and DEVELOPMENT_LOG.

Two inactive workflow exports now implement authenticated text/Excel ingress → FastAPI
report creation → extraction array → per-event matching → grouped backend decisions →
one webhook response. HTTP nodes forward the caller's JWT, preserving backend ownership
and department checks. n8n has no privileged shared API identity, independent scoring,
or secondary schedule/audit mutation. Excel parsing stays in FastAPI. Empty event arrays
return an explicit empty result; row errors remain in the ingestion response.

Workflow failures stop processing. Already committed API requests remain preserved;
there is no distributed transaction or safe whole-webhook automatic retry yet. Execution
persistence is disabled in the exports to reduce retention of bearer tokens and evidence.
`FASTAPI_BASE_URL` is configurable in Compose. Local owner access and environment-reading
nodes require a trusted local installation. Export/API contract tests pass; live n8n
imports, PostgreSQL, and complete browser flows still require verification.
