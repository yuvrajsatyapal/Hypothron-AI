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
| docs/reports/ | Per-phase gate evidence and implementation explanations | Phases 1–3 |
| .planning/specs/implementation.md | Authorized roadmap scope | Exists |
| .planning/plans/implementation.md | Sequential TDD implementation steps | Exists |
| .planning/design/foundation.md | Foundation workspace layout/states/tokens | Exists |
| apps/web/ | Next.js workspace; browser-memory datasets, approved joins and structured evidence reports | Phases 1–3 |
| apps/executor/ | Separate credential-free static origin; bridge + fixed analytical workers | Implemented foundation |
| services/api/src/hypothron/ | FastAPI metadata/session/readiness routes, body limits and SQLAlchemy model; authenticated investigation routes and bounded SSE | Implemented foundation |
| services/api/src/hypothron/agents/ | Strict role/approved metadata contracts, conditional StateGraph and ephemeral role transport | Typed graph integrated with durable request-scoped driver and consent-gated UI |
| services/api/tests/test_workflow.py | Genuine LangGraph routing/interrupt/budget/binding tests | 11 pass with test-only InMemorySaver |
| services/api/src/hypothron/providers/http.py | Request-scoped Gemini/OpenRouter HTTP adapters; fixed destinations, identity-only bounded streaming and decoded credential filtering | Genuine transports exposed through consent-gated authenticated investigation routes |
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

Not implemented: persistent replay/export/import/Dexie, Parquet/general multi-dataset analysis, CI and hosted deployment. Approved single-lookup joins and structured reports now exist in Phase3. FILE_MAP is a responsibility map, not a phase completion claim.

| Path | Responsibility |
|---|---|
| services/api/src/hypothron/records.py / ledger.py | Owner-scoped immutable jobs, attempts/results/events, leases and terminal policy |
| services/api/src/hypothron/checkpoints.py / driver.py | Fenced native PostgreSQL saver, per-request bounded graph segments and crash reconciliation |
| services/api/src/hypothron/retention.py | Bounded transactional expiry sweep including native checkpoint payloads |
| services/api/src/hypothron/investigations.py | Consent/BYOK investigation routes, completed-state inspection and finite authenticated SSE |
| services/api/tests/test_ledger.py / test_recovery.py / test_driver.py / test_investigations_api.py | RealDB idempotency/fencing/crash/expiry/provider-wire/route negative cases |

| apps/web/components/Investigation.tsx / lib/investigation.ts | Consent, original-run context, local snapshot/job binding, bounded API/SSE and cancellation generations |
| services/api/tests/browser_server.py / tests/e2e/investigation.spec.ts | Explicit $0 external HTTP fixture; real API/graph/DB/browser integration and failure races |
| docs/learning/PHASE_2_DEEP_DIVE.md / docs/diagrams/phase-2-*.html | Actual Phase2 architecture, transaction/recovery teaching and interview preparation |
| packages/contracts/openapi-v1.json / scripts/export-api-contracts.py | Generated implemented API schema with drift check; TS runtime bindings remain explicit |
| scripts/check-diagrams.mjs | Actual Chrome font/bounds/local-scroll validation for teaching diagrams |

| Path | Phase 3 responsibility |
|---|---|
| apps/executor/src/advanced.ts / contracts.ts | V2 exact currency/offset/grain/relationship compiler and independently generated Pandas diagnostics; v1 compatibility |
| apps/web/components/metricApproval.ts / app/page.tsx | Explicit versioned metric and derived lookup approval; original local snapshot replay |
| apps/web/lib/verification.ts | Semantic diagnostic verdict at browser presentation boundary |
| services/api/src/hypothron/verification.py | Canonical immutable contract identity, exact comparison and deterministic contradiction classes |
| services/api/tests/test_verification.py | Semantic incompatibility/null/grain/numerical fixtures, two-correction bound and native recovery/cancel tests |
| tests/e2e/advanced-verification.spec.ts | Actual DuckDB-WASM/Pyodide v2 exact values, joins and adversarial rejection |
| services/api/src/hypothron/reporting.py / tests/test_reporting.py | Exact claim/citation/semantic support checks, controlled narrative and deterministic evidence report fallback |
| apps/web/lib/report.ts / components/EvidenceReport.tsx | Independent strict report validation, exact BigInt presentation, rational SVG and accessible tables |
| tests/fixtures/phase3-golden.json / tests/e2e/phase3-evaluation.spec.ts | Ten hand-derived golden questions and twelve adverse real-engine fixtures |
| docs/reports/PHASE_3_EVALUATION.json | Actual browser observations, exact expected/observed values and limited trust probes |
| docs/learning/PHASE_3_DEEP_DIVE.md / docs/diagrams/phase-3-*.html | Actual verification/report algorithms, trust/routing/lineage diagrams and interview preparation |

| Path | Phase 4 responsibility |
|---|---|
| apps/web/lib/artifacts.ts | Strict canonical v1 manifests, original snapshot/evidence integrity, compiler/runtime identity |
| apps/web/lib/storage.ts | Explicit lazy Dexie atomic Save/quota/idempotence/shared snapshot deletion |
| apps/web/components/LocalHistory.tsx | Disclosed consent, existing saved metadata inventory and explicit historical playback |
| apps/web/tests/artifacts.test.ts / storage.test.ts / tests/e2e/persistence.spec.ts | Canonical/tamper/report bindings, real IndexedDB consent/reload/abort/quota acceptance |
