# Current Phase

Updated 2026-10-12. **Phase 4 is complete for the scoped local desktop target. Stop before Phase 5.** Existing main only; tested-task local commits are authorized. No branches, worktrees, PRs, push, history rewriting, deployment, publication or paid resources.

| Phase | Status | Evidence |
|---|---|---|
| 0 documentation/workflow | Complete | docs/WORKFLOW_REVIEW.md |
| 1 deterministic browser foundation | Complete for ADR015 local desktop | Phase1 report/deep dive/runtime measurements |
| 2 durable LangGraph investigation | Complete for scoped local desktop | Phase2 report/deep dive |
| 3 verification/evidence expansion | Complete for scoped local desktop | Phase3 report/deep dive/evaluation |
| 4 opt-in persistence/replay bundles | Complete for scoped local desktop | T4.1 6bc489e; T4.2 26c0e95; T4.3 hash in Phase4 report |
| 5 local release/evaluation | Not started; outside current scope | No hosted release authorization |

Explicit Dexie Save/import consent owns immutable snapshots/manifests and atomic quota/deletion. Strict stored-only bundles validate untrusted paths, bounds, hashes, schema, IR and runtime. Saved replay makes zero inference requests and preserves original evidence while recording deterministic comparisons. Fresh AI requires separate consent/key/budget and creates a distinct parent-linked run with measured-or-unavailable comparisons. Completed AI capture retains accepted local results before ACK, unused approved inputs and frozen creation attribution. Credentials/capabilities remain ephemeral; raw uploads remain memory-only before Save.

Final gates: 93 backend tests, 98 unit tests, 32 real Chrome tests (6.1min), TypeScript, Ruff/31 files, mypy/18 files, formatting, OpenAPI, migration0002, production builds, six diagram self-checks/Chrome renders and local documentation links pass. Independent engineering/security and design reviews ACCEPT. See [Phase4 report](docs/reports/PHASE_4_REPORT.md), [deep dive](docs/learning/PHASE_4_DEEP_DIVE.md) and [regression observations](docs/reports/PHASE_4_REGRESSION_EVALUATION.json).

Limits: ADR015 Chrome154/macOSarm64/fixed127.0.0.1 origins; revenue IR1/2, USD/EUR/JPY, fixed offsets and one approved lookup. No Parquet/general analytics, encryption, cloud sync, automatic migration, mobile runtime or hosted support. IndexedDB is accessible to app-origin scripts and evictable. CLIENT_REPORTED is never server attestation. Logical limits do not guarantee permanent retention or a hard peak heap ceiling. Final manifestv1 supersedes unsupported unreleased task-development records.

Fixture tests used isolated PostgreSQL55433, preserving unrelated55432. External provider HTTP was mocked. Unrelated services/api/.env.example is preserved and excluded. No Phase5 implementation follows this completion.
