# Current Phase

Updated: 2026-10-12. Continuous implementation of Phases 1–5 and tested-task local commits on existing main are authorized. No branch/worktree changes, history rewriting, pushes, PRs, purchases or external deployment.

| Phase | Status | Evidence |
|---|---|---|
| 0 documentation/workflow | Complete | docs/WORKFLOW_REVIEW.md |
| 1 deterministic browser foundation | **Complete for ADR-015 scoped local desktop target** | Report, deep dive, actual diagrams and measured JSON |
| 2 durable LangGraph investigation | **In progress** | T2.1/T2.2 transport and conditional graph tested; T2.3 durable foundations accepted; T2.4 in progress |
| 3 verification/evidence expansion | Not started | Depends on Phase 2 |
| 4 opt-in persistence/replay bundles | Not started | Depends on Phase 3 |
| 5 local release/evaluation | Not started | Hosted release remains unauthorized |

Working: genuine serial DuckDB-WASM and Pyodide/Pandas/NumPy exact CSV revenue calculation, restricted plans, isolated credential-free bootstrap/workers, bounded MessageChannel/cancellation, memory-only replay and metadata-only FastAPI/PostgreSQL sessions. Provider library and request-scoped role adapter feed a genuine conditional LangGraph module with 11 passing workflow tests and review ACCEPT; production API/UI and durable integration remain pending. No Dexie, saved bundles, Parquet, multi-dataset/report flows.

Latest verification: 27 Vitest tests, 63 backend tests (5 real PostgreSQL + 26 provider +11 workflow), 18 real Chrome tests (1.1 minutes), TypeScript/Ruff/mypy/Prettier and production build pass. Phase1 engineering review ACCEPT. Two new diagram self-checks and real-render font/bounds/narrow-scroll checks pass; visual review corrected one obscured annotation and a lifeline-crossing label. Mobile/other browsers/public headers remain deferred, not validated.

ADR-015 explicitly scopes initial validated support to Chrome154.0.8037.99/macOSarm64/8GiB/local origins. Caps:100000 data rows,10MiB source,128 columns, conservative128MiB expansion,30s host/35s client. These are not hard heap guarantees. Padded100k (~9.2MB) real CSV gives101000000 cents in both engines,7577ms startup-to-evidence,5333ms compute,1111834624 sampled process-tree RSS bytes. Read the JSON/report for scope and other observations.

Next exact task: T2.4 workspace provider consent, metadata-only API/result/SSE integration, three-dataset clarification/follow-up browser flow and comprehensive Phase2 deep dive/diagrams. T2.3 is tested/reviewed complete; API routes have early integration coverage. Continue automatically; no new phase approval. Every completed phase requires docs/learning/PHASE_N_DEEP_DIVE.md and implementation-accurate diagram-design diagrams before exit.

Resume: read TASKS/FILE_MAP, docs/reports/PHASE_1_REPORT.md, docs/learning/PHASE_1_DEEP_DIVE.md and .planning/plans/implementation.md. Verify main/status before edits. Existing localhost web3000/executor3001 and Docker PostgreSQL55432 were used; API8000 is not connected to the current workspace. README supplies real setup/env commands. No actual BYOK or paid inference ran. Git hashes are recorded in the report after tested-task commits; generated assets/env/database files remain excluded.
