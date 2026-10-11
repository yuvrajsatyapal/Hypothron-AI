# Current Phase

Updated: 2026-10-12. **Latest user scope: finish Phase 2, then stop before Phase 3.** Existing main only. Tested-task local commits are authorized; no branch/worktree changes, history rewriting, pushes, PRs, paid resources or external deployment.

| Phase | Status | Evidence |
|---|---|---|
| 0 documentation/workflow | Complete | docs/WORKFLOW_REVIEW.md |
| 1 deterministic browser foundation | Complete for ADR-015 scoped local desktop target | Report, deep dive, actual diagrams and measured JSON |
| 2 durable LangGraph investigation | **Complete for scoped local desktop target** | docs/reports/PHASE_2_REPORT.md and docs/learning/PHASE_2_DEEP_DIVE.md |
| 3 verification/evidence expansion | Not started; outside current scope | Depends on Phase 2 |
| 4 opt-in persistence/replay bundles | Not started; outside current scope | Depends on Phase 3 |
| 5 local release/evaluation | Not started; outside current scope | Hosted release remains unauthorized |

Working: genuine serial DuckDB-WASM and Pyodide/Pandas/NumPy exact CSV revenue calculations, restricted plans, credential-free execution origin/workers, cancellation and memory-only replay. The consent-gated investigation panel integrates real FastAPI/PostgreSQL and three conditional LangGraph roles with genuine Gemini/OpenRouter transports, clarification, up to three dataset descriptors, evidence-driven follow-up and cited reports. Creation is idempotent and inference-free; advance supplies a fresh ephemeral key. Durable attempts/cache/jobs/results/events/native checkpoints support fenced cancellation, owner-scoped reconnect and crash recovery. No raw upload, Dexie, saved bundles or Parquet implementation.

Final evidence: **65 backend tests (15.58s), 30 Vitest tests (640ms), 19 Chrome tests (3.6m)**; final investigation regression rerun passes1test/1.8m, including old cancellation ACK vs new run/key. TypeScript/Ruff/mypy16files/Prettier/OpenAPI drift and production build pass; Alembic0002head. Design review ACCEPT and final Phase2/T2.4 engineering review ACCEPT. Three Phase2 diagrams pass skill self-check and real font/bounds/390px local-scroll checks; local Markdown links pass. All Phase2 documentation and available validation gates are closed.

Support remains ADR-015 Chrome154.0.8037.99/macOSarm64/8GiB/local origins. CSV ceilings:100000 rows,10MiB source,128columns, conservative128MiB expansion;30s execution host/35s client. These are not hard heap guarantees. Phase1 JSON records actual runtime/RSS samples; broader hardware/public hosts remain unvalidated.

Remaining risks: CLIENT_REPORTED agreement is not server attestation; prose numerical/causal grounding remains Phase3. Saved snapshots/export/import/full zero-inference replay bundles remain Phase4. Multi-host quotas, scheduled retention/backup policy, broad device evidence, Parquet, evaluations and hosted deployment probes remain Phase5. Known-key filtering cannot prove all transformed secrets are detected. No live inference compatibility/cost or production-readiness claim.

Exact handoff: Phase2 is complete. **Stop here; do not implement Phase3 without a new user instruction.** If later authorized, begin T3.1 from the existing roadmap/spec/plan; do not redo Phase2 or relax its privacy/provenance/recovery invariants. Read README for local setup and environment. E2E starts a test-only mocked-HTTP API; stop the real API on8000 first. PostgreSQL runs locally on55432. Tests do not require provider keys or paid services. Unsaved bytes/session capability disappear on reload. Commit ledger lives in the Phase2 report; env/generated assets/database files remain excluded.
