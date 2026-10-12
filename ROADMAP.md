# Hypothron AI — Phased Implementation Roadmap

Implementation is authorized continuously on 2026-10-11. CURRENT_PHASE.md and TASKS.md record actual progress; unchecked gates remain pending. Phases are dependency gates, not calendar promises. Tests/security/observability are part of every slice; do not defer them to the final release.

Every phase exit also requires its implementation-based docs/learning/PHASE_N_DEEP_DIVE.md and relevant validated diagram-design HTML diagrams. Continue automatically after all required gates pass.

## Phase 0 — Documentation baseline (this change)

Deliver PRD, architecture, security, ADRs, execution/replay contracts, evaluation definitions and risks. Exit: review the trust guarantees, execution restrictions and consent/retention model. No application scaffold or deployment.

## Phase 1 — Deterministic browser foundation (recommended first)

Dependencies: Phase 0 reviewed. Create a scoped feature spec/plan and minimal screen design first.

Build a thin Next.js/FastAPI/PostgreSQL skeleton, opaque demo identity, health checks and migrations. Prove runtime loading in a credential-free execution origin. Support one CSV synthetic fixture, immutable hash, local schema/profile, one explicit metric contract and allowlisted revenue aggregation. Compute the same contract through DuckDB-WASM and Pyodide templates. Define manifest/contracts now, even before persistence UI. Add Parquet and multi-table coverage only after the basic slice works.

Write tests first for decimal/null/date/join semantics, contract compiler, schema rejection and ownership. Use deterministic fixtures and mock providers; no agent or key needed for this slice. Benchmark desktop startup, expanded memory and cancellation; finalize supported browser/runtime versions. ADR-015 explicitly scopes initial support to the measured local desktop configuration; mobile and other targets remain deferred, not inferred from viewport tests.

Exit deliverables:

- A local CSV gives independently agreeing SQL/Pandas totals and an injected mismatch yields DISPUTED; missing verification yields INCONCLUSIVE.
- Browser network/storage probes show no raw upload and no IndexedDB data before Save.
- Denied network/file/extension/code operations cannot execute; CSP/worker/bootstrap behavior is tested in actual supported browsers.
- One minimal plan can execute twice and compare results without any LLM call.
- Record runtime lock, measurements and unresolved device limits. If isolation fails, resolve it before public features advance.

## Phase 2 — Durable bounded LangGraph investigation

Dependencies: Phase 1 operation, metric, job and isolation contracts proven.

Implement Gemini/OpenRouter adapters and request-scoped BYOK, typed planner/analytical/report roles, deterministic supervisor policy, hypothesis/task DAG, SSE observation, authenticated result POST and durable interrupt/resume. Include profiling interpretation as a tool, not an obligatory separate agent. Add sanitized PostgreSQL saver integration, event ledger, fenced run leases, idempotency and termination budgets.

Exit deliverables:

- Three synthetic datasets and an ambiguous question cause metric clarification, prioritized hypotheses, conditional execution, one evidence-driven follow-up and evidence-referenced output.
- Crash/reconnect at job issuance/result receipt recovers without duplicate local acceptance or lost state; ambiguous inference billing is surfaced.
- All outbound attempts count toward the 12-call cap; no cross-owner jobs, no credentials in state/logs; provider error cases tested.
- Scripted providers prove routing and failure semantics for $0. Separately record any live-provider smoke test and its actual cost.

## Phase 3 — Verification, evidence and report reliability

Dependencies: Phase 2 typed evidence graph and workflow recovery.

Expand metric registry, independent contract-to-SQL and contract-to-Pandas implementations, tolerance policies, dataset lineage and contradiction resolution. Add accessible evidence UI, chart specs, supported/disputed/inconclusive hypothesis handling and deterministic report fallback. Implement risky transformation approval as derived snapshots, never mutation of source bytes.

Exit deliverables:

- Join multiplication, differing timezone/null/filter/currency and 18%/20% fixtures are detected correctly; two correction retries cannot loop indefinitely.
- Every material figure is evidence-linked with verification state/provenance; cross-client trust remains explicitly limited.
- Report contract rejects orphan numerical references and evaluation flags unsupported causal claims.
- Initial 10 golden questions plus adversarial fixtures pass; no false VERIFIED result on the honest-client critical numerical fixtures.

## Phase 4 — Opt-in save and reproducible replay

Dependencies: Phase 1 manifest/runtime scheme and Phase 3 complete evidence model.

Implement explicit Dexie Save/delete/quota handling, export/import validation, local history, deterministic execution replay and comparison. Separate report playback and AI re-investigation with fresh consent/key/budget. Store compiler-generated source for inspection and regenerate executable operations from the pinned IR.

Exit deliverables:

- Reload after Save, replay original snapshots with zero provider calls, compare outputs and inspect all lineage.
- Changed source hash, unavailable runtime, unsupported operation version and malicious bundle cause explicit refusal/migration prompts.
- Quota interruption leaves no half-saved bundle; deleting last snapshot reference removes its blob.
- New AI run is linked to original, never overwrites it; comparison records measured tokens/timing and plan differences.

## Phase 4.5 — GitHub Actions CI

Authorized 2026-10-12 after scoped Phases1–4. Implement locked read-only static/backend/PostgreSQL/frontend/browser gates, separate Linux target, active inference refusal, local isolated validation and educational documentation. No deployment/push/PR. Hosted execution awaits separate authorization; Phase5 remains unstarted. See docs/CI_CD.md and docs/reports/PHASE_4_5_CI_REPORT.md.

## Phase 5 — Public demo release and measured evaluation

Dependencies: Phases 1–4 gates. Finish responsive dashboard/explorer/history/provider settings. Expand to CSV + Parquet, three datasets, multiple supported metrics and 20 golden questions. Run single-agent baseline under equal budgets. Add redacted telemetry, retention purge and deploy probes. CI is now separately scoped Phase4.5 above.

Exit deliverables:

- Public deployment meets current free-tier eligibility/quotas, cold-start/SSE recovery and execution headers; no mandatory paid service.
- Publish measured benchmark results/limitations, exact dependency versions, privacy disclosures and synthetic demo bundles.
- All deterministic/security fixtures pass; measured latency/memory and supported devices are documented; no fabricated universal accuracy claim.
- Live-host expiry/deletion behavior and backup retention are documented before inviting users with private data.

## Advanced local track — optional after public contracts stabilize

Run native DuckDB/Python in an isolated disposable process/container with no network/secrets, nonroot identity, limited mounts, CPU/memory/time/pid caps and bounded IPC. User explicitly supplies snapshot bytes; add trusted local recomputation and later arbitrary code only after isolation tests. Docker alone is not a complete security policy. Database connectors use separate read-only credentials and consent; they are not an implicit public-MVP feature.

## Original five-phase mapping

The brief's foundation remains Phase 1; multi-agent work remains Phase 2. Safety and minimal verification move from original Phase 3 into Phase 1 because agents must not precede safe execution. Replay manifests move from original Phase 4 into Phase 1 because identity/lineage cannot be bolted on later. Full verification/replay/release UI remain Phases 3/4/5. This changes ordering, not the three differentiators.
