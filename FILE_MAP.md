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
| docs/reports/ | Per-phase gate evidence and implementation explanations | Phases 1–4 |
| .planning/specs/implementation.md | Authorized roadmap scope | Exists |
| .planning/plans/implementation.md | Sequential TDD implementation steps | Exists |
| .planning/design/foundation.md | Foundation workspace layout/states/tokens | Exists |
| apps/web/ | Next.js workspace; browser-memory datasets, approved joins and structured evidence reports | Phases 1–4 |
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

Phase5 implements bounded Parquet ingestion and up to three sources, as mapped below. General multi-dataset analytics and hosted deployment remain unimplemented. CI is implemented in Phase4.5; the first hosted main-push run is independently verified in docs/reports/PHASE_4_5_CI_REPORT.md. Explicit persistence/bundles/replay are implemented in Phase4. Approved single-lookup joins and structured reports now exist in Phase3. FILE_MAP is a responsibility map, not a phase completion claim.

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
| `apps/web/lib/bundles.ts` | Bounded stored-only ZIP encoder/parser, canonical envelope, import compatibility/integrity validation. |
| `apps/web/lib/replay.ts` | Provider-free approved-IR execution, deterministic comparisons, cancellation and failures. |
| `apps/web/tests/bundles.test.ts`, `replay.test.ts`, `tests/e2e/replay-bundles.spec.ts` | Hostile archives, active provider refusal, actual Chrome engines and immutable history. |
| `docs/INVESTIGATION_BUNDLE_V1.md` | Normative bundle layout, canonical representation, compatibility and privacy boundaries. |
| `apps/web/lib/comparison.ts` | Distinct linked fresh-run structural hypotheses/plans/findings/status/observed-usage comparisons. |
| `apps/web/components/Investigation.tsx`, `lib/investigation.ts` | Full accepted local job capture, frozen run configuration, unused approved inputs, separately consented fresh form. |
| `services/api/src/hypothron/ledger.py`, `investigations.py` | Owner-scoped measured attempt token/request-time projection; no new database schema. |
| `apps/web/tests/fresh-artifacts.test.ts`, `comparison.test.ts` | Unused input retention, new parent identity and unknown measurements. |
| `tests/e2e/fresh-history.spec.ts`, `fresh-recovery.spec.ts`, `saved-lookup.spec.ts` | Actual multi-input AI Save/fresh/replay, lost ACK attribution recovery, original v2 lookup replay. |
| `docs/diagrams/phase-4-*.html` | Six implementation-accurate architecture/lifecycle/data/replay/bundle/mode diagrams. |
| `docs/learning/PHASE_4_DEEP_DIVE.md`, `docs/reports/PHASE_4_REPORT.md` | Comprehensive teaching and executed acceptance evidence. |
| `apps/web/lib/execution.ts`, `apps/executor/src/host.ts`, `tests/e2e/executor-startup.spec.ts` | Exact frame/origin readiness bootstrap, once-only channel handoff and delayed-document real-engine regression. |
| `docs/reports/PHASE_4_REGRESSION_EVALUATION.json` | Final Phase4 run of ten Phase3 golden questions/twelve adverse fixtures; preserves original Phase3 measurement artifact. |

| Path | Phase 4.5 responsibility |
|---|---|
| .github/workflows/ci.yml | Read-only main push/PR/manual static/backend/frontend/Linux Chromium validation; no deployment |
| scripts/ci/*.sh, database.py, check-migrations.py | Reproducible gates, SHA-verified actionlint, test DB/readiness/migration policy, isolated Linux reproduction |
| scripts/ci/python/sitecustomize.py, test_network_guard.py | Test-only loopback socket guard with caught-violation audit and negative probes |
| tests/e2e/fixtures.ts, tests/ci/, scripts/ci/probe-browser-guard.mjs | Browser provider refusal/independent request audit with active negative proof |
| playwright.config.ts | Explicit CI bundled Chromium/production fresh services; separate prior macOS local mode |
| docs/CI_CD.md, learning/PHASE_4_5_CI_DEEP_DIVE.md, reports/PHASE_4_5_CI_REPORT.md | Operations, teaching, exact local evidence and hosted limits |
| docs/diagrams/phase-4-5-ci.html | Validated parallel gate and isolated integration architecture |

## Phase5 local release integration

| Path | Actual responsibility |
|---|---|
| .planning/specs/phase-5.md / plans/phase-5.md / design/phase-5.md | Accepted scoped tasks, risks and existing-workspace design |
| apps/executor/src/ingestion.ts | Bounded actual Parquet decoding, scalar canonicalization and strict reply schema |
| packages/contracts/parquet-runtime.json | Separate pinned extension identity; historical runtime manifest unchanged |
| apps/web/lib/ingestion.ts | Browser-only file acquisition, source lineage and three-input/blob limits |
| apps/web/lib/artifacts.ts / bundles.ts | Strict original/derived manifest2 and hash-named STORED ZIP compatibility |
| services/api/src/hypothron/evaluation.py | Offline equal-ceiling single-loop versus real durable graph comparison |
| services/api/src/hypothron/operations.py | Fixed-event bounded privacy-safe JSON diagnostics |
| services/api/src/hypothron/release_policy.py | Exact origin config, local peer admission and sanitized HTTP boundary |
| services/api/src/hypothron/retention.py | Periodic cooperative bounded transactional expiry sweep |
| scripts/run-api.sh / release-probe.mjs | Local single-process safe launcher / actual read-only HTTP policy probe |
| tests/fixtures/phase5-* / tests/e2e/phase5-* | Synthetic scalar/malformed Parquet,20golden+12adverse, real lifecycle/egress/workload/viewport validation |
| docs/reports/PHASE_5_* | Fresh scoped evidence, measured baseline/performance/viewport observations and acceptance report |
| docs/learning/PHASE_5_DEEP_DIVE.md | Actual final architecture, execution/security trade-offs and interview study |
| docs/diagrams/phase-5-*.html | Skill-designed ingestion/provenance and local/release physical-placement views |


## Account/free-model extension (2026-10-15)

| Path | Responsibility |
|---|---|
| services/api/src/hypothron/providers/catalogue.py | Bounded compatible advertised-free discovery/cache and concrete model resolution |
| services/api/src/hypothron/accounts.py / auth.py | Accounts, hashed revocable login tokens, bounded password and Google PKCE/OIDC flows |
| services/api/src/hypothron/history.py / cloud.py | Explicit durable metadata Save/history and separately consented private cloud bundle intents |
| services/api/migrations/versions/0003* through 0006* | Model lineage, accounts, history and durable cloud intent schema |
| apps/web/components/AccountProvider.tsx / AccountHistory.tsx | Ephemeral account capabilities and explicit history/cloud controls |
| apps/web/lib/account.ts / models.ts | Strict account/catalogue wire response validation |
| Dockerfile.frontend / services/api/Dockerfile / compose.production.yaml | Nonroot/read-only service packaging and isolated database topology |
| scripts/deployment/ / tests/deployment/ | Canonical origins, bounded service/backup validation and disposable restore tooling |
| docs/reports/SAAS_IMPLEMENTATION_REPORT.md / docs/SAAS_DEPLOYMENT.md | Actual extension evidence, limitations and operator instructions |
