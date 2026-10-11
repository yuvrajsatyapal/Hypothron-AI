# Architectural Risks and Brief Resolutions

Review date: 2026-10-10. Resolutions are design choices; mitigations require implementation evidence. Risk priority reflects potential impact, not a measured probability.

## Conflicts resolved

| Original tension | Resolution | Consequence |
|---|---|---|
| Logical backend analytics diagram vs browser-first requirement | Control plane on FastAPI/LangGraph; data plane on browser | Agents dispatch/resume jobs rather than read server dataframes |
| “Verified” numerical claims vs untrusted browser results | Separate state from provenance | No server attestation without trusted recomputation |
| IndexedDB listed by default vs explicit Save | Memory default; Dexie opened/written on Save only | Unsaved close/reload loses data |
| Durable state vs no saved investigation | Transient disclosed server checkpoints, separate from local Save | Metadata/aggregate retention still needs expiry/deletion |
| Generated Python vs browser credential isolation | Allowlisted IR and trusted templates in public mode | Arbitrary analytical source is advanced local scope |
| Agents before safe execution in original phases | Safety/verification/replay contracts start in Phase 1 | A meaningful deterministic slice precedes inference |
| Four datasets/five hypotheses vs initial caps | Three dataset default fixture, four active hypotheses; alternate product-mix demo | No silent limit violations |
| Five listed agents vs avoid unnecessary agents | Planner/SQL/Python/report roles; profiling/verifier deterministic | Supervisor routes conditionally, no mandatory agent parade |
| Exact deterministic replay vs browser/runtime variability | Versioned compatibility gate and typed exact/tolerance comparison | Cannot promise bit-for-bit across engines/devices |
| Generic Kotlin/database toolkit rules vs selected Python stack | FastAPI/SQLAlchemy/Alembic and integrity constraints | No Exposed/Micronaut or second Prisma migration authority |
| Free-first vs BYOK paid inference | $0 fixtures/doubles; live inference subject to user quota/billing | No unconditional promise of free real-provider runs |

## Unresolved gates

| ID / priority | Risk | Mitigation and closure evidence | Gate |
|---|---|---|---|
| R1 critical | Runtime bootstrap/CSP and separate-origin worker compatibility | Test pinned Pyodide/DuckDB asset loading, denied egress, iframe MessageChannel and package fetch policies on target browsers | Phase 1; blocks public release |
| R2 high | WASM/Pandas expanded memory and mobile crash | Benchmark compressed/decoded/peak sizes, transfer copies, serial workers, cancellation and output/cardinality limits | Phase 1 caps finalized; Phase 5 device matrix |
| R3 high | PostgreSQL saver/job/event atomicity | Crash injection before/after issue, acceptance, checkpoint and resume; reconcile fenced ledger | Phase 2 |
| R4 high | Provider structured output/model availability and price | Capability probes, explicit unsupported/error paths, no paid auto-fallback, price timestamp | Phase 2/live tests |
| R5 high | Cross-site cookies/authenticated SSE on candidate hosts | Probe session/CSRF/origin behavior; select cookie or in-memory bearer transport by ADR | Phase 2 + deployment |
| R6 high | Metadata/aggregate privacy and upstream retention | Outbound preview/filtering; actual provider/host policies and backup retention published | Before inference/public release |
| R7 high | Local runtime archive longevity/replay drift | Pin artifact hashes/locks, compatibility fixtures and explicit migration/failure | Phase 4 |
| R8 high | Free-host sleep, quota and purge delay | Short checkpointed segments, access expiry, startup/lazy cleanup, deployment probes, local fallback | Phase 5 |
| R9 medium | Both compilers share a wrong metric contract | User semantic confirmation, independent golden/invariant tests | Phases 1/3 |
| R10 medium | Agent overhead exceeds single-agent benefit | Equal-budget evaluation with measured accuracy/cost/latency and confidence intervals where meaningful | Phase 5 |
| R11 medium | Session creation abuse bypasses per-user cap | Atomic global slots, IP/session rate limits, conditional challenge if needed | Phase 5 |
| R12 medium | User mistakes local saving for durable cloud backup | Explicit local-only storage label, quota failures, export workflow | Phase 4 |

## Structural limits accepted

Browser numerical attestation is impossible in this design against a malicious client; mitigate with honest provenance, not a fake cryptographic fix. Server checkpoints cannot recover unsaved local bytes. Browser quotas and cloud free tiers can change. Statistical associations cannot establish business causality without suitable methodology. Memory cleanup cannot guarantee secure erasure. These are product boundaries, not bugs to hide.

## Decisions to make with implementation evidence

Pin exact runtime/library versions and supported browsers; finalize canonical typed-result encoding and worker-host CSP; select session transport for actual hosting origins; define measured decoded-data ceilings; confirm exact upstream model capabilities and live pricing; document host logs/backups/physical-purge behavior. No additional product clarification is needed to start the recommended scoped Phase 1 once implementation is authorized.

## Implementation audit — 2026-10-11

R1 has genuine local Chrome evidence for engine loading, strict IR, native compute network/script denial and dataset-free asset bootstrap (ADR-013); child-worker/source probes also pass, but hosted origins and other runtime targets remain unvalidated. R2 remains a residual release risk: desktop startup, dataframe/tracked-SQL allocations and sampled whole-browser RSS are recorded, but larger-input/peak/device/mobile measurements and final universal device ceilings are unproven; the initial100k/local desktop operational ceilings are now explicit. The continuation brief authorizes explicit initial support scoping; ADR-015 resolves the Phase1 gate on the measured local desktop only, with broader targets deferred. Viewport responsiveness is not mobile runtime evidence. R5 has a locally tested in-memory bearer decision (ADR-014), not deployed cookie/SSE validation. Provider transport risks now have 26 mock-HTTP security/error regressions and review acceptance. Live provider/model compatibility, durable budgets/recovery, persistence/import and public-host risks remain unvalidated; no later phase has advanced. Accepted decisions are not measured guarantees.
