# Hypothron AI Implementation Plan

> For agentic workers: use superpowers:executing-plans inline. User explicitly authorizes continuous execution; no interphase confirmation. Tested-task local commits on existing main are authorized by the 2026-10-12 continuation brief; no branch changes, pushes or external deployment.

Goal: implement the existing five-phase roadmap with genuine browser analytics, bounded LangGraph reasoning and reproducible local replay.
Architecture: Next.js app owns local bytes; separate static origin owns credential-free restricted compute; FastAPI/PostgreSQL own orchestration metadata. Contracts and trusted compilers bridge these boundaries.
Tech stack: existing TECH_STACK.md; lock exact compatible versions during foundation.
Spec: .planning/specs/implementation.md plus ROADMAP.md and normative protocol/replay docs.

## Global constraints

Use PRD limits; memory default, explicit Save; no arbitrary model source; no keys in state/artifacts; deterministic independent verification with client provenance; no paid infrastructure or external publishing.

## Review focus

Malformed or adversarial identifiers/source; null/decimal/date semantic drift; forged client provenance; missing PostgreSQL/worker/service recovery; local bundle incompatibility. Add negative tests to each owning task before implementation.

## Sequential tasks

### T1.1 metadata foundation

Files: services/api/pyproject.toml, src/hypothron/api.py, src/hypothron/db.py, migrations/, tests/test_api.py; root local scripts/config.
Interfaces: create_app(settings) → FastAPI; migrate database before readiness; opaque memory-only client capability scopes session records.
- [ ] Write health/session/owner/validation tests; run pytest and observe missing behavior.
- [ ] Implement async PostgreSQL repositories/migration and sanitized API errors.
- [ ] Run real-DB tests; unavailable DB is a blocker, not a mock pass.

### T1.2 analytical contracts

Files: packages/contracts and apps/executor/src/contracts.ts, compile.ts; tests/domain.test.ts.
Interfaces: validatePlan(unknown) → approved MetricPlan; compileSQL(plan) → fixed read-only SQL; verify(left,right) → state + CLIENT_REPORTED.
- [ ] Test hostile fields/identifiers, exact decimal totals, null/date semantics and mismatch.
- [ ] Implement typed runtime validation and separate contract-to-SQL/Pandas templates.
- [ ] Run full domain tests; record observed Red/Green.

### T1.3 isolated execution and UI

Files: apps/executor/server.mjs, public/host.html, src/runtime.ts, src/worker.ts, apps/web/app/, lib/execution.ts; tests/e2e/foundation.spec.ts.
Interfaces: typed MessageChannel jobs, bounded exact result envelope; cancel terminates worker.
- [ ] Write real-browser expected local sum/negative operation/no-upload/no-save tests first.
- [ ] Load pinned mirrored assets under deny-egress CSP; implement fixed templates and worker bridge.
- [ ] Build foundational responsive UI from design doc; run browser tests and memory/startup measurements.
- [ ] Prove a minimal replay twice without provider calls before Phase 2.

### T2.1–T2.4 agents and durable handoff

Files: services/api/src/hypothron/providers/, agents/, ledger.py and migrations; web investigation components; provider/workflow/recovery tests.
Interfaces: request-scoped provider credentials, typed role outputs; PostgreSQL pending job + LangGraph interrupt; idempotent results and fenced continuation.
- [ ] Red: provider malformed/error/secret tests; conditional planner→analyst→report, follow-up and budget tests.
- [ ] Green: genuine HTTP provider adapters, typed LangGraph nodes and PostgreSQL saver/ledger reconciliation.
- [ ] Red/Green: duplicate/conflict/crash/expiry ownership and SSE reconnect tests.
- [ ] Validate three-dataset fixture and record Phase 2 evidence before proceeding.

### T3.1–T3.3 evidence reliability

Files: verifier/evidence/report domain modules and UI; ten golden fixture questions.
- [ ] Red/Green: join cardinality, null/date/currency and 18/20 discrepancy tests; two-retry stop.
- [ ] Red/Green: orphan citations, accessible chart tables and causal overclaim fixtures.
- [ ] Record Phase 3 tests and learning report.

### T4.1–T4.3 artifacts

Files: web artifact/storage/replay modules and schema; storage/import/replay browser tests.
- [ ] Red/Green: Save consent, atomic quota/delete, hashes/runtime mismatch and malicious bundle tests.
- [ ] Red/Green: real recalculation with zero provider requests; linked fresh AI comparison.
- [ ] Record Phase 4 evidence and report.

### T5.1–T5.4 integration

Files: CI, run guide, full UI, eval fixtures and measured result report.
- [ ] Expand to Parquet/three datasets and 20 golden questions; compare baseline under equal budgets.
- [ ] Full DB/browser/security/unit/type/lint/build checks and resource/retention/recovery probes.
- [ ] Review documentation/code with a fresh reviewer; fix important findings with Red/Green tests.
- [ ] Record external deployment as pending separate authorization; do not fabricate hosted evidence.
