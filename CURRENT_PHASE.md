# Current Phase

Updated 2026-10-13. **Phase 4.5 CI is locally complete and hosted-CI verified; Phases 1–4 remain complete for the scoped local desktop target. Stop before Phase 5.** Existing main only; tested-task local commits are authorized. No branches, worktrees, PRs, push, history rewriting, deployment, publication or paid resources.

| Phase | Status | Evidence |
|---|---|---|
| 0 documentation/workflow | Complete | docs/WORKFLOW_REVIEW.md |
| 1 deterministic browser foundation | Complete for ADR015 local desktop | Phase1 report/deep dive/runtime measurements |
| 2 durable LangGraph investigation | Complete for scoped local desktop | Phase2 report/deep dive |
| 3 verification/evidence expansion | Complete for scoped local desktop | Phase3 report/deep dive/evaluation |
| 4 opt-in persistence/replay bundles | Complete for scoped local desktop | T4.1 6bc489e; T4.2 26c0e95; T4.3 27caaed; full hashes in Phase4 report |
| 4.5 GitHub Actions CI | Complete; hosted run38290929211 independently verified | docs/reports/PHASE_4_5_CI_REPORT.md |
| 5 local release/evaluation | Not started; outside current scope | No hosted release authorization |

Explicit Dexie Save/import consent owns immutable snapshots/manifests and atomic quota/deletion. Strict stored-only bundles validate untrusted paths, bounds, hashes, schema, IR and runtime. Saved replay makes zero inference requests and preserves original evidence while recording deterministic comparisons. Fresh AI requires separate consent/key/budget and creates a distinct parent-linked run with measured-or-unavailable comparisons. Completed AI capture retains accepted local results before ACK, unused approved inputs and frozen creation attribution. Credentials/capabilities remain ephemeral; raw uploads remain memory-only before Save.

Final gates: 93 backend tests, 98 unit tests, 32 real Chrome tests (6.1min), TypeScript, Ruff/31 files, mypy/18 files, formatting, OpenAPI, migration0002, production builds, six diagram self-checks/Chrome renders and local documentation links pass. Independent engineering/security and design reviews ACCEPT. See [Phase4 report](docs/reports/PHASE_4_REPORT.md), [deep dive](docs/learning/PHASE_4_DEEP_DIVE.md) and [regression observations](docs/reports/PHASE_4_REGRESSION_EVALUATION.json).

Limits: ADR015 Chrome154/macOSarm64/fixed127.0.0.1 origins; revenue IR1/2, USD/EUR/JPY, fixed offsets and one approved lookup. No Parquet/general analytics, encryption, cloud sync, automatic migration, mobile runtime or hosted product-release support. IndexedDB is accessible to app-origin scripts and evictable. CLIENT_REPORTED is never server attestation. Logical limits do not guarantee permanent retention or a hard peak heap ceiling. Final manifestv1 supersedes unsupported unreleased task-development records.

Fixture tests used isolated PostgreSQL55433, preserving unrelated55432. External provider HTTP was mocked. Unrelated services/api/.env.example is preserved and excluded. No Phase5 implementation follows this completion.

Phase4.5 adds read-only static/backend/frontend/browser CI, disposable PostgreSQL17, frozen toolchains/assets and active inference refusal. Fast gates use Ubuntu24 x64; browser uses standard Ubuntu24 arm64 after local x64 emulation exceeded the unchanged35s UI deadline. Local gates93backend/99unit/build/static and all32native Linux browser tests pass (8.7min); separate fresh-DB API/graph/engines flow passes (1.1min). Final engineering/security review and documentation checks are recorded in the CI report. Hosted [run38290929211](https://github.com/yuvrajsatyapal/Hypothron-AI/actions/runs/38290929211) independently verifies success on main at `8bd118c5b6c6c297ea385b3cd7e0355ab3ed470e`: fast x64 jobs21s/28s/58s and native arm64 browser job9m8s, all32tests passing in7.8min. The local macOS acceptance, local Linux container results and actual hosted Linux target remain separate. No agent push/deployment or Phase5 work. See [CI guide](docs/CI_CD.md), [deep dive](docs/learning/PHASE_4_5_CI_DEEP_DIVE.md), [CI report](docs/reports/PHASE_4_5_CI_REPORT.md).

The CI prerequisite for Phase5 is satisfied; Phase5 remains unstarted and outside this acceptance-only task. Hosted CI does not establish production readiness, live-provider compatibility, universal browser/mobile support, complete network sandboxing or server attestation.
