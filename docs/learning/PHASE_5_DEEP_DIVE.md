# Phase 5 — Local release engineering, source lineage and honest evaluation

This guide explains actual Phase5 code, including its inherited numerical, persistence and recovery boundaries. The local implementation is being validated; external release is **BLOCKED**, not completed by localhost tests. The [Phase5 specification](../../.planning/specs/phase-5.md) and [plan](../../.planning/plans/phase-5.md) define scope. [Current phase](../../CURRENT_PHASE.md) and the final phase report own live gate status and commit hashes. Numerical observations come from [the browser evaluation](../reports/PHASE_5_EVALUATION.json) and [the baseline comparison](../reports/PHASE_5_BASELINE.json), not examples invented for this guide.

For earlier fundamentals, read the [Phase2 orchestration guide](PHASE_2_DEEP_DIVE.md), [Phase3 verification guide](PHASE_3_DEEP_DIVE.md), [Phase4 persistence guide](PHASE_4_DEEP_DIVE.md) and [Phase4.5 CI guide](PHASE_4_5_CI_DEEP_DIVE.md). This chapter concentrates on how those mechanisms compose under the final local workflow. Its eighteen topics are a code-reading route, interview preparation and a production-risk checklist.

## 1. Before and after: what this phase changes

Before Phase5, the product already supported browser-memory CSV analysis, typed conditional LangGraph, durable owner-scoped jobs, exact independent verification, explicit local Save, portable bundles and zero-inference replay. It had a passing hosted CI prerequisite. Those capabilities did not establish Parquet ingestion, a twenty-question evaluation, a single-agent comparison or public hosting readiness. The project deliberately preserves this distinction between an accepted architecture, implemented behavior and measured evidence.

Phase5 adds bounded Parquet normalization using the pinned execution runtime, visible original/derived identities, final multiple-source handling, version2 saved lineage, an offline equal-budget policy comparison, operational diagnostics, scheduled expiry and local release probes. It does not introduce arbitrary analytical code, an unrestricted connector, a server upload endpoint or a new database analytics service. The supported operation remains `revenue_sum` IR1/2; exact totals, row counts and compatible exact percentage changes are the supported numerical report claims.

The requirement chain explains the design: raw data must stay local; independent arithmetic requires a common approved input; Parquet needs decoding; replay needs stable bytes and semantics. Therefore the system retains original Parquet plus a declared canonical CSV derivative. That derivative is the approved analytical identity. ADR022 records the trade-off: genuinely independent arithmetic follows a shared decoder. An independent second Parquet parser would add runtime and compatibility surface; pretending that Pandas independently decoded the original would misstate the implemented trust boundary.

Read [DECISIONS.md](../../DECISIONS.md), especially ADR002–009,015–022, before changing this flow. A wider operation family, changed raw-data persistence or live-host trust boundary needs a new decision and tests. It cannot be hidden inside an import convenience fix.

## 2. Architecture: three responsibilities, three trust boundaries

Next.js owns user interaction, local bytes, approved contracts, artifact storage and the execution bridge. FastAPI owns API authorization, ephemeral provider calls, deterministic budgets and LangGraph orchestration. A separate credential-free static origin owns DuckDB-WASM/Pyodide workers. These boundaries are visible in [page.tsx](../../apps/web/app/page.tsx), [Investigation.tsx](../../apps/web/components/Investigation.tsx), [api.py](../../services/api/src/hypothron/api.py), [host.ts](../../apps/executor/src/host.ts) and [worker.ts](../../apps/executor/src/worker.ts).

The API receives approved schema/contract metadata and bounded aggregate results. It does not receive uploaded rows or original filenames. The execution worker receives the approved plan and source bytes, but no bearer capability or BYOK. PostgreSQL stores expiring metadata, protocol records, bounded evidence and sanitized checkpoints. IndexedDB holds raw snapshots only after explicit Save/import consent. Each store has a different purpose and privacy consequence.

FastAPI's asynchronous routes and SQLAlchemy async sessions manage I/O; they do not execute browser analytics. Python `async` lets a request yield while PostgreSQL/provider I/O waits, but it does not make a CPU-intensive loop safe for an API event loop. This is why the deterministic analytical work remains in dedicated browser workers. Next.js also does not duplicate orchestration: its `drive` function executes and submits server-issued jobs, while LangGraph decides the next authorized step.

The existing [Phase3 evidence lineage diagram](../diagrams/phase-3-evidence.html), [Phase4 persistence architecture](../diagrams/phase-4-persistence.html) and [CI diagram](../diagrams/phase-4-5-ci.html) explain these boundaries. A worker improves responsiveness; origin/CSP/allowlisted execution controls provide the separately tested security restrictions. Neither a worker nor a hash establishes remote attestation.

## 3. Technology selection and runtime identity

DuckDB-WASM supplies embedded analytical SQL without a server data upload. Pyodide supplies a real Python runtime and Pandas implementation in the browser. They cost substantial initialization and memory, but make independent exact recomputation possible within the existing local target. LangGraph supplies typed state, conditional edges, interrupts and checkpoint integration; PostgreSQL supplies owner-scoped durable policy and transactions. Dexie supplies an ergonomic wrapper around IndexedDB transactions. These technologies solve different problems rather than forming a compulsory agent chain.

The measured runtime identifies DuckDB engine `v1.4.3`, Pyodide `0.29.3`, Pandas `2.3.3` and NumPy `2.2.5`. Engine version is distinct from the DuckDB-WASM package version. [runtime asset locking](../../packages/contracts/runtime-manifest.json) and [Parquet runtime locking](../../packages/contracts/parquet-runtime.json) bind packaged assets. The bootstrap/build/verification scripts mirror and verify fixed assets; runtime computation does not install arbitrary packages from the network.

In `worker.ts`, Parquet mode loads the fixed bundled extension after disabling automatic extension install/load. It registers a task-owned in-memory file named `source.parquet`. The nested DuckDB worker receives preloaded pinned assets; compute CSP denies connection attempts. A repository URL in configuration does not grant a dataset-bearing worker permission to fetch arbitrary remote extensions.

Pins enable inspectable compatibility decisions, not universal bitwise reproducibility. Compiler/runtime changes can alter behavior. Saved artifacts refuse unsupported versions, and actual replay compares outputs. Production trade-offs include large static assets, cold initialization, browser-specific WASM behavior, platform memory pressure and a strict supported-operation surface. Choosing a server sandbox could improve centralized execution control, but would change privacy/cost assumptions and require separate authorization.

## 4. Parquet ingestion: the complete numbered flow

Read [web ingestion.ts](../../apps/web/lib/ingestion.ts) then [executor ingestion.ts](../../apps/executor/src/ingestion.ts). The complete flow is:

1. `readLocalInput(file,executor)` rejects empty files, files above 10 MiB and unsupported suffixes before `arrayBuffer()`. CSV retains its original bytes/hash. Parquet retains original bytes and calls `LocalExecutor.ingest`.
2. The bridge posts a `PARQUET` message with a bounded ID and bytes over the already authenticated exact-origin MessageChannel. The host checks message shape, active-worker state and source size. Unknown fields are not an extension mechanism.
3. `parquetEnvelope` checks `PAR1` at both ends and a sane footer length, capped at 1 MiB. This inexpensive check rejects obvious malformed envelopes before expensive runtime work.
4. The host creates one worker and starts its 30-second timer. The worker installs in-memory assets, initializes DuckDB, loads the pinned Parquet extension and registers the original bytes.
5. `convertParquet` queries `parquet_metadata` and `parquet_file_metadata`. It rejects row counts above 100,000, extreme row-group counts and an estimate above 128 MiB before full row materialization.
6. `DESCRIBE ... read_parquet` supplies names/types. `supportedSchema` allows bounded identifier-safe distinct names and a narrow scalar type set. Floating, binary, nested, date and timestamp types refuse. Timestamp strings may pass storage typing but must still satisfy the metric's explicit timezone/calendar contract later.
7. A trusted projection casts permitted scalar columns to `VARCHAR` inside DuckDB before Arrow/JavaScript can turn exact decimal/large integer values into lossy numbers. Validated identifiers are quoted in fixed SQL; the model supplies no projection code.
8. Materialized rows become canonical CSV. Null becomes an empty field; non-null empty strings and control characters refuse rather than collide with missing-value semantics. Quotes are doubled. Each row updates UTF-8 byte and expansion bounds.
9. `preflightCSV` validates the generated snapshot. The result contains `sourceHash`, `datasetHash`, `parquet-csv-v1`, `duckdb-v1.4.3`, row count and schema. Host/bridge validate the exact result shape; the original bytes remain local alongside the derivative.

The conversion is approximately O(rows×columns + encoded bytes). Materialization holds rows before building CSV, so a preflight estimate is not a hard peak-heap cap. Metadata decoding itself allocates; adversarial files may cause allocation before all estimates. The correct failure claim is bounded accepted input plus worker termination and explicit refusal—not portable guaranteed memory isolation.

## 5. Exact arithmetic: decimal strings are part of the algorithm

[contracts.ts](../../apps/executor/src/contracts.ts) validates approved IR and generates fixed computation templates. [advanced.ts](../../apps/executor/src/advanced.ts) supplies independent semantic diagnostics. Monetary results travel as signed integer strings, not JavaScript `number`. USD/EUR use two minor-unit digits; JPY uses whole yen. No currency conversion is implied.

For example, the illustrative values 10.10, 20.20 and 0.03 become 1010, 2020 and 3 minor units, summing to 3033. Binary floating point may not represent each decimal exactly. Integer-string transport plus DuckDB exact decimal/scaled arithmetic and independent Python decimal/integer logic prevents an intermediate JavaScript rounding step from defining the monetary answer. The actual G01 fixture separately measures this total; the example explains representation rather than claiming a new benchmark.

The period is half-open: `start <= timestamp < end`. A row exactly at October 1 is excluded from a July 1–October 1 interval. Fixed offsets are explicit; named-zone/DST inference remains unsupported. Accepted strings must satisfy the exact suffix and calendar validation. Null exclusion produces an included-row count distinct from raw population. An empty or null-only period has `minorUnits:null,count:0`, not a fabricated zero.

`verify_evidence` compares count, missingness, value and v2 diagnostics. Exact tolerance is zero absolute/relative minor units. Two genuine zero-valued rows may produce a VERIFIED zero; no contributing rows produce INCONCLUSIVE. Arithmetic agreement cannot prove that the user approved the correct business metric. This is why a contract includes source identity, amount/date columns, currency, null policy, grain, period and relationship.

Summation is O(n); date/null checks scan the bounded population. Group/distinct checks can require additional memory and depend on engine implementation. Tests use hand-derived expected values and metamorphic properties, such as row permutation. Comparing two engines alone cannot detect a shared wrong specification.

## 6. Grain and joins: proving a relationship cannot multiply revenue

A grain specifies what makes one original observation unique. A single `order_id` may suffice; a composite `(order_id,line_id)` may be required. `sqlDiagnostics` requires non-null grain keys and `grainUniqueRows == populationRows`. The independently generated Pandas diagnostics make the same semantic check through a different implementation. Silently dropping duplicates would change the requested metric and hide upstream data problems.

The implemented lookup is a full-coverage approved one-to-one or many-to-one relationship. It is not a general join graph. Suppose two sales rows share customerA and the lookup contains exactly oneA row: many-to-one is valid. If the lookup contains twoA rows, an SQL join could duplicate both sales and inflate revenue. Therefore diagnostics reject duplicate/null lookup keys, null primary join keys, unmatched primary rows and changed joined population. One-to-one additionally requires unique primary join keys.

The proof obligations are stronger than matching totals: original population equals approved `populationCount`; all grain keys remain unique; lookup keys are unique; every primary key matches; joined row count and joined grain count equal original population. A coincidental equal total cannot waive any of these checks. The derived join view does not overwrite either source snapshot.

Read [sqlDiagnostics](../../apps/executor/src/advanced.ts), worker lookup loading, [MetricPlan/Relationship](../../services/api/src/hypothron/agents/models.py) and [verify_evidence](../../services/api/src/hypothron/verification.py) together. The worker rejects malformed data before a result exists; backend verification additionally checks received bounded diagnostics. Client diagnostics remain untrusted client reports. Their agreement is useful for accidental errors, but the server cannot attest the original rows it never received.

## 7. Multiple inputs, consent and three different size ceilings

`validateInputSet` counts at most three logical sources, including an approved lookup. A Parquet source plus its derived CSV occupies one logical slot, but both byte copies count toward retained-input size. Duplicate derived identities and duplicate original identities reject. An independent third dataset may support another approved contract; three uploaded sources do not authorize unrestricted cross-dataset operations.

There are three distinct ceilings. Each original/derived snapshot is at most 10 MiB. The local input set/artifact raw bytes are at most 30 MiB combined. A single analytical execution receiving primary plus lookup is at most 10 MiB combined, checked by both host and worker. Therefore two individually valid 6 MiB files may fit local retention but cannot form a 12 MiB joined execution. Serial independent jobs are governed separately. This distinction should appear in UI guidance and tests; increasing an archive cap must not accidentally increase compute authority.

The page displays canonical source/version information and requests explicit metric/relationship approval. Changing local inputs invalidates stale approvals. `Investigation` retains approved inputs—including unused ones—and freezes the original question/provider/model at creation. Resume does not reinterpret a checkpoint through whatever form values the user later typed.

Upload consent, provider consent and persistent Save consent are distinct. Upload places bytes in memory; starting AI authorizes disclosed metadata/aggregate provider work; Save/import creates local durable copies. An automatic OPFS cache or service worker snapshot cache would violate the same persistence boundary even if it bypassed IndexedDB. The invariant is about durable sensitive data, not a preferred browser API.

## 8. LangGraph: typed roles inside a conditional workflow

[workflow.py](../../services/api/src/hypothron/agents/workflow.py) builds genuine `StateGraph` nodes: planner, clarification, analyst, issue, accept, correction and report. State is JSON-shaped approved metadata/evidence; provider credentials remain outside it. Pydantic role models forbid unknown fields and bind hypothesis IDs/source hashes. A malformed structured reply fails with a stable code rather than executing improvised code.

The planner proposes up to six prioritized hypotheses using approved dataset identities. It may request one clarification. The analyst selects an existing hypothesis or finishes; the selected hypothesis chooses the exact approved contract. The issue node creates/checkpoints the immutable job ID before the accept node interrupts. This separation matters because an interrupted node may restart: creating an ID inside the restarting wait node could duplicate a job.

Acceptance validates job/source binding and recomputes the deterministic verdict. DISPUTED evidence routes to deterministic correction, preserving the original contract and dependency history, with at most two corrections per canonical metric and six total jobs. It cannot relabel a disagreement as agreement or silently revise null policy. Exhausted correction/job bounds route to reporting with the disagreement visible.

Planner/analyst/report attempts share a twelve-call ceiling. Reporting revalidates evidence from original issued contracts, then passes typed claims through `validated_report`. An invalid draft or exhausted report budget produces deterministic fallback without an extra repair call. No evidence yields a no-supported-numerical-claim report. The conditional flow therefore differs materially from always running a fixed chain or adding a critic LLM to vote on arithmetic.

## 9. PostgreSQL ledger: transactions own authorization and idempotency

[ledger.py](../../services/api/src/hypothron/ledger.py) is the policy authority beneath framework routes. Owner identifiers are explicit inputs; reading a run by UUID alone does not authorize it. `Ledger.create` validates `RunInput`, inserts an owner/input/model-bound request ID idempotently and rejects conflicting reuse. Its transaction includes the creation event. API creation performs zero inference.

`reserve` durably records an attempted call before outbound HTTP. It binds ordinal, role and context digest. A completed identical attempt can return its cached structured reply. An unresolved previous reservation is billing-unknown; recovery must not assume the call failed or blindly repeat a potentially billed request. `complete_attempt` validates bounded role output and stores observed usage/request time. Missing usage is null, never invented zero.

`issue` enforces an independent six-job cap. `submit` validates the typed payload, source/job binding and ownership, accepts an identical duplicate idempotently and rejects conflicting duplicates. Related result/event changes occur transactionally. Database constraints and application policy complement each other: a route-level check alone can race; constraints alone cannot express every budget/recovery rule.

Application persistence uses parameterized SQL and async repositories. Restricted analytical SQL is a separate compiler surface running in browser memory. Do not confuse those two SQL trust models. An input field that safely becomes an application SQL parameter does not thereby authorize arbitrary analytical SQL, filesystem extensions or a new metric contract.

## 10. Leases, fenced savers and crash recovery

A lease contains run ID, holder and monotonically changing epoch. Claim/replacement/cancellation serialize on the run row. [FencedPostgresSaver](../../services/api/src/hypothron/checkpoints.py) checks `thread_id` against lease scope and wraps reads/writes in `ledger.fence`. The lock spans each native saver operation. A stale process cannot append checkpoints merely because it still holds a Python object with an old lease.

The native saver uses a separate psycopg connection while the SQLAlchemy transaction holds the fence. There is no single transaction atomically committing both LangGraph checkpoint and business ledger. [InvestigationDriver._advance](../../services/api/src/hypothron/driver.py) therefore reconciles boundaries:

1. Authenticate/read the owner-scoped run and validate stored provider/known-secret exclusions.
2. Claim the lease, open the run-scoped fenced saver and build a request-scoped provider adapter.
3. Read the graph snapshot. Fresh state starts through `initial_state`; existing clarification requires an explicit answer; existing pending job is reconciled into the ledger.
4. If that job has no accepted result, return WAITING_RESULT without inference. If accepted, resume with its immutable stored payload.
5. Invoke the graph under recursion/segment deadlines, issue any pending job and persist status. Release the lease in `finally` under its own short cleanup deadline.

This handles a crash after checkpoint issuance but before ledger insertion by recovering the same job ID. A crash after accepted result but before graph resume reads the accepted payload. A crash after provider reservation preserves billing ambiguity. `test_driver.py` and `test_recovery.py` reproduce these cases; they are more meaningful than checking that a graph compiles.

Serialization disables pickle fallback and arbitrary allowed modules. Checkpoints contain approved JSON state, never raw rows, keys or exception objects. SSE observes finite durable events; it is not the sole state authority. If streaming fails, Resume reads durable state. Request-triggered segments do not promise background investigation after the browser leaves.

## 11. BYOK and the provider HTTP boundary

[RequestRoleProvider](../../services/api/src/hypothron/agents/provider.py) combines role instructions, approved metadata/evidence context and a strict reply schema. [generate](../../services/api/src/hypothron/providers/http.py) permits only fixed Gemini/OpenRouter destinations and validated model IDs. Users cannot supply a proxy URL. The request-scoped key is a `SecretStr`; extraction happens only for the HTTP header.

The adapter disables environment proxies, redirects and automatic retries. It bounds prompt/request/response sizes, accepts identity encoding, enforces timeouts and checks provider completion semantics. Gemini requests use `maxOutputTokens:1024`, temperature0 and structured JSON schema. The API's durable attempt reservation happens before this transport. SDK convenience retries would undermine attempted-call accounting and billing-unknown recovery, so explicit single-attempt transport is intentional.

Known credentials are excluded from inputs and decoded outputs, including nested/escaped echoes. This is not a universal transformed-secret detector. Keys stay outside state, URLs, logs, artifacts and exports. They disappear on reload and must be resupplied for authorized continuation. The executor never receives them. Provider/model metadata may still be sensitive; approved aggregates are not automatically anonymous.

Automated tests use mock HTTP at the external boundary while retaining actual validation and wire format. Neither a working mock nor a syntactically valid model ID proves live availability, capabilities, price or provider privacy behavior. Those are separate opt-in release/evaluation questions; this phase performs no paid inference.

## 12. Error sanitization and structured diagnostics

[operations.py](../../services/api/src/hypothron/operations.py) accepts only enumerated events/roles/nodes/status/categories and bounded integer attempt/duration values. A valid UUID correlation ID becomes a SHA256 `runDigest`; the logger does not accept arbitrary context dictionaries. Raw rows, column values, aggregates, prompts, headers, keys and exception text have no telemetry field. It rejects invalid diagnostics instead of filtering whatever arbitrary object a caller handed it.

Driver/node/provider hooks record start/completion/failure/pause/cache/reconciliation events. LangGraph interrupt is expected pause behavior, not an internal error. Tracing is disabled around sensitive graph execution. Durations are capped; exceptions are translated into stable policy/category codes. A digest is still a correlation identifier, not a promise of anonymity.

[ReleasePolicy](../../services/api/src/hypothron/release_policy.py) adds no-store, nosniff and no-referrer headers to HTTP responses. Its outer privacy boundary prevents unexpected exception payloads from escaping into Uvicorn traceback logging. Before response start it can send a sanitized500 envelope; after SSE starts it can only end the body. It tracks started/finished state because sending a second response start would violate ASGI protocol. Failed transport writes must not chain the original private exception. Cancellation, a `BaseException`, still propagates.

This is one of the rare justified broad exception catches: the boundary deliberately records only an allowlisted INTERNAL category, while ordinary domain code catches precise expected errors. Tests inject a private canary into unexpected route and background failures. They verify containment and operational signal together; suppressing every failure without signal would make the service unmaintainable.

## 13. Scheduled retention and shutdown

[purge_loop](../../services/api/src/hypothron/retention.py) runs one bounded transaction per tick, then waits on a stop event with the configured interval. It does not busy-poll or introduce a queue service. Database failures roll back and emit a sanitized DATABASE category; unexpected failures emit INTERNAL without their text. Cooperative cancellation/shutdown remains intact.

`purge_expired` locks at most 100 expired run parents, including runs whose sessions expired. Current saver writers require those same parent fences. It removes native checkpoint writes/blobs/checkpoints before deleting run records, and deletes expired sessions only after no runs remain. A bounded orphan-checkpoint cleanup handles legacy orphan thread IDs. Multiple ticks can finish a backlog; one tick does not claim instant removal of every expired row.

FastAPI lifespan starts the purge task, sets stop on shutdown, waits under a six-second bound and cancels/gathers if needed, then disposes the engine. A sleeping host cannot continuously execute this loop. On restart, an expiry sweep can resume cleanup; external backup retention/deletion and host downtime require separate policies. Local database expiry is not proof that a provider, exported bundle or browser-saved copy was deleted.

The session admission cap is also local: 20 session creations per peer per 60-second window with at most 1024 tracked peers. It resets with the process and is not distributed public abuse protection. Proxy headers are disabled in the documented local launch; treating arbitrary forwarded peers as trusted would let callers manipulate this policy. A public proxy topology needs explicit trust configuration and evidence.

## 14. Manifest2: source lineage without rewriting history

[artifacts.ts](../../apps/web/lib/artifacts.ts) chooses manifest2 only when original Parquet sources exist. CSV-only records retain manifest1. Each source-lineage record binds original `sourceHash` to derived `datasetHash`, normalization/decoder, row count and schema. The manifest may contain up to six blobs: at most three executable canonical snapshots plus their original Parquet copies. Six blobs do not mean six analytical inputs.

Validation requires exact fields, distinct original/derived identities, matching `.parquet`/`.csv` descriptors, permitted schema and bounded counts/sizes. Original Parquet hashes are removed from executable dataset identities; they cannot masquerade as canonical approved contracts. It recomputes each blob hash, validates plans/generated source/evidence/report and refuses unknown versions. A declared lineage is integrity metadata, not cryptographic proof that a hostile client actually performed conversion.

`canonical` sorts object keys, preserves array order, rejects unsupported values/non-finite numbers/lone surrogates and bounds nesting. A manifest digest identifies exact supported representation. Different key insertion order normalizes; different ordered dependency arrays remain different. Hashes serve different scopes: source bytes, approved contract, runtime lock, evidence and complete manifest. None proves authorship or causality.

`LocalStore.save` revalidates detached inputs before one IndexedDB transaction handles collision, deduplication, quota and writes. Storage remains schema1; manifest content version2 is not an automatic database migration. `bundles.ts` retains strict STORED ZIP, adds only hash-named Parquet originals for manifest2, and validates canonical envelope/path/CRC/offset/size/schema/hash/IR before import consent. Unknown formats refuse. Original history is preserved rather than silently converted to a new version.

## 15. Replay, playback and fresh AI are separate operations

[replayArtifact](../../apps/web/lib/replay.ts) validates artifact integrity/compatibility, visits approved calculations in dependency order, selects canonical CSV primary/lookup snapshots and invokes the existing executor. For Parquet artifacts, it does not re-decode original Parquet: the approved derivative is the saved execution input. Original bytes remain provenance/history. A future re-normalization would need explicit versioned semantics and a new artifact.

`comparable` selects deterministic source/schema/population/results/diagnostics/generated-source fields. Timing and allocations are historical observations but excluded from numerical equality. Replay recomputes verification and records MATCH/MISMATCH or explicit cancellation/failure separately; original accepted evidence remains immutable. Active tests fail on any API/provider call during replay. The code dependency graph has no provider/planner path, and runtime guards exercise that promise.

Playback simply renders historical evidence. Import hashes validate integrity but cannot validate client honesty; imported agreement remains historical CLIENT_REPORTED. Fresh AI requires new consent/key/budget, creates a distinct parent-linked run and may choose different hypotheses/plans. Comparing fresh reasoning is nondeterministic evaluation, never replay.

`Investigation.drive` retains the local compiled result before result submission. Lost ACK recovery can read durable acceptance and still Save the full original local evidence. Reconstructing an execution from server scalar totals would discard generated source/runtime/local diagnostics and invent a provenance story. Capture selects accepted IDs while retaining approved unused inputs, which supports a faithful later fresh run.

## 16. Concurrency, cancellation and resource observations

The executor permits one heavy worker job at a time. The host terminates it on cancellation, error or 30-second deadline; the client has its 35-second deadline and generation/AbortSignal checks. Transferable ArrayBuffers move copies into worker ownership. Copies preserve the application's original immutable snapshots, but copying also consumes memory. Nested DuckDB resources and connections close in cleanup paths.

The driver has bounded active segments, 60-second segment deadlines, finite graph recursion and database connect/statement/lock timeouts. Local semaphores protect one driver/process instance, while PostgreSQL fencing protects run correctness across concurrent holders. Neither mechanism alone provides a deployment-wide admission budget. Logical storage quota, source bounds, decoded estimates and worker deadlines constrain different resources.

Measured `pandasDataframeBytes` and `duckdbTrackedBytes` are specific tracked allocations. They exclude browser engine/WASM heaps, runtime assets, intermediate buffers and OS accounting. Process-tree RSS sampling, where available, captures another scope and is still a sample rather than a hard peak guarantee. A maximum accepted input is not a maximum total process footprint. See ADR015 and the Phase1 measurements for why device scope matters.

Cancellation has several boundaries: stop UI submission, abort fetch/SSE, terminate local computation, cancel durable run/fence and prevent stale generations from updating current UI. A completed response racing Cancel must not resurrect a cancelled run. Tests reproduce cancellation/recovery rather than weakening deadlines to fit slow emulation. Narrow viewport checks assess layout/accessibility; they do not prove physical mobile CPU/memory support.

## 17. Evaluation, tests and the blocked public release

[evaluation.py](../../services/api/src/hypothron/evaluation.py) is an offline harness, not a product route. Its single-agent policy combines approved-contract selection and reporting in one structured decision loop. The multi-role arm runs `InvestigationDriver`, `RequestRoleProvider`, real PostgreSQL ledger and fenced native checkpoints. Both use scripted Gemini HTTP/model `gemini-test`, temperature0,12 attempted calls,1024 output tokens per call and6 jobs, with the same verifier/report validator.

The comparator reads fresh real-browser observations. It requires32 distinct IDs, validates golden contract/source/lookup identities and compares observed SQL/Pandas/status to hand-derived expectations. Scripts choose approved inputs and quote observed verified values; they do not contain golden numerical answers. The twenty golden runs are eligible orchestration comparisons. Twelve adverse execution rejections have a separate denominator because no valid result exists to report.

The measured comparison generated 2026-10-13T12:59:59.049519+00:00 references browser report SHA256 `b705a437c924e34d4e4aae968f3ac74a2d81ba17c041a82f9a79487d77827342`. Both arms have 20/20 correct evidence/status/completion, 20 independent checks, 18 VERIFIED findings, two expected INCONCLUSIVE outcomes and 0/18 false VERIFIED. They publish 18 validated total claims. Single uses 40 mock calls; multi uses 80. Twenty-sample median orchestration latency is 2.894 ms versus 248.578 ms. Tokens/cost/p95 remain unavailable. Timings exclude reused browser compute and differ in persistence/bootstrap work: they do not establish live reasoning or controlled performance superiority.

Final guarded backend CI reports 118 passed in 4.14 s, including seven baseline tests, PostgreSQL17 upgrade/downgrade/upgrade and application/native-saver schema checks. Exact static CI passes Ruff check/format on41files, strict mypy on21sourcefiles, OpenAPI drift, workflow/shell lint and four network-refusal tests. Frontend/executor units report113passed in19files (including14realPyodide tests), strict TypeScript and production builds pass. The phase report records the separately executed final browser count and limitations. Meaningful tests include genuine Parquet/browser integration, lineage/tamper units, exact golden/adverse engines, realDB fencing/expiry, unexpected-error canaries, active egress/refusal and zero-inference replay. RED began with absent modules/failed behavior, then GREEN retained strict refusals. Builds alone do not certify these boundaries.

The commands behind that backend/evaluation snapshot are:

```sh
source /tmp/hypothron-phase5-env.sh
services/api/.venv/bin/pytest -q services/api/tests
services/api/.venv/bin/mypy --config-file services/api/pyproject.toml services/api/src
services/api/.venv/bin/ruff check services/api/src/hypothron/evaluation.py services/api/tests/test_evaluation.py
services/api/.venv/bin/python scripts/export-api-contracts.py --check
services/api/.venv/bin/python -m hypothron.evaluation \
  --observations docs/reports/PHASE_5_EVALUATION.json \
  --output docs/reports/PHASE_5_BASELINE.json
```

The temporary environment targets the isolated migrated PostgreSQL17 fixture on 55433, not an unrelated local database. Full phase gates additionally run the repository's frontend/executor units, TypeScript, locked asset checks, builds, migrations and actual browser suite; their final commands/results belong to the phase report. Documentation validation checks real local links and code consistency, not artificial application tests. If a later browser run replaces the source evaluation, regenerate the comparator and update its cited timestamps/medians.

[release-probe.mjs](../../scripts/release-probe.mjs) reads local readiness/migration and exact security headers/CSP for executor/main/nested worker. It follows no redirects and uses a five-second request bound. Successful probes still print `release:BLOCKED`. Actual origins/TLS, proxy/SSE buffering, cold starts, backups/retention, distributed admission, live provider compatibility and physical devices require separate evidence/authorization. Historical hosted Phase4.5 CI is a prerequisite; it is not a new hosted Phase5 run or a deployed product claim.

## 18. Interview answers, exercises and prioritized study

**Two-minute explanation.** “Hypothron separates model decisions from numerical authority. Uploads stay in browser memory. Parquet is decoded by a pinned local DuckDB runtime into a labelled canonical CSV; both engines then independently compute the exact approved metric. The model chooses existing contracts, never arbitrary code. FastAPI/LangGraph retains owner-scoped jobs and bounded evidence in PostgreSQL, with leased fenced checkpoints and idempotent recovery. Keys exist only for short request segments. Explicit Save retains immutable source lineage and runtime-bound artifacts; replay recomputes approved operations with zero model requests. Equal-budget scripted evaluation proves finite routing/validation behavior, not model superiority. VERIFIED plus CLIENT_REPORTED is local agreement, and public release remains blocked until real-host gates pass.”

**Ten-minute explanation.** Use one minute each for architecture/privacy; Parquet identity; exact decimal/date semantics; grain/join proof; graph/correction policy; ledger/attempt reservation; fenced recovery; explicit artifacts/replay; evaluation denominators; release/resources/remaining risks. Draw a pending job crossing checkpoint and ledger commits, then explain the reconciliation. Close with the forged paired-result boundary: integrity and honest computation are different guarantees.

1. **Why is Parquet arithmetic independent but decoding shared?** Both trusted arithmetic implementations consume the same approved canonical CSV. One DuckDB decoder produced it, so a decoder bug can affect both. Original/derived identity and hand-derived golden cases improve inspectability, but cannot manufacture parser independence. Follow-up: propose a second parser and measure added assets/memory/semantic compatibility before broadening the claim.
2. **Why reject float or timestamp Parquet types?** They need rounding/timezone/missing-value contracts not presently implemented. Converting a binary float to a decimal-looking string or guessing a timestamp zone can silently change meaning. Explicit refusal preserves the supported exactness contract. Follow-up: design a versioned contract before adding a type.
3. **Why save the canonical CSV if original Parquet is retained?** Replay must execute exactly the approved snapshot/normalization version. Re-decoding later can change representation. Original bytes preserve lineage; canonical bytes preserve execution identity. Neither alone is sufficient for the full history story.
4. **Can matching sums prove a join is safe?** No; duplication and missingness can cancel numerically. Unique/full-coverage keys and original/joined grain/population counts are required. Follow-up: construct duplicated positive and negative rows with a misleading unchanged total.
5. **What prevents double inference after a crash?** A durable attempt reservation precedes HTTP. Completed identical attempts can cache; unresolved reservations become billing-unknown. Exactly-once billing is not promised. Follow-up: contrast safe computation retry with financially ambiguous transport retry.
6. **Why fence saver reads as well as writes?** Run scope and lease validity apply to the state a segment bases its decisions on. Holding the parent lock through saver operations serializes against cancellation/replacement. Follow-up: show why checking an epoch once before an awaited write is insufficient.
7. **Why not one huge checkpoint/ledger transaction?** Native saver and application ledger use separate connections/commit lifecycles. The implementation instead makes boundaries idempotent and reconciles immutable IDs/results. Follow-up: explain crash after issue checkpoint and before ledger insertion using `test_driver.py`.
8. **Can a JSON hash attest VERIFIED?** No; an attacker can forge both scalars and recompute all hashes. The server sees client-reported agreement. Replaying original bytes locally may reveal corruption but still is not remote attestation. Follow-up: separate integrity, provenance and numerical correctness in a report.
9. **Why broad catches in release middleware but not everywhere?** The outer privacy boundary must prevent arbitrary exception payload escape, and it emits only stable INTERNAL diagnostics while preserving cancellation. Ordinary domain code still uses precise expected exceptions. Follow-up: explain partial SSE response handling without a second HTTP start.
10. **Does the baseline show the single agent is better?** No. Two scripts have equal fixture correctness with different prescribed calls/persistence. Neither tests live stochastic quality or controlled end-to-end speed. Follow-up: design separately authorized held-out repeated live trials with identical budgets and missing-token treatment.
11. **Does the 30 MiB cap imply 30 MiB heap usage?** No; originals, derivatives, materialized rows, worker copies and runtimes coexist. Expansion estimates and tracked allocations have limited scope. Follow-up: design RSS sampling and explain sample/peak differences.
12. **What blocks public release after all local tests pass?** Actual origin/CSP/TLS/SSE/proxy behavior, provider eligibility/compatibility, distributed abuse control, backups/deletion and physical device evidence. Authorization and technical evidence are separate requirements. Follow-up: explain why a local read-only header probe cannot validate cloud cold starts.

Practical exercises build understanding through invariants rather than framework trivia:

1. Trace one Parquet fixture through `readLocalInput`, `ingest`, host, worker and `convertParquet`; write the original and derived hashes at each boundary. Change an unsupported type and predict the stable refusal code.
2. Derive a refund/zero/null fixture by hand. Explain included count, population count and VERIFIED versus INCONCLUSIVE before running engines.
3. Introduce a duplicate lookup key, unmatched primary key and composite-grain collision separately. Predict which proof obligation fails; confirm both implementations reject.
4. Reproduce the crash-after-checkpoint-before-ledger test. Record immutable job ID and provider call count before/after reopening the driver.
5. Cancel while a segment waits; attempt an old-epoch saver write. Explain row-lock serialization and why cancellation is not merely a UI label.
6. Forge two historical agreeing values and recompute digests in a test artifact. Compare import/playback integrity with actual deterministic replay outcome.
7. Inject a canary containing prompt/key/aggregate-like text into route and purge failures. Assert no arbitrary payload enters structured logs or public envelopes.
8. Run the comparator against a duplicated/missing source observation ID. Explain why failing before scoring protects denominators; distinguish honest-client false verification from client-forgery probes.

**Must know first:** follow the ingestion/execution/verification files, immutable contract identity, exact minor-unit transport, logical source versus blob counts, raw-memory/Save/provider consent, and CLIENT_REPORTED limits. These explain the product's central guarantee better than memorizing framework APIs.

**Production priority next:** study ledger/checkpoints/driver together; reproduce crash, duplicate, lease expiry and cancellation cases; inspect bounded provider transport, ASGI partial-response sanitization, retention ordering and active egress/replay tests. Then read resource measurements and deployment blockers. These determine what survives faults and what remains unsupported.

**Advanced study later:** explicit schema/runtime migrations; a second Parquet parser evaluation; globally scoped admission with a precise authorization/cost design; measured cross-platform replay; storage reference indexing at larger scale; and an encryption/key-recovery threat model. None should be introduced merely to make the architecture sound more elaborate. Every extension must preserve hypothesis-driven investigation, deterministic numerical authority and reproducible approved-operation replay.

Final new implementation diagrams: [Parquet ingestion/provenance](../diagrams/phase-5-ingestion.html) and [local release boundaries](../diagrams/phase-5-release.html). Both use the installed diagram-design workflow and actual Chrome validation.


### Cancellation followup: ownership across asynchronous file reads

`Page.beginLocal` reserves an AbortController before any primary/lookup read or local calculation. `readLocalInput` checks its signal before validation, after `File.arrayBuffer`, after worker conversion and after CSV hashing. `cancelLocal` aborts, removes the controller identity, advances source generations and cancels the executor. Result/error/finally callbacks can update state only while their controller still owns the operation. Browser file reads themselves cannot be physically aborted; an already-running read may finish, but its data cannot enqueue new conversion or restore cancelled state. The same rule protects a new operation from an old completion clearing busy state.

Investigation additional-file import has its own controller and Cancel handler. The page's top Cancel depends on page-local work rather than the shared busy lock, so it cannot bypass the investigation's file-read cancellation or cancel an old completed server run. Unmount aborts local work and closes the executor. This does not change30s/35s runtime bounds or Save/history authority. The deferred-Parquet browser regression was RED when late reads restored Dataset loaded after Cancel, then GREEN with zero conversion requests for cancelled primary and lookup imports. A separate delayed-digest unit verifies that cancellation of reply hashing cannot settle a newer job. Study the distinction between aborting a resource and revoking authority to apply its eventual result.
