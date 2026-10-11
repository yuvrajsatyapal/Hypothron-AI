# Evaluation and Testing Plan

No benchmarks have run. All targets here are planned; publish observed values with fixture/model/runtime versions and dates.

## Layers

1. Deterministic domain tests: metric compiler, decimal/date/null/join semantics, verifier tolerances, canonicalization and artifact identity. Use hand-checked reference results.
2. Metamorphic tests: row permutation leaves order-independent aggregates unchanged; duplicated rows behave according to metric grain; partitioned sums reconcile; irrelevant columns cannot alter a metric.
3. Protocol tests: ownership, stale/duplicate results, budget reservation, expired lease fencing, lost acknowledgement and checkpoint reconciliation.
4. Browser integration: real WASM/Pyodide in credential-free host, CSP/egress failures, worker cancellation, Dexie consent/quota/delete and XSS/bundle fixtures.
5. Agent tests: deterministic scripted provider replies for routing, malformed schema, contradictory evidence and missing-data interrupts. LLM judge scores alone cannot certify numerical correctness.
6. Live-provider evaluation: opt-in BYOK runs on held-out synthetic questions with recorded model/provider/configuration and actual measured costs. No mandatory paid CI inference.

## Dataset progression

Start with 10 questions (revenue sum, refund-adjusted revenue, grouped contribution, join duplication, missing data, timezone boundary, zero denominator, conflicting contracts, injected contradiction, exact replay). Expand to 20 for public MVP and 50–100 later. Separate prompt-development fixtures from held-out evaluation. Include insufficient evidence and unsupported operations so abstention is scored correctly.

## Metrics and denominators

| Metric | Definition |
|---|---|
| Task completion | Runs reaching the expected fixture outcome / all eligible started runs; correct abstention counts when expected |
| Numerical accuracy | Eligible requested metrics matching reference under contractual policy / all eligible requested metrics, including missing answers |
| SQL execution success | Successful issued SQL jobs / all issued SQL jobs; report retry attempts separately |
| Verification coverage | Material numerical findings with completed independent checks / all material numerical findings |
| Verification agreement | VERIFIED comparable checks / all completed comparable checks; do not interpret as truth accuracy |
| False verification | Incorrect-reference claims labeled VERIFIED / all VERIFIED evaluated claims; also report count of poisoned fixtures missed |
| Unsupported-claim rate | Material report claims lacking valid evidence or overstating causality / all material report claims, with rubric and human audit |
| Recovery | Successful expected recovery cases / injected recoverable failures |
| Replay reproducibility | MATCH replay runs / eligible replay attempts; list incompatible/missing-input cases separately |
| Latency | End-to-end and inference/queue/compute components; sample count, median/p95 where sample size supports it |
| Usage/cost | Attempted calls, actual tokens when provider reports them, unknown outcomes and estimates with pricing timestamp |

Compare single-agent and multi-agent systems on identical contracts, operations, data, model and total token/call budgets. Stratify task difficulty; repeat stochastic runs where affordable and record uncertainty. A second verifier shared by both baselines isolates orchestration benefit. Publish failures and overhead even if the multi-agent system loses.

## Release gating

All critical numerical/security/replay fixtures pass; zero false VERIFIED on the honest-client numerical correctness suite; no raw data/key leakage in instrumented paths; all cross-owner requests fail; all loops stop; no provider call during deterministic replay. Do not generalize finite fixture success to 100% safety/accuracy. Production compilation is a necessary build check, not a substitute for these tests.

Adversarial client-forgery tests assess provenance and authorization separately. A malicious client that forges both agreeing outputs can obtain local-agreement VERIFIED + CLIENT_REPORTED; this is an accepted trust limitation, not a claim that the server detected the forgery. Never count those adversarial cases as an attestation success or promise zero false local agreement against malicious clients. Numerical false-verification rates must identify the honest-client fixture population and provenance tested.
