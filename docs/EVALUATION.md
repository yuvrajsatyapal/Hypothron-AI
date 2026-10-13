# Evaluation and Testing Plan

Measured regression evidence exists in the Phase3/Phase4 reports. Phase5 adds twenty hand-derived golden questions and twelve earlier adverse fixtures in `tests/fixtures/phase5-golden.json`; fresh browser measurements and the equal-ceiling policy comparison are separate artifacts. None of these scripted fixtures measures live-model quality.

## Layers

1. Deterministic domain tests: metric compiler, decimal/date/null/join semantics, verifier tolerances, canonicalization and artifact identity. Use hand-checked reference results.
2. Metamorphic tests: row permutation leaves order-independent aggregates unchanged; duplicated rows behave according to metric grain; partitioned sums reconcile; irrelevant columns cannot alter a metric.
3. Protocol tests: ownership, stale/duplicate results, budget reservation, expired lease fencing, lost acknowledgement and checkpoint reconciliation.
4. Browser integration: real WASM/Pyodide in credential-free host, CSP/egress failures, worker cancellation, Dexie consent/quota/delete and XSS/bundle fixtures.
5. Agent tests: deterministic scripted provider replies for routing, malformed schema, contradictory evidence and missing-data interrupts. LLM judge scores alone cannot certify numerical correctness.
6. Live-provider evaluation: opt-in BYOK runs on held-out synthetic questions with recorded model/provider/configuration and actual measured costs. No mandatory paid CI inference.

## Dataset progression

Phase3 measured ten questions; Phase5's twenty cover exact USD/EUR/JPY sums, refunds, half-open periods, fixed offsets, approved joins, values above the JavaScript safe-integer range, genuine zero, null/empty evidence, leap day and row permutation. The twelve adverse engine fixtures retain unsupported operation/timezone/precision, null, identity and relationship refusal coverage. Current operations are approved `revenue_sum` IR1/2; general grouping/anomaly/causal inference remains unsupported. Fifty to one hundred questions and held-out live evaluation remain future work. The present fixture questions and provider scripts are regression cases, not held-out model evaluation.

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

## Phase5 offline comparison

`services/api/src/hypothron/evaluation.py` is an offline harness, with no application route or new product agent. Its single-agent baseline makes one typed decision per iteration: select an approved dataset contract, or finish with a report. The multi-role arm invokes the implemented `InvestigationDriver`, `RequestRoleProvider`, real PostgreSQL ledger and fenced native LangGraph checkpoints. Both use the same scripted Gemini HTTP model (`gemini-test`), temperature0, at most12 attempted calls,1024 output tokens per request, and6 jobs. The single arm is ephemeral; durable persistence is part of the measured multi-role overhead.

Both consume the same fresh browser-observed SQL/Pandas results, diagnostics and approved plans, and use `verify_evidence` and `validated_report`. The harness never computes replacement answers or synthesizes measured engine values. It first requires all32 distinct fixture IDs, validates golden plans against source/lookup SHA256 identities and compares both observed results/statuses to hand-derived ground truth. Provider scripts choose approved inputs and quote verified observations; they do not contain fixture expected answers. Invalid reports fall back through the same reporting policy.

Run after the fresh browser evaluation creates its report, using the isolated test database with migrations applied:

```sh
source /tmp/hypothron-phase5-env.sh
services/api/.venv/bin/python -m hypothron.evaluation \
  --observations docs/reports/PHASE_5_EVALUATION.json \
  --output docs/reports/PHASE_5_BASELINE.json
```

The browser report records20 golden and12 adverse observations, runtime identity, engine/worker latency, tracked allocations and privacy checks. The baseline JSON records its source report/fixture digests, generation timestamps, each arm's attempted calls, completed outcomes, evidence correctness, independent verification coverage, verification statuses, report claim counts and orchestration latency. Completion/correctness/status denominators are20 eligible runs; coverage uses all material findings, including explicit inconclusive empty/null findings. False VERIFIED uses only VERIFIED honest-client findings as its denominator. The twelve rejected engine operations never create a valid result, so their refusal count is separate and their orchestration eligibility is0. They are not counted as twelve invented graph runs.

Token totals and costs remain null: mock envelopes omit usage metadata and no inference is billed. Browser computation is reused, so orchestration timing excludes engine execution; sequential observations include different persistence/bootstrap overhead and are not controlled latency trials. Median and sample count are reported; p95, recovery rates, peak heap and unsupported-claim quality rates are not inferred. Numerical claim authority is tested with malformed citations/causal proposals, not scored by a model. No superiority claim follows from equal correctness or a lower call count in these scripts. Real-provider compatibility, stochastic reasoning quality and external release remain unvalidated.

Observed on2026-10-13 in [the baseline artifact](reports/PHASE_5_BASELINE.json), sourced from [the fresh browser artifact](reports/PHASE_5_EVALUATION.json):

| Metric | Single decision loop | Durable multi-role graph |
|---|---|---|
| Correct expected completion/status/evidence |20/20 each|20/20 each|
| Independent checks / material findings |20/20|20/20|
| VERIFIED / all checked outcomes |18/20 (two INCONCLUSIVE)|18/20 (two INCONCLUSIVE)|
| False VERIFIED / VERIFIED findings |0/18|0/18|
| Validated numerical report claims |18|18|
| Attempted mock HTTP calls |40|80|
| Median orchestration latency (20 samples) |2.894ms|248.578ms|
| Tokens / costs |Unavailable|Unavailable|

The browser also rejected12/12 adverse operations. These finite fixtures establish scripted correctness and bounded integration for this local configuration; the difference in calls and timing reflects the prescribed policies and persistence work.

## Release gating

All critical numerical/security/replay fixtures pass; zero false VERIFIED on the honest-client numerical correctness suite; no raw data/key leakage in instrumented paths; all cross-owner requests fail; all loops stop; no provider call during deterministic replay. Do not generalize finite fixture success to 100% safety/accuracy. Production compilation is a necessary build check, not a substitute for these tests.

Adversarial client-forgery tests assess provenance and authorization separately. A malicious client that forges both agreeing outputs can obtain local-agreement VERIFIED + CLIENT_REPORTED; this is an accepted trust limitation, not a claim that the server detected the forgery. Never count those adversarial cases as an attestation success or promise zero false local agreement against malicious clients. Numerical false-verification rates must identify the honest-client fixture population and provenance tested.
