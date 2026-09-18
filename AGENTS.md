# AcademicFlow project rules

Read `docs/ARCHITECTURE.md`, `DEVELOPMENT_LOG.md`, and applicable nested instructions before changes. Preserve working code and build one requested phase at a time.

- Local prototype first; no premature AWS or enterprise complexity.
- FastAPI owns business logic; n8n only orchestrates; frontend actions call real APIs.
- Never invent missing extracted fields. Preserve source reports and exact evidence.
- Keep extraction separate from matching; explain every AI decision.
- Configurable default thresholds: >=90% auto-link, >=50% review, otherwise unmatched.
- Never discard unmatched events. Support multiple executions per activity.
- Audit every state transition; update links, schedule, and audit atomically.
- No hard-coded secrets. Validate inputs and enforce role plus data-scope permissions.
- Use typed schemas, migrations, realistic labeled synthetic data, and deterministic provider tests.
- Do not force demo scores by inventing context. Resolve documented confidence ambiguities explicitly.
- Run tests and applicable lint/type checks after each phase; report actual outcomes and blockers.
- Maintain README.md, .env.example, .gitignore, and DEVELOPMENT_LOG.md.
