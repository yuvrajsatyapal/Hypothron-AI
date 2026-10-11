# File Map

Check the filesystem; planned entries are not implementation claims. Update this map when module responsibility changes, not for every private helper.

| Path | Responsibility | Status |
|---|---|---|
| Root product/architecture/security/ADR docs | Accepted design contracts | Exists |
| CURRENT_PHASE.md / TASKS.md | Live progress and resumable task ledger | Exists |
| CODING_STANDARDS.md | Implementation conventions | Exists |
| PHASE_REPORT_TEMPLATE.md | Evidence and learning report format | Exists |
| docs/SYSTEM_DESIGN_GUIDE.md | Learning path linked to actual phase implementations | Exists |
| docs/learning/PHASE_1_DEEP_DIVE.md | Actual foundation execution/algorithms/production/interview teaching | Phase 1 documentation gate |
| docs/diagrams/phase-1-*.html | Validated implementation architecture and sequence | Phase 1 diagrams |
| docs/reports/ | Per-phase gate evidence and implementation explanations | Implemented foundation |
| .planning/specs/implementation.md | Authorized roadmap scope | Exists |
| .planning/plans/implementation.md | Sequential TDD implementation steps | Exists |
| .planning/design/foundation.md | Foundation workspace layout/states/tokens | Exists |
| apps/web/ | Next.js workspace; browser-memory dataset ownership | Implemented foundation |
| apps/executor/ | Separate credential-free static origin; bridge + fixed analytical workers | Implemented foundation |
| services/api/src/hypothron/ | FastAPI metadata/session/readiness routes, body limits and SQLAlchemy model; orchestration remains planned | Implemented foundation |
| services/api/src/hypothron/providers/http.py | Request-scoped Gemini/OpenRouter HTTP adapters; fixed destinations, identity-only bounded streaming and decoded credential filtering | Independent prework, unexposed |
| services/api/tests/test_providers.py | Deterministic real-adapter wire/error/budget/secret/resource regressions using mock HTTP | 26 tests pass |
| services/api/migrations/ | Alembic versioned PostgreSQL schema | Implemented foundation |
| packages/contracts/ | Runtime asset/version manifest; language-neutral protocol schemas remain planned | Implemented foundation |
| tests/e2e/ | Real-browser isolation, analytics and integration tests | Implemented foundation |
| tests/fixtures/ | Synthetic/public datasets; expected values and provenance | Implemented foundation |

Dependency direction: API routes → domain/policies/repositories; domain never imports FastAPI. Web bridges typed jobs; executor cannot import app/session/provider state. Only provider adapters receive request-scoped keys. No raw snapshots in backend persistence. Analytical compilers and replay share versioned operation semantics, not LLM prompts.

| Path | Current implementation detail |
|---|---|
| apps/executor/src/assets.ts | Memory-only runtime resolver; native worker CSP remains network barrier |
| scripts/bootstrap-assets.mjs / build-executor.mjs / verify-assets.mjs | Pin, hash-check and bundle mirrored runtimes |
| scripts/measure-browser.mjs | Fresh test-owned desktop Chrome RSS/startup sampling |
| docs/reports/PHASE_1_REPORT.md / PHASE_1_BROWSER_MEASUREMENT.json | Gate status, code-based learning, measured evidence and exact resume |
| compose.yaml / services/api/.env.example | Local PostgreSQL development setup; no hosted credentials |

Not implemented: LangGraph/provider API/UI integration, job/event/checkpoint ledgers, persistent replay/export/import/Dexie, Parquet/multi-dataset analysis, chart/report generation, CI and hosted deployment. FILE_MAP is a responsibility map, not a phase completion claim.
