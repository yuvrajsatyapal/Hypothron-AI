# Phase 1 deep dive — deterministic browser foundation

Updated: 2026-10-12. This teaches implemented code. Acceptance evidence and resource observations live in [the Phase 1 report](../reports/PHASE_1_REPORT.md); progress is authoritative in [CURRENT_PHASE](../../CURRENT_PHASE.md). The full autonomous platform is not this phase's implementation. Phase 2's isolated provider prework is explained in [SYSTEM_DESIGN_GUIDE](../SYSTEM_DESIGN_GUIDE.md#study-the-independent-provider-prework), not presented as an integrated agent workflow.

## 1. What problem this phase solves

An LLM can propose an explanation and still calculate the wrong population or amount. Before adding agents, Hypothron needs an execution surface whose accepted operations are finite, whose business definitions are inspectable, and whose numerical evidence can be recomputed. Phase 1 establishes that surface with one deliberately narrow operation: USD revenue over a half-open UTC interval, on an immutable local CSV.

Before this phase the repository contained product and trust contracts. After it, a user can load a CSV, choose columns and dates, execute genuinely independent DuckDB and Pandas calculations, inspect sources/runtime/hash/schema, cancel work, and repeat the calculation without inference. FastAPI separately creates expiring anonymous capabilities backed by real PostgreSQL. That API is **not called by the current calculation screen**. There is no LangGraph routing, checkpoint recovery, persistent artifact or Save button yet.

This ordering gives Phase 2 a restricted calculation interface instead of an arbitrary Python tool. Phase 3 will extend metrics and lineage; Phase 4 will persist explicitly consented snapshots and replay manifests. The current in-memory replay proves that recomputation can avoid inference, but loses everything on reload.

## 2. Technologies as interacting mechanisms

### DuckDB-WASM: SQL inside a credential-free browser worker

DuckDB is an analytical columnar engine; its WASM build runs machine code inside the browser rather than on the API host. [worker.ts](../../apps/executor/src/worker.ts) creates an `AsyncDuckDB` backed by a nested dedicated worker. Calls through `conn.query` are asynchronous RPC to that worker; they are not a network request to a SQL database.

The source bytes are explicitly registered as `input.csv`, then copied into an all-string `orders` table. Keeping CSV columns as strings prevents type inference from rounding monetary input before validation. The only executable query is produced by `compileSQL`; edited code is never accepted. Known-extension installation/autoload are disabled, then external access is disabled after the in-memory import. The nested worker's native network CSP supplies a separate enforcement boundary.

DuckDB was chosen over server-side Pandas for the privacy default and SQL's analytical suitability. SQLite-WASM would add a different analytical/type model without solving the independent Python path. Browser DuckDB is appropriate for bounded local analytics, not a replacement for a shared transactional database or a guarantee that every device can load these runtimes. Its engine memory measurements exclude other browser/runtime allocations.

### Pyodide, Pandas, NumPy and Decimal: a second implementation

Pyodide embeds CPython in WASM. Its runtime and package wheels load from preverified buffers, after DuckDB's connection/database/worker are closed. Pandas expresses population selection with vector masks. NumPy supplies a count conversion; it deliberately does **not** sum currency floats. Python `Decimal` parses base-ten strings and converts each accepted amount to integer cents.

Independent here means SQL and Python derive their results separately from a common approved contract. Python does not consume DuckDB's total. However, both share source bytes and business definitions: agreement cannot detect a wrong approved definition, common error or malicious browser. Native Python would start faster and offer OS resource controls, but would require consent to move bytes to an execution process and a different isolation architecture. The current browser path has substantial fixed runtime memory and is initially supported only on the measured desktop target.

### FastAPI, Pydantic and ASGI: metadata boundaries

[api.py](../../services/api/src/hypothron/api.py) uses an application factory so tests can supply a database URL without globals connecting at import. FastAPI maps annotated handlers to HTTP routes. Pydantic's `EmptyRequest` forbids extra fields at runtime; the exception handler returns `INVALID_INPUT` rather than an error containing submitted data.

A Pydantic body model alone cannot bound bytes before JSON parsing. [BodyLimit](../../services/api/src/hypothron/limits.py) operates at the lower ASGI protocol layer and checks every receive chunk first. This distinction matters in production: a valid schema can still arrive as a huge or endless HTTP body. Request deadlines/abuse-rate controls remain future work; the existing limiter proves a byte ceiling, not a complete denial-of-service defense.

FastAPI is selected because future orchestration and analytical contracts live in Python. It overlaps network/database I/O through `async`, which is neither CPU parallelism nor code isolation. There is no `exec` or browser dataset analysis in API handlers.

### PostgreSQL, SQLAlchemy and Alembic: durable metadata, not dataset storage

[SessionRecord](../../services/api/src/hypothron/db.py) stores a UUID ID, SHA-256 token hash and timezone-aware expiry. SQLAlchemy translates typed model/query objects into database operations; the async session owns transaction state. PostgreSQL enforces primary/unique/not-null constraints independently of request validation. Alembic [migration 0001](../../services/api/migrations/versions/0001_sessions.py) explicitly creates the schema, and readiness requires that revision.

A three-connection pool with zero overflow bounds concurrent connections for this skeleton. It does not yet bound time waiting for a connection or determine production capacity. PostgreSQL is preferable to a local SQLite checkpoint shortcut because later recovery/ownership transactions must be tested against the actual intended database. The foundation has only session records, not graph checkpoints, a job ledger or a retention scheduler.

## 3. Architecture and every boundary

See [implemented component/trust diagram](../diagrams/phase-1-architecture.html) and [actual happy-path sequence](../diagrams/phase-1-sequence.html). They use the diagram-design skill's light editorial `doc-wide` format. Their HTML is self-contained except the optional Google Fonts stylesheet; offline rendering uses disclosed system fallbacks. Planned full-system diagrams elsewhere are not implementation evidence.

The component diagram has three regions. The application origin owns the original bytes and approved contract. The execution origin owns dataset-free bootstrap, a bounded host and calculation workers; it has no bearer or BYOK credential. The lower metadata service region is separately tested, with no arrow from the current workspace because no such API call exists. The FastAPI→PostgreSQL arrow is a transaction over metadata.

`EXECUTE` carries an immutable plan and copied bytes across the iframe MessageChannel. `HASH-CHECK` means the host verifies fixed runtime buffers before signalling readiness. `PLAN + BYTES` transfers ownership of job buffers to the worker. The two vertical engine arrows mean fixed SQL/template invocation, executed serially, not two LLM agents. The dashed result arrow returns validated evidence. The stopped `DENIED` line means compute-native network access is prohibited; it does not claim general WASM memory safety or remote client attestation.

Port 3000 and 3001 are different origins, but localhost ports do not establish different cookie sites. No app cookies are used in this slice. Public TLS/hostnames/header behavior must be tested independently before deployment.

## 4. Complete execution walkthrough

1. **Upload and identity.** In [Page](../../apps/web/app/page.tsx), the file input's asynchronous `onChange` increments `uploadGeneration`, clears old evidence and reads `f.arrayBuffer()`. `contentHash(data)` computes SHA-256. A completed read updates `bytes.current`/hash only if its generation is still current; selecting B while A is hashing cannot let A overwrite B. Raw bytes remain a ref in memory, not React-serialized server state or IndexedDB.
2. **Approve an explicit contract.** `run(false)` constructs a `MetricPlan` with kind/version, hash, amount/date identifiers, UTC bounds, USD and null policy. `validatePlan` rejects extra keys, unsafe identifiers, unsupported values and invalid/calendar-normalized dates. The interface type alone is not a trust boundary.
3. **Create a bounded bridge.** `LocalExecutor` sends `CONNECT` with one transferred port to the fixed executor origin. `host.ts` requires the exact app origin, `event.source === parent`, one field and one port, and accepts only the first connection. Bootstrap fetches only fixed dataset-free assets, checks their SHA-256 hashes and sends `CONNECTED`. Handshake failure is bounded by five seconds; there is no indefinite loading promise.
4. **Issue one immutable job.** `LocalExecutor.execute(plan, bytes)` refuses busy/closed state, copies bytes and plan, assigns a UUID and starts a 35-second client deadline. `send()` transfers the copy after readiness. The original snapshot stays in the app for replay. Host `EXECUTE` checks exact fields, byte size, approved plan and single-job capacity, starts a 30-second termination timer, copies its runtime buffers and transfers the job.
5. **Validate before computation.** The compute `scope.onmessage` installs an in-memory asset reader, validates the plan again, recomputes the dataset hash and runs `preflightCSV`. Invalid UTF-8, oversized source or excessive conservative expansion/row count fail before engine materialization. This is a heuristic expansion guard, not a portable hard heap quota.
6. **Execute SQL.** The worker instantiates DuckDB, registers bytes, imports string columns, validates schema/required columns and date/amount/null rules, then queries `compileSQL(plan)`. It extracts a canonical cents string, included-row count, source-row count, schema, version and tracked allocation. It closes the connection/database/nested worker before Python initialization.
7. **Execute Python independently.** `loadPyodide` and `loadPackage` initialize CPython/Pandas/NumPy from buffers. Once initialization finishes, the job's compressed asset map is cleared; this drops references rather than guaranteeing immediate GC. The worker supplies only `plan_json` and `csv_text` to the fixed `PYTHON_SOURCE`, whose `pd.read_csv(dtype=str, keep_default_na=False)` preserves exact strings. The returned JSON contains cents/count and package/dataframe measurements.
8. **Validate the evidence envelope.** `validateExecutionResult` checks exact keys, bounded serialization, hash/source binding, canonical numbers, row/count relations, runtime versions, finite timing and tracked-memory values. Worker, host and bridge each perform boundary checks. The bridge only accepts the pending UUID; stale replies cannot resolve a newer calculation.
9. **Present verification.** The UI calls `verification(sql, python)`. Equal nonempty cents and counts become `VERIFIED / CLIENT_REPORTED`; disagreement becomes `DISPUTED`; empty output becomes `INCONCLUSIVE`. It shows the executed contract separately from editable controls. Starting/failing a new run clears old evidence, so old success is never displayed as the failed run's result.
10. **Replay.** `run(true)` retrieves the original in-memory plan, re-executes on the same bytes and invokes `replayMatches`. Dataset/runtime mismatch refuses compatibility; otherwise exact paired result comparison gives MATCH/MISMATCH. No API/provider call or persistent history is involved. Changing the dataset clears replay identity.

### The separate metadata API flow

`POST /v1/sessions` accepts an empty body and creates a 32-random-byte capability. `create_session` hashes the token and, inside `sessions.begin()`, deletes expired records and inserts the new session atomically. The response returns ID/token once. `GET /v1/session` takes an Authorization bearer, hashes it, and selects only an unexpired matching row; missing/invalid/expired credentials return 401. A leaked bearer still authorizes its holder until expiry; hashing protects database disclosure, not bearer theft.

`GET /v1/health` reports process availability. `ready()` queries Alembic and sessions; unmigrated/unavailable storage yields sanitized 503. Database errors do not become successful readiness. Twenty-four-hour creation expiry is implemented; inactivity renewal/full-run deletion remain target behavior.

## 5. Algorithms, examples and invariants

### Exact population and integer-money computation

For `orders.csv`, the selected period is `[2025-07-01, 2025-10-01)`. Three nonempty values are `10.10`, `20.20`, `0.03`; October's `999` is outside the interval and the empty amount is excluded. The independent expected total is `1010 + 2020 + 3 = 3033` cents, count 3, source rows 5. A valid nonempty sum of zero differs from an empty population: zero may verify, empty remains inconclusive.

SQL casts each string to `DECIMAL(18,2)` before summing and returns a BIGINT-cent string. Python validates decimal syntax, computes `int(Decimal(value) * 100)` per selected value and sums Python integers. Both reject more than two fractional digits instead of rounding away disagreement. UTC parsing uses strict lexical shape plus actual date parsing. An exclusive end is necessary so adjacent periods do not double-count their shared boundary.

For n rows with bounded field sizes, both population scans and sums take O(n) work. Each engine materializes data, so space is O(n), in addition to large fixed WASM/package overhead. Pandas masks, Decimal lists and buffers add temporary copies. Counting with NumPy is not a memory-free reduction: the current template builds a boolean array; understand that trade-off before extending this example to much larger inputs.

### Validation and conservative expansion

`preflightCSV` scans characters once, counts commas/newlines even inside quotes and estimates `characters * 4 + cells * 192`. Deliberate overcounting can reject safe quoted inputs; the alternative of fully parsing before checking would allocate the data the guard is trying to bound. The current support ceiling is 100,000 data lines, with trailing newline handled explicitly. Postparse row/result checks reinforce the accepted boundary. Quoted embedded newlines can consume this conservative budget early.

Structural JSON validation rejects unknown fields rather than silently dropping a requested capability. Currency/timezone/operation support is a finite allowlist. Identifiers cannot inject quotes or statements. No template accepts a URL, filesystem path or model-generated source. These invariants constrain the operation surface; CSP and the static origin provide independent egress restrictions.

### ASGI body limiting

`BodyLimit.__call__` accumulates each HTTP receive message's body length, rejects above 16 KiB with 413, otherwise replays the bounded messages to FastAPI through a local `receive` function. It handles chunked requests without trusting Content-Length. Storage is O(B), with B capped at 16 KiB; receive-message overhead and waiting time are separate risks. A disconnect terminates processing. This is a useful production pattern whenever parsing must not precede size enforcement.

## 6. Failure, concurrency and production implications

Cancellation has two layers. `LocalExecutor.cancel()` immediately rejects the app's pending promise and sends its job ID. The host only terminates the matching active job. Even if that message is lost, host/client deadlines still bound normal lost replies. Terminating the parent is the final cleanup boundary; `worker.ts` also closes DuckDB resources in `finally`. Cancellation is not rollback of an external billable effect because there is no inference in this slice.

One host job and one bridge pending request bound concurrent calculations; there is no shared background queue. This is appropriate for a small local demo, not a multi-tab resource coordination system. Upload generations solve one UI race; correlation IDs solve stale reply races. Neither is a database idempotency ledger. Crash/reconnect, fenced ownership and graph checkpoint recovery do not exist yet.

The host preloads package buffers and duplicates them for each isolated calculation. Clearing the job map after package initialization reduces retained references; serial engines avoid concurrent dataset materializations. GC and WASM reclamation are browser-dependent, and process RSS can remain high. Do not promise that a 10 MiB CSV uses only 10 MiB RAM or that tracked dataframe bytes are peak memory. Read ADR-015 and the measurement report for validated target/limits; mobile support is explicitly deferred.

Logs show sanitized codes and controlled stage names, not raw datasets. There is no production telemetry pipeline yet. Public-origin headers, TLS, abuse limits, DB least privilege, hosted expiry/backups and cross-owner investigation authorization remain unverified. Browser owner forgery is an inherent trust limitation: matching two invented results does not turn CLIENT_REPORTED into server attestation.

## 7. Tests and measured evidence

| Feature / failure | Actual source of evidence |
|---|---|
| IR injection, decimals/dates/null semantics, malformed/empty evidence, replay mismatch and expansion/row ceiling | [contracts.test.ts](../../apps/executor/tests/contracts.test.ts) |
| Handshake/reply deadlines, busy/cancel/close and malformed evidence | [execution.test.ts](../../apps/web/tests/execution.test.ts) |
| Runtime resolver restrictions and source tampering | [asset reader test](../../apps/executor/tests/assets.test.ts), [build integrity test](../../scripts/tests/assets.test.ts) |
| Real engine totals, empty/negative/boundary fixture, fault-injected contradiction, upload/storage probes, cancellation/retry, native XHR/fetch/import denial, wrong-origin/source handshake, responsive layout | [foundation.spec.ts](../../tests/e2e/foundation.spec.ts) |
| Real DB readiness, hashed capability ownership, sanitized extra input/no dataset route, chunked body cap, expiry/purge | [test_foundation.py](../../services/api/tests/test_foundation.py) |
| Fresh browser startup, dataframe/SQL allocations and sampled full process-tree RSS | [measure-browser.mjs](../../scripts/measure-browser.mjs), [measurement JSON](../reports/PHASE_1_BROWSER_MEASUREMENT.json) |

Run `pnpm test`, `pnpm typecheck`, `pnpm format:check`, `pnpm e2e`, `pnpm build`. With local migrated PostgreSQL and DATABASE_URL exported, run `services/api/.venv/bin/pytest services/api/tests -q`, Ruff check/format and mypy on source. The report records actual commands/counts and Red→Green regressions; do not infer success for unimplemented later features from this table. Chrome viewport checks prove layout on that browser, not mobile runtime performance, accessibility certification or universal CSP behavior.

## 8. Interview preparation

### Questions worth defending

**Why are two engines useful if both can be wrong?** They detect implementation drift under the same contract: SQL coercion, timezone boundaries, null handling or arithmetic may differ. Independent golden inputs test their shared definition. Agreement gives bounded local evidence, not business truth or browser authenticity. A follow-up is “what common-mode errors remain?” Answer: bad source, wrong metric definition, shared fixture omissions and a modified client.

**Why not let an LLM generate Python?** An LLM proposal is untrusted text, while public execution needs a finite authority surface. The plan selects a versioned known operation; a trusted compiler/template derives code. CSP denies native egress separately. A follow-up is “is a worker a sandbox?” Answer: it isolates responsiveness/context, but retains origin-related capabilities unless those are restricted.

**Why exact cents instead of a float tolerance?** This contract is money with two accepted decimal places. Integer cents have an exact oracle, so a tolerance would hide real errors. Float tolerances are appropriate only for operations whose numerical semantics require them and must be versioned. Overflow or unsupported precision must fail rather than silently wrap/round.

**What does replay reproduce?** Calculation on the same snapshot, plan and supported runtime, with exact output comparison. It does not rerun reasoning, authenticate the original browser, or persist across reload yet. Explain the future Save bundle separately from this implementation.

**What makes a session transaction reliable?** Expired-record cleanup and insertion commit together; DB constraints protect record integrity. Reads enforce expiry even if no purge has occurred. This is not durable investigation recovery; exactly-once job acceptance needs additional unique ledgers and transaction design in Phase 2.

### Two-minute explanation

“I built a deterministic browser slice before agents. A local CSV becomes a hash-bound explicit UTC/USD contract. A separate credential-free origin verifies its pinned runtime assets before receiving bytes, then runs compiler-generated DuckDB SQL and a fixed Pandas/Decimal template serially. Typed results carry exact cents, population counts and runtime versions. The UI compares them and labels agreement CLIENT_REPORTED, preserving disagreement. Cancellation terminates bounded workers; replay recomputes the original contract without inference. FastAPI/PostgreSQL separately prove session metadata and body limits. The trade-offs are substantial browser startup/memory and no remote attestation; mobile support is not yet validated.”

### Ten-minute explanation and exercises

Spend two minutes on the problem/contract, two tracing diagram messages, two deriving 3033 cents and null/date edge cases, two discussing CSP versus worker responsiveness and forgery, and two on measurements/API transactions/future recovery. Show code/tests rather than reciting technology names.

1. Manually derive a negative-price/exclusive-end fixture, then run the real engines. Predict cents and count before reading the output.
2. Submit an extra `source` field through the test channel and identify the first rejecting boundary. Explain why displaying SQL never authorizes arbitrary SQL.
3. Cancel, run again and inject a late reply. Trace UUID matching and why old success is ignored.
4. Change the runtime in saved in-memory evidence. Explain why equal numeric values do not override compatibility refusal.
5. Send a chunked 17 KiB API body. Explain why the limiter returns 413 before Pydantic and why schema validation is insufficient.
6. Compare tracked dataframe bytes with full-process RSS. Identify which allocations each measure omits; do not convert one sample into a performance guarantee.

## 9. Prioritized learning checklist

### Must understand before an interview

- [ ] Trace every implemented diagram arrow to its actual function/file.
- [ ] Derive exact cents, half-open UTC populations and empty versus zero results.
- [ ] Distinguish runtime validation, worker responsiveness, CSP authority and client provenance.
- [ ] Explain snapshot/runtime replay compatibility and zero-inference recomputation.
- [ ] Explain bearer hashing, expiry-on-read and the real SQLAlchemy transaction.

### Important production concepts

- [ ] Explain chunked-body limits, cancellation deadlines and stale-result races.
- [ ] Explain fixed runtime overhead, buffer copies, GC limitations and measured-device support.
- [ ] Identify missing abuse/retention/deployment controls without claiming them implemented.
- [ ] Explain common-mode verification errors and why independent tests matter.

### Optional advanced topics

- [ ] Study DuckDB decimal aggregation/overflow and Arrow integer representation.
- [ ] Study Pyodide package loading, WASM heaps and native sandbox alternatives.
- [ ] Design the future idempotent job ledger and distinguish local acceptance from upstream billing.
