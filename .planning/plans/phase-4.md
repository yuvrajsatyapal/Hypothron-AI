# Phase 4 Implementation Plan
For agentic workers: execute sequentially with TDD and independent review at task/phase gates. Explicit user instruction overrides worktree/PR/approval defaults.
Goal: implement repository T4.1–T4.3 on existing main; stop before Phase5.
Architecture: sanitized versioned manifests bind original bytes, approved IR, inspectable compiler sources, runtime lock and accepted evidence. Dexie transactions own persisted references; stored ZIP parser owns import boundaries; replay depends only on local executor and verifier.
Tech stack: existing Next/TypeScript/DuckDB-WASM/Pyodide/FastAPI; add pinned Dexie, fake-indexeddb for unit fixtures only.

## T4.1
Files: apps/web/lib/artifacts.ts (canonical manifest builder/validator); storage.ts (lazy Dexie transactions); components/LocalHistory.tsx; page.tsx; tests/artifacts.test.ts, storage.test.ts; tests/e2e/persistence.spec.ts.
- [x] RED canonical insertion-order identity, snapshot/evidence tampering, unknown fields and explicit consent tests: `pnpm exec vitest run apps/web/tests/artifacts.test.ts apps/web/tests/storage.test.ts`.
- [x] Implement `createArtifact(input)` from copied approved snapshots/results; `validateArtifact(manifest,snapshots)` validates strict fields, digests, input hashes, IR/source, versions, DAG order and status. No arbitrary metadata object copying.
- [x] Implement `LocalStore.save(artifact, true)`, `list()`, `load(id)`, `delete(id)` using one read-write transaction for complete save/reference deletion/quota decisions. Opening new DB only on explicit consent; existing inventory permits history reload.
- [x] Chrome tests: Save/reload and unsaved reload loss, quota/rollback/eviction/shared-snapshot delete; add native accessible UI and preserve controls.
- [x] Update TASKS/FILE_MAP, review/fix, scoped validation and conventional local commit.

## T4.2 (depends T4.1)
Files: bundles.ts (fixed-path stored ZIP encoder/parser), replay.ts (local-only replay), LocalHistory.tsx; unit and Chrome replay/bundle tests.
- [x] RED malicious paths/compression/sizes/versions/IR/digests/collisions and actively fail any POST/provider traffic during saved replay.
- [x] Implement `exportBundle(artifact)` and `importBundle(bytes)` with bounded structural validation before allocation; manifest/snapshot hashes checked before confirmation. Repeated identical import is idempotent; same ID/different digest conflicts.
- [x] Implement `replayArtifact(artifact,executor,signal)` revalidating compatibility, dispatching approved plans in saved dependency order, validating worker results/runtime, recomputing verdicts and exact typed differences. Check abort before/after each calculation; append bounded replay history, preserve original.
- [x] Chrome original/lookup/multiple-input replay, mismatch, unavailable runtime/compiler, cancellation/failure recovery and no provider traffic.
- [x] Update TASKS/FILE_MAP, review/fix, validation and local commit.

## T4.3 (depends T4.2)
Files: Investigation.tsx, investigation.ts, server sanitized state projection if needed; comparison.ts; tests; docs/diagrams/phase-4-*.html; deep dive/report/architecture/ledger/guide.
- [x] RED linked new run fresh consent/key, full original evidence retained, measured provider usage and elapsed time projection, structural comparison.
- [x] Capture approved local calculation results per job without auth/key; allow explicit Save after terminal evidence. Restore saved inputs in memory for fresh separately authorized new run; do not resume old session capability.
- [x] Show hypotheses/plans/findings/status/usage/timing differences and limitations; unavailable measurements labelled unavailable.
- [x] Create six focused implemented diagrams using existing provisional style; skill self-check/Chrome bounds/geometry/accessibility.
- [x] Full suites, independent engineering/security/design review, comprehensive learning/report/linked docs; actual commit hashes. Stop before Phase5.
Gate2 self-review: all spec requirements mapped, scope clear, no external effects, tests define failure boundaries. Task ledger checkboxes only after gates pass.

Execution complete: final93backend/98unit/32Chrome, type/lint/format/build/diagrams/local links and independent engineering/security/design ACCEPT. Task commits recorded in Phase4 report. Stop beforePhase5.
