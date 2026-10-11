# Task Ledger

Only check a task after its behavior tests pass; phase exit gates are tracked separately in reports. Current phase is authoritative in CURRENT_PHASE.md. Commands/results go in reports, not duplicated here.

## Phase 1

- [x] T1.0 Review workflow, written scoped specification, plan and design.
- [x] T1.1 Locked Next.js/FastAPI tooling and real PostgreSQL migration/session/readiness tests.
- [x] T1.2 Strict operation/metric contracts, decimal/date/null compilers and verification tests.
- [x] T1.3 Credential-free static origin, pinned DuckDB-WASM/Pyodide workers, typed bridge and cancellation.
- [x] T1.4 Real-browser CSV/profile/independent sums, contradiction, denylist/egress/no-save probes and minimal replay.
- [x] T1.5 Measurements, scoped desktop ADR-015, resource ceiling, deep dive/diagrams, final checks and review.

## Phase 2

- [x] T2.1 Genuine OpenRouter/Gemini transport adapters; structured validation/error/secret tests. Independent prework only; no inference route or live compatibility claim.
- [x] T2.2 Typed conditional LangGraph roles and budgeted follow-up/clarification tests; module Gate3.5 ACCEPT.
- [x] T2.3 PostgreSQL checkpoints, immutable jobs/results/events, lease fencing and crash recovery tests.
- [x] T2.4 UI/API/SSE end-to-end investigations, deep dive, diagrams, phase report and final engineering/design ACCEPT.

## Phase 3

- [ ] T3.1 Join/period/null/currency verification, bounded correction and evidence lineage.
- [ ] T3.2 Accessible structured charts/reports, orphan citation rejection and ambiguity/causality tests.
- [ ] T3.3 Ten golden questions and adverse fixtures; phase report.

## Phase 4

- [ ] T4.1 Explicit Dexie Save, atomic quota/delete and local history.
- [ ] T4.2 Validated export/import, runtime/hash compatibility and zero-inference execution replay.
- [ ] T4.3 Linked fresh AI runs/comparisons and phase report.

## Phase 5

- [ ] T5.1 CSV/Parquet/multi-dataset UI, 20 golden questions and equal-budget baseline evaluation.
- [ ] T5.2 CI, full lint/type/build/security/browser suite, retention and cancellation/resource probes.
- [ ] T5.3 Local run guide, integration report and learning documentation.
- [ ] T5.4 External deployment gates (requires separate authorization); never label passed from localhost.

## Rulings and blockers

- 2026-10-11: Continuous implementation authorized; remove obsolete “no application code yet” instructions. No automatic commits/pushes from QueryCure workflow.
- 2026-10-11: External release evidence remains an incomplete Phase 5 gate until separately authorized; independent local validation continues.

- 2026-10-11: T1.4 has passing real-engine/privacy/replay/contradiction/cancellation/main-worker native CSP tests. Nested-worker native XHR, wrong-origin/source handshake and explicit file/extension-operation rejection now pass in the final 18-test suite.
- 2026-10-11: T1.5 has a durable report and one actual desktop startup/RSS sample, plus dataframe/tracked-SQL allocations. The 100,000-row desktop workload also passes; a wider input/device matrix, true mobile hardware evidence and final supported-device ceilings remain incomplete. Conservative expansion estimates are not measured peak heap. No later phase has advanced; T2.1 was completed as independent safe prework.

- 2026-10-11: T2.1 has 26 passing mocked-transport tests and Gate 3.5 ACCEPT. Escaped/nested credential echoes and compressed-response allocation bypasses were reproduced, then fixed. Caller-owned durable attempt reservation, model capability/pricing disclosure, graph routing and UI/API integration remain T2.2–T2.4.

- 2026-10-12: Final available rerun passes 75 tests (26 web/script unit + 31 backend + 18 real-browser); lint/type/format checks pass. T1.5 remains open; continue from CURRENT_PHASE.md with the existing authorization, not a new approval gate.

- 2026-10-12 continuation supersedes earlier blockers/Git restrictions: tested-task local commits exclusively main authorized; ADR-015 explicitly scopes Phase1 to measured desktop and defers mobile/public targets. T1.5 closes with 27 unit +31 backend +18 real-browser tests, production build/type/lint/format, engineering ACCEPT, deep dive and two validated diagrams. Earlier “mobile required before advancement” entries are historical, not current gates. T2.2 is next.

- 2026-10-12: T2.3 fenced native checkpoints/ledgers/driver/expiry cleanup pass Gate3.5 ACCEPT. T2.4 routes have mocked-provider/realDB coverage; workspace integration and Phase2 learning/diagram gates remain pending.

- 2026-10-12 latest scope supersedes continuous advancement: finish Phase2, then stop beforePhase3. Final integrated validation passes65backend/30unit/19browser plus targeted delayed-cancel regression. Deep dive/three implemented diagrams and OpenAPI drift checks exist. Final engineering and design reviews ACCEPT; T2.4 and Phase2 close. Stop beforePhase3. Tested integration hash is recorded in the phase report.
