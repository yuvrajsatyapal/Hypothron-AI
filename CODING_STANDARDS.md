# Coding Standards

Security requirements live in SECURITY.md; budgets in PRD.md; runtime contracts in docs/EXECUTION_PROTOCOL.md and docs/VERIFICATION_AND_REPLAY.md. Do not duplicate their policy values here.

## Python

Use supported Python 3.12, uv lockfiles, Ruff format/lint, strict type checks and pytest. Pydantic models reject unknown fields at API/LLM/artifact boundaries and validate constrained values. SecretStr at provider boundaries; extract only while making the request. Routes translate domain errors to a stable sanitized envelope; no request-body/key logging or validation-error value echoes.

Async for I/O; no blocking analytics in FastAPI. Repositories own database writes and take owner identifiers explicitly. Related state/event/job changes occur in one transaction. Explicit UTC instants, fixed metric timezones and immutable versions. Never swallow cancellation or fabricate a success/zero when execution failed.

## TypeScript / browser

Strict TypeScript; unknown plus runtime validation for untrusted messages. No any-based casts around execution permissions. Public IR is an allowlist; compiled source is inspectable but never executes user-edited source. Client state is memory by default; no persistence middleware. Avoid server imports of workers/Dexie/WASM. React-render values as text, chart specs as typed data; no HTML interpretation of dataset/model text.

Use explicit API wire schemas rather than heuristic recursive case conversion. Runtime version/manifest changes require compatibility tests. Ship local font fallbacks and accessible inputs/errors/statuses. New screens need design docs; use CSS tokens, keyboard focus and responsive flow.

## Tests and completion

Observe Red → Green → Refactor. Expected numerical values are hand-derived, not computed by the production helper under test. Test real engines in browsers, real PostgreSQL for DB claims, and deterministic provider doubles only at external LLM boundaries. Every permission/ownership/size/egress control needs a negative case. Record skipped/unavailable checks distinctly from passes. Run full suites at phase exit; builds do not certify security.

No live provider key required for automated tests. CI must fail on absent mandatory test services, not quietly skip them. Dependency upgrades are locked and justified. No commits, publishing, purchases, external deployment or PRs in this authorized run.
