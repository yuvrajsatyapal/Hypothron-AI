# System-Design and Interview Preparation

The overview describes the target design. Phases 1–5 have scoped local implementations and tests; study their reports and code links below. Say “designed” for unimplemented phases and “measured” only for recorded artifacts.

## Explain the system in ninety seconds

Hypothron AI separates reasoning from computation. FastAPI runs a conditional LangGraph workflow that generates hypotheses and issues approved analytical jobs. Local browser engines execute those jobs on dataset snapshots; an independent SQL/Pandas path compares key metrics under versioned business definitions. Evidence and provenance constrain reports. A saved local bundle can replay the calculation DAG without inference. The trade-off is limited client resources and no trusted remote proof of a browser result, in return for privacy and low hosting cost.

## Questions to defend

| Interview question | Reasoning to explain | Evidence to demonstrate later |
|---|---|---|
| Why multi-agent? | Distinct contracts/tools and conditional specialization may improve hypothesis testing; it also adds cost | Follow-up trace and equal-budget baseline evaluation |
| Is LangGraph the DAG? | LangGraph governs workflow/state/loops; analytical task DAG describes dependency-ordered calculations inside that workflow | Task-DAG revisions and graph interrupts |
| Why FastAPI rather than Next.js APIs? | Python domain/contracts/provider integrations with one orchestration authority | Typed route/domain separation and async provider handling |
| Does async mean safe Python execution? | Async overlaps I/O, not isolation or CPU resource governance | Browser workers or isolated native process; no exec in API |
| How do you verify a result without the data? | Server cannot independently recompute; local cross-engine agreement is explicitly client-reported | Status/provenance UI and forged-client fixture |
| Why not just ask a second LLM? | Agreement is not mathematical verification; recompute independently under a shared contract | Injected numerical contradiction |
| How is replay different from reprompting? | Replay uses saved operations/snapshot/runtime with zero inference; reinvestigation creates a new stochastic run | Provider-call counter stays zero on replay |
| Can both engines agree and still be wrong? | Yes: wrong business definition, bad inputs, common implementation errors or forged client | Golden/invariant tests and semantic approval |
| How do you survive server sleep? | Checkpoint pending work, client reconnect, idempotent submissions and fenced ownership | Crash-boundary tests and cold-start probe |
| Why no queue? | Bounded request-triggered continuations suffice for demo; no unattended durable background SLA | Explicit pause/resume behavior |
| What is stored where? | Browser bytes by default; local artifacts on Save; transient sensitive backend metadata | Network/storage probe and retention tests |
| What makes generated code safe? | Public code is compiled from approved IR; privileges/egress constrained separately | Denied operation/egress tests |
| Can replay be bitwise identical? | Only exact operations under matching semantics; floats/runtime differences use a declared comparison contract | Compatibility/tolerance fixtures |
| Does revenue decomposition prove a cause? | Arithmetic contribution is not causal identification; observational alternatives remain | Report uncertainty and evidence types |

## Python and AI concepts to learn by phase

Phase 1: Pydantic validation versus TypeScript compile-time types, Decimal versus NumPy floats, Pandas null/timezone semantics, DuckDB join/grain behavior, deterministic test oracles.

Phase 2: async provider I/O, graph state reducers, durable interrupts, request-scoped credentials, side-effect idempotency, leases/fencing and why checkpointing alone cannot guarantee exactly-once billing.

Phase 3: independent computation, numerical tolerance, measurement versus semantic validity, evidence graphs and the limitations of causal language.

Phase 4: content-addressed snapshots, canonicalization, runtime locks, replay compatibility and immutable lineage.

Phase 5: stochastic evaluation, fair baselines, denominators/uncertainty, privacy-aware observability and constrained deployment.

## Failure walkthrough

After issuing a SQL job the API crashes. Browser may still compute. On reconnect, the client retrieves the durable job/event state and resubmits the same attempt. A unique ledger entry returns the original ACK if already accepted; a fenced owner reconciles and resumes graph state. Keys are re-supplied for fresh inference. If the browser also closed without Save, only metadata remains; require exact hash-matching dataset reattachment or terminate as missing input. Do not pretend the checkpoint contains the dataset.

For an 18%/20% mismatch, first compare period/filters/metric versions, then investigate null/joins/precision. Preserve both results. Only a fresh matching recomputation under approved semantics can change status; an LLM explanation alone cannot.

## Implementation study contract

After each phase, read its report in docs/reports/ first, then the linked code and tests. Reports must distinguish implemented behavior, measured evidence and remaining gates. [Phase 1 report](reports/PHASE_1_REPORT.md) maps actual code, algorithms, negative tests and interview explanations; its initial desktop gate now passes under ADR-015, while mobile/public validation remains deferred. Phase 2 now integrates the providers, conditional graph, durable metadata API and browser panel. Read its deep dive for the actual flow.

For every phase, explain (1) the input/output contract and trust boundary, (2) algorithm/invariant with a small hand-derived example, (3) actual files and tests, (4) alternatives and failure recovery, (5) interview story and study exercise. Do not study planned filenames as working code.

### Study sequence

1. Phase 1: validation/Decimal and UTC semantics → browser IR compilers → separate-origin worker bridge → paired engine verification → actual negative tests. Explain why async and WASM are not security boundaries by themselves.
2. Phase 2: provider schema adapters → typed graph state/routing → interrupt/job handoff → transaction/lease/fencing recovery. Trace one new evidence-driven follow-up and an ambiguous billable timeout.
3. Phase 3: metric grain/join cardinality → independent recomputation → bounded contradictions → cited reports. Derive an 18%/20% conflict manually and explain common-mode contract errors.
4. Phase 4: immutable snapshot and canonical manifest → explicit Dexie transaction → validated import → runtime-compatible replay. Demonstrate why replay is computation, while playback is presentation.
5. Phase 5: equal-budget evaluation → denominator and uncertainty → redacted telemetry/retention → full integration and build checks. Distinguish local release readiness from hosted security evidence.

## Start with the implemented foundation

Use the Phase 1 report's six-step code/test reading sequence. It covers Python Decimal/Pandas/NumPy, SQL population semantics, runtime validation, ASGI receive loops, async SQLAlchemy transactions, Alembic and capability expiry. Reproduce the 3033-cent fixture manually before studying the browser flow. Then reproduce cancellation, missing-column failure, inconclusive empty input and injected contradiction in the browser tests.

LangGraph interrupts, fenced ownership, request-scoped providers and native checkpoint recovery are implemented in Phase2; Dexie replay remains planned. Useful primary references for future Phase 2: [LangGraph interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts), [OpenRouter chat API](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion). No live-provider request was made.


## Study bounded provider transport

Read [http.py](../services/api/src/hypothron/providers/http.py) and [test_providers.py](../services/api/tests/test_providers.py) after the foundation. Trace approved context → reservation callback → one fixed HTTPS request → raw bounded envelope → decoded credential check → strict Pydantic reply → optional reported usage. The Phase2 graph/browser investigation now invokes this path with explicit consent and durable reservations.

- **Async context lifetimes:** nested `async with` closes response/client even on cancellation; an absolute `asyncio.timeout` limits a slow stream beyond per-I/O deadlines. Clearing references is not physical zeroization. Explain why CPU work still belongs in workers, not an async API handler.
- **Typed output is not trusted output:** schema validation checks shape; recursive decoded-content filtering checks a separate confidentiality invariant. A raw `\u0074` escape can become `t` after decoding. Exercise: add nested arrays and credential-bearing field names to a canary reply; identify the guard before any future checkpoint write.
- **Resource bounds apply at the right layer:** a compressed 2 KiB body can inflate into megabytes before a decoded-byte cap. Identity-only raw streaming avoids that allocation path. A byte cap, token cap and deadline constrain different resources; none proves a hard dollar cap.
- **Side effects and ambiguity:** reserve before sending; do not retry a timeout automatically because the provider may have completed/billed it. The transport requires a callback; Phase 2 supplies it using a durable ledger reservation/cache. Exercise: sketch the transaction and crash windows, separating exactly-once local acceptance from unknowable upstream billing.
- **Interview explanation:** “I tested real provider request construction with mock HTTP, including escaped-secret and compressed-body attacks. I implemented one bounded request per reservation and explicit unknown billing. LangGraph is integrated with durable reservations and fenced recovery. Live model compatibility has not been smoke-tested.”

## Mandatory phase deep dives

Start with [Phase 1 deep dive](learning/PHASE_1_DEEP_DIVE.md): actual functions, complete flow, independent exact algorithms, ASGI/transactions, boundaries, tests and interview exercises. Future completed phases must add PHASE_N_DEEP_DIVE.md with implementation-based diagrams before their gate closes; link rather than duplicate prior concepts. Phases 1–4 teaching now exists; Phase5 remains a future gate. ADR-015 now explicitly defers mobile runtime support and scopes initial local validation to the measured desktop configuration.

## Phase 2 implementation and learning

[Phase2 report](reports/PHASE_2_REPORT.md) maps the genuine typed conditional graph and tests. Trace planner→clarification or analyst→issue→interrupt→bound evidence→analyst follow-up→report. Read the issue/accept separation to see why replayed interrupt nodes must not generate new IDs or perform new external side effects. Read [Phase2 deep dive](learning/PHASE_2_DEEP_DIVE.md) for native PostgreSQL saver/ledger/API/UI recovery, exact code walkthroughs, algorithms, production trade-offs and interview exercises. InMemorySaver still serves routing unit tests; separate realDB tests establish local durability/fencing evidence.

## Phase 3 implementation and study sequence

Start with [the Phase3 report](reports/PHASE_3_REPORT.md), then [the comprehensive deep dive](learning/PHASE_3_DEEP_DIVE.md) and [measured evaluation](reports/PHASE_3_EVALUATION.json). The deep dive links four implemented diagrams and contains actual file/function walkthroughs, algorithms, examples, failure scenarios, interview answers, two-/ten-minute explanations and practical exercises.

1. Read executor `contracts.ts`/`advanced.ts`: derive exact decimal minor units, half-open fixed-offset periods and population/null counts by hand. Contrast SQL uniqueness/LEFT JOIN checks with independent Pandas validation/merge. Explain why the join must preserve original grain and why helper names must avoid source collisions.
2. Read Python `agents/models.py` and `verification.py`: immutable versioned semantics, canonical contract identity, exact zero tolerance, semantic incompatibility versus numerical contradiction. Reproduce the forbidden-null and empty-versus-populated regressions; explain why agreement is not attestation.
3. Read `workflow.py` correction/report nodes, then native recovery tests: preserve original evidence, append dependent jobs, enforce two corrections without inference, hydrate legacy observations and fence cancellation. Explain which writes use separate transactions and why a stable job ID survives a crash.
4. Read `reporting.py`, `web/lib/report.ts`, `EvidenceReport.tsx`: validate 18% against10000→11800; reject20% despite existing citations; use Fraction/BigInt cross-multiplication, zero-baseline refusal, compatible semantics and deterministic fallback. Distinguish observation, arithmetic comparison, statistical association and causality.
5. Run the ten golden questions and twelve adverse fixtures. Explain both common-mode errors and deliberate forged agreement with CLIENT_REPORTED provenance. Use exact chart tables rather than pixels as the numerical source.

Before Phase4, prioritize content-addressed immutable snapshots, canonical manifests, atomic IndexedDB transactions/quota failures, runtime/compiler compatibility and zero-inference replay DAGs. At the historical Phase3 exit Save/bundles were unimplemented; Phase4 below supersedes that boundary.

## Phase 4 implementation and learning progression

Read [Phase4 report](reports/PHASE_4_REPORT.md), [comprehensive deep dive](learning/PHASE_4_DEEP_DIVE.md) and [bundle format](INVESTIGATION_BUNDLE_V1.md). The guide explains all six diagrams, complete Save/Reload/Replay/Export/Import/Delete/fresh flows, function-level examples, algorithms/complexities, failure tests, interview answers and two-/ten-minute explanations.

1. Study `artifacts.ts`: canonical supported JSON, original-byte SHA256, approved IR, immutable result digests and asset-lock compatibility. Explain identity versus honest computation with the rehashed forged-agreement fixture.
2. Study `storage.ts`: lazy opening, IndexedDB transaction lifetime, detached hashing, atomic quota/deduplication/last-reference deletion and bounded replay history. Reproduce abort and eviction; distinguish local commit from permanent backup.
3. Study `bundles.ts`: exact stored ZIP subset, bounded offset/count/path validation and fail-closed import. Explain why no decompressor or arbitrary source execution exists, and why preview is separate from persistent confirmation.
4. Study `replay.ts`/LocalExecutor: serial approved dependency order, exact recomputation, semantic diagnostics, active inference guards, cancellation/retry and immutable originals. Separate CLIENT_REPORTED verification from attestation.
5. Study Investigation capture and Ledger.measurements: pre-submission local retention plus accepted-ID filtering, frozen creation attribution, new parent-linked consent/key/budget, unknown usage versus zero and structural comparisons.

Before Phase5 prioritize canonical identity/trust, transaction failure semantics, runtime refusal, archive safety, zero-inference enforcement and privacy/retention. Then learn migration design, resource/observability limitations and reproducibility across supported platforms. Phase5 remains unimplemented and external release is unauthorized.

## Phase 4.5 CI learning progression

Read [CI guide](CI_CD.md), [engineering deep dive](learning/PHASE_4_5_CI_DEEP_DIVE.md), [evidence report](reports/PHASE_4_5_CI_REPORT.md) and [gate architecture](diagrams/phase-4-5-ci.html). Study workflow job/service isolation, frozen toolchains/runtime hashes, native saver migration ownership, production browser startup, mocked wire plus active inference refusal, PR authority and sensitive artifact risks. Reproduce in disposable Linux containers; distinguish recorded local target evidence from an actual hosted Actions run. Phase5 local integration adds fresh evaluation; prioritize new hosted evidence, resource/retention/cancellation reasoning and actual-origin release probes before any authorized release.

## Phase5 final integration study

Read [Phase5 acceptance report](reports/PHASE_5_REPORT.md), then the comprehensive [Phase5 deep dive](learning/PHASE_5_DEEP_DIVE.md). New diagrams show [Parquet ingestion/provenance](diagrams/phase-5-ingestion.html) and [local validation versus external release](diagrams/phase-5-release.html); prior graph/replay diagrams remain relevant. Study shared parsing versus independent exact arithmetic, versioned original/derived lineage, bounded join cardinality, native-saver error redaction, lease/epoch fencing, consent/key lifetime, strict ZIP/artifact identity and zero-inference replay. Defend the measured equal-ceiling single-loop comparison honestly: scripted numerical correctness ties and fewer baseline calls do not establish live model quality or multi-agent superiority. Local candidate acceptance cannot certify TLS/proxy/provider/backups or physical mobile compatibility. The deep dive includes detailed interview answers, exercises and prioritized study topics.
