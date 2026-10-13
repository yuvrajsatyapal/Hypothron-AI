# Phase 5 — local v1 release candidate

Date: 2026-10-13. Status: **PASS** for authorized local v1 release candidate (T5.1–T5.3); public roadmap exit T5.4 remains **BLOCKED**. This report reconciles [CURRENT_PHASE](../../CURRENT_PHASE.md), [T5.1–T5.4](../../TASKS.md), the [accepted scope](../../.planning/specs/phase-5.md) and [task plan](../../.planning/plans/phase-5.md). No deployment, publishing, push, paid resources or live inference is authorized or performed.

## Scope and implementation

The accepted ADRs retain exact `revenue_sum` IR1/2, included-row counts and supported exact percentage comparisons. Three source datasets can supply independent approved calculations, or a primary and one lookup plus one independent dataset. Each calculation permits one full-coverage one-to-one/many-to-one lookup. General segmentation, anomaly detection, arbitrary SQL/Python, causal inference, many-to-many joins and connectors are **DEFERRED**; adding them would require new operation contracts and verification semantics. Phase5 finishes the existing local workspace rather than replacing its design or orchestration.

- **Data integration:** [ingestion](../../apps/web/lib/ingestion.ts), [bridge](../../apps/web/lib/execution.ts), [Parquet decoder](../../apps/executor/src/ingestion.ts) and [runtime host](../../apps/executor/src/host.ts) import CSV or actual Parquet using the pinned DuckDB extension. Schema/row/type/expansion checks reject unsupported formats. Exact scalar strings avoid Arrow/JavaScript integer rounding. Floating, binary/nested, DATE and TIMESTAMP Parquet types refuse instead of guessing rounding or timezone semantics. CSV retains existing supported timestamp strings, fixed offsets, null policies and exact USD/EUR/JPY contracts.
- **Versioned provenance:** Original Parquet and canonical CSV have separate SHA-256 identities, decoder/normalization versions and explicit user approval. [Artifacts](../../apps/web/lib/artifacts.ts), [bundles](../../apps/web/lib/bundles.ts), [storage](../../apps/web/lib/storage.ts) and [replay](../../apps/web/lib/replay.ts) preserve originals and strict manifestv2 lineage. Existing CSV manifestv1 remains compatible. Replay checks both byte identities and executes the saved canonical CSV with zero inference; it does not reinterpret historical Parquet using a new parser.
- **Workspace:** [Page](../../apps/web/app/page.tsx) exposes schema, hashes, approval, supported relationships and separate local Cancel ownership. [Investigation](../../apps/web/components/Investigation.tsx) supports three bounded source identities, approved contracts and explicit consent, with separate file-read cancellation. Existing explorer, charts, reports, history, Save, import/export, cancellation/retry and fresh parent-linked AI workflow remain integrated. VERIFIED/CLIENT_REPORTED, DISPUTED, INCONCLUSIVE and errors remain distinguishable.
- **Evaluation:** [Twenty golden and twelve adverse fixtures](../../tests/fixtures/phase5-golden.json), [real-engine runner](../../tests/e2e/phase5-evaluation.spec.ts) and [offline comparator](../../services/api/src/hypothron/evaluation.py) retain all earlier fixtures. The comparator exercises genuine durable LangGraph/PostgreSQL with mocked external provider HTTP and a bounded single decision loop under equal ceilings. It adds no application route or runtime agent.
- **Operations:** [Allowlisted diagnostics](../../services/api/src/hypothron/operations.py), [retention](../../services/api/src/hypothron/retention.py), [driver](../../services/api/src/hypothron/driver.py), [graph](../../services/api/src/hypothron/agents/workflow.py) and [release policy](../../services/api/src/hypothron/release_policy.py) provide bounded correlation/stage/duration/category records, sanitized failures, scheduled transactional purge, local admission limits and HTTP security headers. [Local launcher](../../scripts/run-api.sh) uses one API process, no access logs and no proxy-header trust. [Read-only probe](../../scripts/release-probe.mjs) validates actual local readiness and exact worker CSP while reporting external release BLOCKED.

## Decisions and alternatives

[ADR022](../../DECISIONS.md) chooses bounded shared Parquet decoding and immutable source lineage over a second unpinned parser or server ingestion. DuckDB and Pandas independently compute arithmetic on the approved canonical CSV; decoding is shared. Agreement therefore does not certify independent Parquet parsing or server execution. A separate [Parquet runtime lock](../../packages/contracts/parquet-runtime.json) pins the real supported extension without silently altering historical execution runtime identity.

[ADR023](../../DECISIONS.md) chooses a strict diagnostic allowlist, scheduled existing transactional cleanup and a single-process local launcher rather than a paid telemetry service, background queue or distributed admission claim. Ordinary graph exceptions are sanitized before native saver persistence; interrupt/cancellation semantics continue through genuine graph behavior. Unexpected HTTP errors use stable INTERNAL responses, including started-SSE failures, without chained sensitive exception text reaching Uvicorn. No new migration is necessary; PostgreSQL migration0002 and native saver tables remain authoritative.

Limits remain 10 MiB/source, 10 MiB combined primary+lookup canonical CSV/calculation, 30 MiB original+derived snapshots/run, 100000 rows/source, 128 columns, conservative128 MiB decoded estimate, serial30 s heavy jobs,35 s bridge deadline,6 jobs and 12 attempted provider calls. Estimates are not hard heap isolation. No timeout/assertion was weakened.

## Acceptance evidence

| Gate | Classification | Evidence and limits |
|---|---|---|
| T5.1 supported CSV/Parquet/three-input workflow | PASS | Actual Parquet→paired engines→Save/export/import/replay; exact BIGINT; malformed/type/expansion refusals; three-source graph and immutable capture |
| T5.1 evaluation/baseline | PASS |20 golden/12 adverse actual engines; genuine equal-ceiling graph comparator; scripted HTTP only |
| T5.2 security/diagnostics/retention | PASS | Independent implementation review ACCEPT; log/checkpoint/error canaries, realDB expiry, cancellation ownership and local policy probes |
| T5.2 compatibility/performance | PARTIAL | macOSarm64 Chrome154 plus four emulated widths; finite synthetic samples and tracked allocations, no physical mobile/peak heap or real host |
| T5.3 documentation/learning/diagrams | PASS | Comprehensive deep dive, two new diagrams and reused earlier validated architecture/graph/replay/CI diagrams |
| T5.4 public deployment/live-host exit | BLOCKED | Separate authorization, real infrastructure and actual-origin/provider/backup/expiry evidence required |

## Validation and discovered defects

Final local commands use isolated PostgreSQL17 in task-owned `hypothron-phase5-db` on55433; unrelated55432 and other projects are preserved. Backend CI uses a separate disposable `hypothron_ci` database in that container. The CI database guard correctly refused the ordinary local database; preparing the expected disposable identity permits the unchanged guarded script. Provider transport is mocked; computation, graph, checkpoints, ownership, database transactions and browser storage are genuine.

| Command | Actual result |
|---|---|
| `pnpm test` |113 passed,19 files,3.83s; includes14 actual Pyodide/Pandas/NumPy tests |
| `pnpm typecheck` | Strict web and executor TypeScript PASS |
| `PATH=… bash scripts/ci/static.sh` | Ruff check/format41 files, mypy21 files, OpenAPI drift, actionlint/ShellCheck,4 Python network-guard tests PASS |
| `pnpm format:check`; Prettier E2E/config check | PASS |
| `pnpm executor:build`; web production build | PASS; integrity-locked runtime, Next15.5.27 root58.2kB/first-load161kB |
| `bash scripts/ci/backend.sh` / PostgreSQL17 upgrade→downgrade→upgrade |118 passed4.14s; schema/head check and active network audit PASS |
| `HYPOTHRON_PRODUCTION=1 pnpm exec playwright test` |39 passed7.4min; fresh production Next server, Chrome154 and both numerical engines |
| Focused investigation/Parquet/deferred-read tests |3 passed; cancelled files cannot enqueue late Parquet jobs or restore source state |
| Focused lifecycle performance test |1 passed13.4s; actual CSV/Parquet/storage/replay measurements |
| Read-only actual HTTP release probe |4 local targets PASS; external release deliberately BLOCKED |
| Task-owned PostgreSQL restart | PASS: same pending job, zero recovery inference calls, durable completion, duplicate ACK accepted |
| Diagram skill self-check/browser render/visual inspection | Two self-checks PASS; actual Chrome1440/390 rendering, no page overflow/clipped SVG text |

Representative RED→GREEN: absent evaluation module became seven meaningful tests; source/version and Parquet refusal fixtures preceded bounded conversion; graph exception canaries exposed sensitive native saver error text and now prove sanitization before persistence; nested HTTP failures exposed chained logging and are sanitized. Deferred digest/file-read races could start late work or overwrite newer state; pending reservation, owned abort controllers and identity-guarded result/finally updates now preserve cancellation. The first full browser pass had36/38 passing: stale consent assertions and asynchronous Delete→Import fixture timing were corrected with explicit reapproval/enabled-control waits. Focused reruns pass; the subsequent fresh complete run passed all39tests in7.4min. Process inspection confirmed the owned `next start` parent and Next15.5.27 child; production configuration now also refuses reuse of an existing dev server. The Phase3 runner writes disposable test-results instead of overwriting historical reports; its fresh full-run observations are retained separately in [previous regression evidence](PHASE_5_PREVIOUS_REGRESSION.json). The focused fresh-server/output-path/cancellation rerun passes2tests in49.2s, retaining all22prior-fixture numerical/refusal assertions.

## Evaluation, provenance and performance

The final [engine report](PHASE_5_EVALUATION.json) and [baseline](PHASE_5_BASELINE.json) share source SHA-256 `b705a437c924e34d4e4aae968f3ac74a2d81ba17c041a82f9a79487d77827342`. The fresh comparator ran under the CI Python network guard against the genuine disposable CI database; its audit passed. Both policies use model `gemini-test`, temperature0,12 attempted calls,1024 output tokens/call and6 jobs; shared verification and report validators consume the same measured browser results. The single arm is ephemeral, while the multi arm pays actual PostgreSQL/checkpoint overhead. Twenty golden questions cover exact sums/refunds/currencies, half-open periods/fixed offsets, approved joins, safe-integer boundaries, null/zero/empty findings, leap day and permutation. Twelve adverse cases reject unsupported/invalid operations; no invented graph comparison runs are counted for them.

Both scripted policies have20/20 correct evidence/status/completion,20/20 independent checks,18 VERIFIED and two expected INCONCLUSIVE outcomes,18 validated numerical claims and0/18 false VERIFIED honest-client findings. Calls are40 single/80 multi. Tokens, costs and live-model quality are unavailable. A contradictory-output probe is DISPUTED. A malicious client forging both agreeing outputs can still produce VERIFIED + CLIENT_REPORTED: accepted client provenance is not attestation, and this separate forgery boundary is never counted as an attestation success. No multi-agent superiority claim is supported.

Twenty-sample orchestration medians are2.894ms single and248.578ms multi; they exclude browser compute and reflect different persistence/bootstrap work. The measured local environment is AppleM2/8GiB, macOS26.6.2/Darwin25.6.0arm64, Chrome154.0.8037.100, DuckDB1.4.3, Pyodide0.29.3, Pandas2.3.3 and NumPy2.2.5.

| Lifecycle measurement | Actual single sample |
|---|---|
|10000-row CSV import/hash|130ms|
|Paired execution/UI|3877ms|
|IndexedDB Save|81ms|
|ZIP export|115ms|
|Stored playback load|96ms|
|Deterministic replay|4376ms|
|Import validation|115ms|
|Confirmed import Save|63ms|
|Two-row Parquet→canonical import/hash|842ms|
|Paired Parquet-derived execution/UI|3868ms|

Tracked worker timing is3413ms; DuckDB allocations890880bytes and Pandas dataframe1038966bytes; exported bundle322806bytes. These allocations exclude runtime overhead and are not hard peak heap measurements. [Performance JSON](PHASE_5_PERFORMANCE.json) records10000rows/318918CSVbytes/exact10100000minorunits plus a557byte two-row Parquet input; Save/load/export/import/replay and tracked engine allocations are actual observations. The performance artifact’s `os` field records the Darwin kernel (`os.release`), not the macOS product version; `sw_vers` independently reports26.6.2. One sample with browser automation/startup overhead is not a percentile, hard peak-heap or cloud benchmark. [Responsive JSON](PHASE_5_RESPONSIVE.json) checks1440/1280/768/390 widths, chart/table presence, labelled BYOK and no page overflow. It is not physical mobile runtime or a comprehensive screen-reader audit.

[Restart evidence](PHASE_5_RECOVERY.json) records WAITING_RESULT with two durable attempts before taskDB restart, the same pending job and zero recovery calls after restart, then COMPLETE with four durable attempts and idempotent duplicate ACK. Its synthetic client evidence probes durable protocol recovery rather than claiming a separate numerical execution benchmark. Other tests retain lost acknowledgments, invalid/stale/duplicate evidence, browser reload, worker termination, provider timeouts, corrupt bundles, runtime incompatibility and zero-inference replay.

## Security review and production limitations

Independent data/evaluation and operations/security reviewers inspected actual implementation, tests and failure canaries and returned ACCEPT after blocking findings were fixed. The scoped verdict applies to supported local operation, not public readiness. Raw data stays browser-local before explicit Save; metadata/approved aggregates remain sensitive. Keys stay short-lived and out of IndexedDB/PostgreSQL/logs/exports. Approved provider egress and budget reservations remain mandatory; paid/live provider requests were never made. Trusted compiled read-only SQL/fixed Python, genuine dual-engine arithmetic, native LangGraph and fenced durable PostgreSQL remain unchanged trust boundaries.

Residual limitations: client forgeability; shared Parquet decoder; decoded allocation before materialization despite metadata/expansion caps; browser copies/runtime overhead exceeding logical file size; fixed local executor origins; app-origin script access to unencrypted IndexedDB and eviction; physical devices/other browsers untested; local peer caps provide no distributed public abuse control; migrations/purge are not backup-retention proof. No instrumentation records raw rows, original filenames, keys, headers, full prompts or unapproved aggregates. No paid observability service or arbitrary execution path was added.

The existing read-only GitHub Actions workflow remains linted and includes Phase5 browser observations followed by offline baseline generation. **No new hosted Phase5 CI run was executed.** Historical [run38290929211](https://github.com/yuvrajsatyapal/Hypothron-AI/actions/runs/38290929211) at `8bd118c5b6c6c297ea385b3cd7e0355ab3ed470e` validated Phase4.5 only. New LinuxARM64 Chromium Phase5 results await an authorized push/run; local Chrome evidence is separate.

Before public invitation, obtain authorization for the selected actual host and verify TLS, frontend/executor origins and pinned workers/CSP, CORS, provider destinations, SSE proxy buffering/cold-start/recovery, owner/session behavior, distributed admission, DB connectivity/migrations/readiness, quotas/free-tier eligibility, secrets, rollback, expiry/deletion and backup retention. [Deployment guide](../DEPLOYMENT.md) lists concrete steps. Changing APP_ORIGIN alone cannot relocate the fixed browser bridge. No Phase6 is started.

## Learning, diagrams and commits

Read the [Phase5 deep dive](../learning/PHASE_5_DEEP_DIVE.md) and [system study guide](../SYSTEM_DESIGN_GUIDE.md). The deep dive covers18 requested architectural topics, implementation flows/code examples, twelve detailed interview answers and practical exercises. New [ingestion/verification](../diagrams/phase-5-ingestion.html) and [local release/external gates](../diagrams/phase-5-release.html) diagrams complement earlier full architecture, graph lifecycle, checkpoint recovery, provenance, persistence/replay and CI diagrams linked from ARCHITECTURE. Both passed the installed diagram-design self-check and actual browser visual inspection;193local documentation link references resolve, evaluation-source binding and historical report identity pass; responsive diagrams allow local scrolling without page overflow.

Study first: exact decimal/time/null semantics and join proofs; canonical identity/provenance versus attestation; worker isolation/cancellation/memory ownership; LangGraph interrupts and durable attempt reservations; lease/epoch fencing and checkpoint/ledger reconciliation; immutable Save/replay versus fresh AI; BYOK disclosure/budget/security; evaluation denominators and scripted-versus-live limits; deployment/SSE/CSP/backup gates.

Local main commits, without history rewriting:

- `6fb8dc3fd7c3594147ddd30311ab70df2aabf681` — bounded data/lineage/three inputs.
- `58d60d8845abe4706827f1111198f7efc6c295e4` — diagnostics, retention and release safeguards.
- `a7af282b2ff81b2642373ddad265d21e2bf2bc9e` — reviewed cancellation followup.
- `5604b8d105092e741867b7269affa248c982c944` — real-engine evaluation, equal-budget comparison and repeatable performance harness.
- The documentation closure hash follows in the final user receipt; the final documentation commit is identified by the Git log and final user receipt to avoid self-referential commit identity.

Unrelated untracked `services/api/.env.example` remains untouched and excluded. Local candidate acceptance does not waive T5.4. External actions require separate authorization; no routine task approval is needed.
