# Phase 2 deep dive — durable hypothesis-driven investigations

Updated: 2026-10-12. Phase 2 is complete for the scoped local desktop target; the user requested stopping before Phase 3. This document teaches the implemented system. [Phase 1](PHASE_1_DEEP_DIVE.md) explains the numerical engines and execution-origin isolation; those foundations are reused here. [The phase report](../reports/PHASE_2_REPORT.md) owns final measured gates. Phase 3 numerical-report semantics, Phase 4 saved artifacts and hosted release are separate work.

## 1. Problem, before and after

Phase 1 could calculate an explicitly chosen revenue metric and repeat it locally. It could not decide what to investigate, ask for clarification, use new evidence to choose another hypothesis, or recover server-side progress. A reliable autonomous investigation needs both a reasoning control graph and durable policies that survive a process restart. Putting a conversational loop in a frontend component would lose that state and make budgets depend on model obedience.

Phase 2 adds a real LangGraph workflow with planner, analyst and report roles, genuine Gemini/OpenRouter HTTP adapters, expiring PostgreSQL checkpoints and business ledgers, authenticated API routes, an event stream, and an opt-in browser investigation panel. The user approves immutable contracts and minimized context. Agents select among those contracts; they do not invent executable Python or SQL. The browser computes each accepted job using the Phase 1 engines and posts bounded scalar evidence. New evidence can cause a conditional follow-up.

The same screen accepts a primary CSV and up to two additional CSVs using the displayed approved revenue contract. Extra files are profiled locally before descriptors leave the browser. This is multi-dataset selection and investigation, not cross-table joins. The backend never receives the CSV bytes. A clarification pause clears the key field; resumption requires a fresh key and retains the original run's provider/model/question context.

Phase 3 must strengthen semantic metric verification and structured numerical claims. Current citation checks establish that cited jobs exist, but do not prove every sentence or numerical assertion is supported. Phase 4 must preserve snapshots and capabilities only under its explicit save policy; a full reload currently loses browser memory and the bearer token. Reconnect recovery within the live workspace is therefore different from saved replay.

## 2. Technologies and engineering decisions

### LangGraph is a persistent control-flow engine

[workflow.py](../../services/api/src/hypothron/agents/workflow.py) builds a typed `StateGraph`, registers nodes, adds conditional edges and compiles it with a supplied checkpointer. Each node receives state and returns a partial update. The framework tracks execution position and writes checkpoints between steps. This makes “pause for browser execution and later resume the same investigation” a genuine control-flow operation rather than an HTTP request kept alive indefinitely.

The planner returns either a clarification or prioritized hypotheses. The analyst returns `execute` with an existing hypothesis ID or `finish`. Deterministic `issue` chooses the hypothesis's unchanged approved contract and produces a job UUID. `accept` calls `interrupt` to wait for evidence. `report` checks citations and returns terminal output. The nodes share state, but distinct instructions and strict reply schemas give each role a separate responsibility. There is no separate profiler agent: local schema information is a tool result in the approved context.

LangGraph was selected because the architecture needs typed conditional routing and durable interrupt/resume. A simple prompt chain cannot express this recovery contract by itself. A custom state machine could, but would require reproducing checkpoint and resume mechanics. LangGraph is appropriate when a workflow branches and pauses across requests; it does not replace business authorization, cost accounting or transaction design. Its native saver and our ledger commit separately, so reconciliation is still necessary.

Internally, `interrupt` restarts the waiting node when it resumes. This is why UUID creation lives in the earlier completed `issue` node. Generating a fresh UUID inside `accept` would change job identity during recovery. See [the official interrupt contract](https://docs.langchain.com/oss/python/langgraph/interrupts) and the locked installed version, rather than assuming all framework versions behave alike.

### FastAPI and Pydantic establish boundaries

[investigations.py](../../services/api/src/hypothron/investigations.py) contains transport routes and strict input models. [models.py](../../services/api/src/hypothron/agents/models.py) contains framework-independent domain contracts. `extra='forbid'` rejects raw-row or arbitrary-code fields; strict constrained strings, canonical cents, hashes, UTC periods and bounded lists reject malformed inputs. Validation is followed by policy checks: a structurally valid dataset hash still must belong to the approved run.

FastAPI resolves bearer authentication before investigation handlers. The token is random, returned once, and stored as a SHA-256 digest in PostgreSQL. It is a demo capability, not an enterprise account or tenant-management system. API validation errors use a generic envelope rather than echoing the password-containing body. `SecretStr` avoids accidental representations, but it is not encryption or physical memory erasure; the transport explicitly extracts the key for its provider header.

Async Python is used for HTTP and database I/O. It does not make analytical computation cheap: WASM/Pandas work remains in browser workers. Request handlers orchestrate approved work rather than loading raw datasets into FastAPI. This separation keeps the API host compatible with a small deployment, subject to still-pending global abuse controls.

### SQLAlchemy, Alembic and native PostgreSQL checkpoints

[records.py](../../services/api/src/hypothron/records.py) defines runs, jobs, attempts and events. Foreign keys enforce ownership relationships and cascade business metadata deletion. [migration 0002](../../services/api/migrations/versions/0002_investigations.py) installs those tables and the native LangGraph saver schema through the same Alembic authority. Native setup uses an autocommit section because its concurrent indexes cannot be created inside the ordinary migration transaction.

[ledger.py](../../services/api/src/hypothron/ledger.py) owns transactional policies. `sessions.begin()` commits a related update and its event together or rolls both back. `SELECT ... FOR UPDATE` serializes mutations to one run. PostgreSQL is already required for metadata, so introducing Redis/Celery solely to resume these short segments would add services without eliminating the database consistency problem.

[checkpoints.py](../../services/api/src/hypothron/checkpoints.py) subclasses the genuine `AsyncPostgresSaver`. Scope checks apply to reads, listings and writes; unrestricted listing and graph-triggered deletion are denied. Writes hold the run's row-lock fence while the native saver writes on a separate connection. Serialization disables pickle fallback and arbitrary module reconstruction. The trusted application still owns schema and library integrity; this is not permission to deserialize arbitrary imported bundles.

### BYOK HTTP adapters and tracing policy

[http.py](../../services/api/src/hypothron/providers/http.py) constructs genuine fixed-destination requests. Gemini uses its API-key header; OpenRouter uses a bearer header. The model field is an identifier, never a proxy URL. Redirects, environment proxies and automatic retries are disabled. Output is strict structured JSON, limited to 1024 output tokens, bounded response bytes and a 20-second absolute transport deadline. Compressed responses are rejected before decompression to avoid an allocation bypass.

[RequestRoleProvider](../../services/api/src/hypothron/agents/provider.py) combines role instructions with minimized JSON context. It has an ephemeral key-bearing transport, reservation callback and usage observer. [InvestigationDriver](../../services/api/src/hypothron/driver.py) reconstructs and discards the adapter and compiled graph for each segment; it never caches a graph closing over a key. `tracing_context(enabled=False)` prevents environment-enabled external tracing from capturing workflow context. LangSmith is a transitive library dependency, not an introduced service.

Real integrations are implemented; automated tests replace external HTTP with `httpx.MockTransport`. They prove our wire construction and failure policy, not live model availability, pricing, provider retention or universal structured-output compatibility. No paid inference or live credential was required.

### Authenticated fetch streaming for SSE

`events` emits committed event IDs and bounded JSON payloads. The browser's `observe` uses fetch so it can send an Authorization header; tokens never appear in the SSE URL. Each stream is finite and can reconnect using `after=<last event ID>`. Heartbeats do not create ledger rows. Event observation is not the job-delivery authority: validated API state and the PostgreSQL job/result records determine execution.

This is useful for progress under ordinary HTTP hosting, but it is not a message queue or exactly-once stream. A client deduplicates IDs and can miss a network connection without losing the durable ledger. Hosted buffering, proxy timeouts and many concurrent observers remain release tests.

## 3. Complete execution walkthrough

1. `Page.run` in [page.tsx](../../apps/web/app/page.tsx) first proves a local metric. The result, immutable bytes and executed contract enter `Investigation` as its primary snapshot. The bytes stay in refs. Extra CSVs are read, hashed and executed locally in `investigate`; only their schema/hash/contracts become descriptors. Cancellation is checked after asynchronous file reads/hashing and before dispatch.
2. The user supplies a question, selected provider/model, password key and explicit metadata/provider consent. `investigate` acquires an operation controller, clears previous run presentation for a new start and applies a bounded interaction deadline. Controls cannot change the active operation. Resume displays the original run context and requires the consent checkbox and a nonempty clarification answer where applicable.
3. `apiJSON('/v1/sessions')` obtains a bearer capability kept only in `token.current`. API requests omit cookies and bypass caches. Requests and response consumption have a deadline; JSON bodies are capped at 128 KiB on the client. Backend request bodies are capped independently before JSON parsing.
4. The browser creates a UUID request ID before POST creation and holds it in memory. `StartRequest` validates the body and excludes the known key from metadata before persistence. `Ledger.create` uses PostgreSQL `INSERT ... ON CONFLICT DO NOTHING`, then verifies the existing record's owner and exact request/provider/model. Same-ID same-input creation is idempotent; conflicting reuse fails. Creation performs **zero inference**. A lost ACK can be inspected or retried using the known ID.
5. `/advance` receives the key separately. `driver.advance` disables tracing, applies the whole-segment deadline and loads owner-scoped unexpired metadata. Unknown stored providers fail closed. `claim` locks the run, rejects terminal or actively leased runs, increments its epoch and assigns a lease holder/expiry.
6. `checkpoint_store` opens a bounded native connection. `graph.aget_state` reads this exact run. A new run starts from `initial_state`; a paused run either returns its unanswered clarification, reconciles its pending job or resumes accepted evidence. A completed report is retrieved through the separate owner-scoped read route, without claiming a new execution lease or invoking inference.
7. `ask` constructs minimized context and a call ordinal. The durable provider wrapper reserves `(run ID, ordinal)` with role/context digest before outbound HTTP. If the attempt already has a strict cached response, it returns it without HTTP. If it is reserved but incomplete, it returns `BILLING_UNKNOWN`; it does not guess whether the provider billed it.
8. The planner may produce `CLARIFYING`; `clarify` interrupts and the API returns. The browser clears its key field. After a fresh key and answer, `Command(resume={'answer': ...})` restarts the waiting node and planning continues. A second requested clarification exceeds policy and terminates.
9. The analyst chooses an existing hypothesis. `issue` selects its exact approved contract, assigns a UUID, records accepted predecessors in `dependsOn`, and checkpoints before `accept` waits. The driver inserts that job into the business ledger. If the process failed between checkpoint and insertion, the next driver inserts the same job rather than creating another UUID.
10. `validateInvestigationState` in [investigation.ts](../../apps/web/lib/investigation.ts) rejects executable source fields and compares every plan field with an in-memory approved contract. `drive` finds the matching snapshot and calls `LocalExecutor.execute`. The execution-origin bridge receives only plan/bytes; no key or capability crosses it. SQL and Python outputs retain exact cents and population counts.
11. `/results` accepts `EvidenceInput`. `submit` locks the run, checks owner/job/hash, computes a canonical digest and atomically stores result/status/event. An identical repeat gets its original ACK semantics; a different repeat produces `RESULT_CONFLICT`. Accepted duplicates remain acknowledgable after termination; new pending results do not.
12. `/advance` resumes using the ledger's accepted result. `accept` independently rechecks job/hash and emits VERIFIED, DISPUTED or INCONCLUSIVE with CLIENT_REPORTED provenance. Evidence returns to the analyst for a conditional follow-up or report. Reports must cite existing evidence jobs. Final state is checkpointed; ledger status is terminal. `release` clears only the still-matching lease.
13. Cancel aborts local requests/worker work and, once the known run ID exists, posts backend cancellation. `cancel` changes status, increments the epoch and cancels pending jobs. Stale writes fail their fence. Provider cancellation does not reverse charges; an already dispatched upstream request can still finish. A missing cancellation ACK is reported as uncertain rather than fabricated success. `generation` in `Investigation.tsx` increments at operation start. Cancellation captures that generation and run ID, clears the old key before awaiting the server, and applies its eventual response only if both still match. Otherwise a delayed cancellation callback could erase a newly entered key or overwrite the next run’s status. The browser regression deliberately holds the old cancellation response while starting a new run.
14. `purge_expired` runs during session creation. It locks up to 100 expired parent runs, deletes native checkpoint writes/blobs/checkpoints, then removes business metadata and eligible sessions. Reads deny expiry immediately, but physical cleanup is opportunistic locally. Scheduled hosted sweeps and backup retention are still required for release.

## 4. Architecture diagrams and boundaries

- [Component/data-boundary diagram](../diagrams/phase-2-architecture.html): snapshots and UI live in the application origin; the separate execution origin has no credentials. The metadata arrow into FastAPI carries approved descriptors and aggregates. The provider arrow originates only in the request-scoped backend adapter. Business-ledger and native-saver boxes use one PostgreSQL deployment but separate commits.
- [Execution sequence](../diagrams/phase-2-sequence.html): creation ACK comes before inference; reservation comes before HTTP; a job UUID is checkpointed before local execution; result acceptance precedes resume. Dashed arrows are returns. Repetition is bounded, not an endless conversational loop.
- [Conditional routing/recovery](../diagrams/phase-2-routing.html): ambiguity goes through one clarification; accepted evidence returns to the same analyst node; finish passes through citation validation. Two analyst boxes show one node before/after new evidence. Terminal failure and cancellation do not become successful numerical outputs.

The important trust boundary is between honest local computation and server-reported evidence. The API validates shape, bindings, budgets and consistency, but does not possess the source bytes to attest computation. A malicious client can forge two agreeing values. “VERIFIED / CLIENT_REPORTED” therefore means local agreement, not server verification.

## 5. Algorithms, invariants and practical examples

### Durable side-effect memoization

Suppose planner ordinal 1 is reserved, HTTP returns hypotheses, and the strict reply is cached. A crash occurs before the graph increments `calls`. Recovery executes the same node/context/ordinal: `reserve` returns the cached reply, avoiding another outbound call. If the crash occurred after HTTP dispatch but before caching, the RESERVED record has no trustworthy result. Recovery terminates with billing uncertainty. These two cases are intentionally different.

The attempt primary key makes lookup O(log A) in database terms, with A≤12 per run. Context hashing is O(B) in serialized context bytes. Model context and response lengths are bounded. The digest detects incompatible replay context; it does not prove that a provider executed exactly once. The independent database counter caps attempts even if graph state is stale.

### Lease fencing versus a timeout

A lease says who currently owns work; its expiry allows recovery after an owner disappears. A fencing epoch makes stale owners distinguishable. If worker A has epoch 3 and a later owner B claims epoch 4, A cannot write even if it wakes up and still has a Python object holding its lease. `fence` locks the parent, checks epoch/holder/expiry/terminal state, and spans the native write.

This serializes checkpoint writes against cancellation and lease replacement. It does not atomically combine all saver tables and business events into one universal transaction. The design instead makes cross-commit transitions recoverable. A 60-second segment is shorter than the 90-second lease; cleanup has its own bounded allowance. Database locks/connections have separate limits. A process-local semaphore admits two segments; it is not a deployment-wide concurrency guarantee.

### Idempotent evidence and dependency DAG

For `{jobId:J, datasetHash:H, sql:{minorUnits:'3033',count:3}, python:{minorUnits:'3033',count:3}}`, the ledger hashes canonical sorted JSON. Reposting it returns `duplicate:true`. Changing SQL to `999` changes the digest and fails rather than overwriting accepted history.

New job dependencies must refer to already accepted jobs of the same run. This creates an acyclic execution history because a not-yet-issued job cannot already be accepted. Jobs are capped at six. SQL/Python comparisons are O(1) for current scalar results; dependency checks are bounded O(J), J≤6. PostgreSQL indexed lookup and one locked run serialize concurrent submissions. Canonicalization is identity, not mathematical evidence or cryptographic attestation.

### Status and provenance remain orthogonal

Equal exact cents and equal populations yield VERIFIED. Any mismatch yields DISPUTED. Missing monetary population yields INCONCLUSIVE. For example, equal `3033` with counts 3 and 4 is disputed, because comparing different populations is invalid even if the sum happens to coincide. Honest-client correctness still depends on the approved business contract and independent compilers. The current graph does not repair arbitrary semantic disagreements; Phase 3 owns those policies.

### Failure scenarios to reason through

Unknown dataset hashes, orphan citations, extra job source fields and malformed clarification terminate or refuse work. A pending job's accepted result survives a crash before resume. Lost creation ACK does not invoke a model. Lost final response is recovered by an inference-free owner-scoped read. A full reload without saved capability cannot retrieve that anonymous run. Expired metadata cannot be revived by a still-held run ID. Key echoes are rejected rather than checkpointed. These are separate failure classes with separate remedies.

## 6. Production engineering and limitations

The backend is I/O-oriented and does not scale with raw dataset size directly. Browser memory/runtime startup is still substantial; use the Phase 1 measurements, not a claim of free computation. Three local snapshots can increase browser pressure even though jobs execute serially. Local target support remains ADR-015's measured Chrome/macOS configuration.

Row locking gives one-run mutation serialization, not global capacity planning. More API workers each have their own two-slot semaphore and connection usage. Anonymous session creation, global inference concurrency, SSE fan-out and hosted quotas require release-wide controls. No queue service is introduced; short request-triggered segments survive host restarts through PostgreSQL, but cold-start and proxy behavior remain unmeasured.

Questions, schema names and aggregates are sensitive even without rows. Start consent explicitly names them. Known keys are excluded before state creation, role transport excludes credential echoes, and trace export is disabled. App-origin XSS can still reach keys held in memory. Password fields, text rendering and execution-origin CSP reduce exposure but do not provide hardware-backed secret storage or byte zeroization.

Numerical reports currently contain bounded free text plus citations. The UI renders it as text, and tests prove HTML-like output is inert. Existence checks do not establish full claim grounding or causality; that is a Phase 3 gate, not an accepted weakness in a completed full product. Provider free/paid availability and retention are outside our verified local guarantees.

## 7. Tests, commands and evidence

[workflow tests](../../services/api/tests/test_workflow.py) cover real conditional LangGraph with test-only in-memory saver: clarification, follow-up, three descriptors, strict IDs, one clarification, six jobs, twelve calls, orphan citations and failure termination. [provider tests](../../services/api/tests/test_providers.py) cover genuine transport construction, timeouts, incomplete replies, response caps, escaped/nested secret echoes, gzip refusal and reservation ordering.

[ledger tests](../../services/api/tests/test_ledger.py), [recovery tests](../../services/api/tests/test_recovery.py) and [driver tests](../../services/api/tests/test_driver.py) use real PostgreSQL/native saver. They test duplicate/conflicting results, owners, expiry, live leases, stale epochs, terminal mutations, strict job/cache policy, fresh saver recovery, checkpointed issuance crashes, accepted-result recovery and ambiguous reserved inference without a second call. [API tests](../../services/api/tests/test_investigations_api.py) cover authenticated real-adapter wire flow, consent/key/input rejection, terminal reads, SSE cursors and idempotent zero-inference creation.

[Client tests](../../apps/web/tests/investigation.test.ts) reject changed plans/executable source/malformed evidence and bound stalled requests. [Browser integration](../../tests/e2e/investigation.spec.ts) uses actual Next.js/FastAPI/PostgreSQL/LangGraph/DuckDB-WASM/Pyodide; only provider HTTP is mocked by [browser_server.py](../../services/api/tests/browser_server.py). It checks three descriptors, clarification and conditional jobs, inert model text, key clearing, no raw upload/no storage, and recovery/cancellation regressions.

Run `pnpm test`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`; run `DATABASE_URL=<local fixture URL> services/api/.venv/bin/pytest services/api/tests -q`, Ruff and mypy. `pnpm e2e` automatically starts the test-only API; stop a real API on port 8000 first. Production runs use `hypothron.api:app_factory`, never the test fixture server.

Final validation: 65 backend tests passed in 15.58s against real PostgreSQL, 30 Vitest tests passed in 640ms, and the full 19-browser suite passed in 3.6 minutes. The final production build compiled successfully in 5.8s; its 111 kB first-load JavaScript excludes separately loaded analytical assets. The final targeted investigation regression also passed (one test, 1.8-minute suite), including delayed cancellation ACK/new-run credential isolation. Engineering and design gates ACCEPT. See the report for complete check commands. A Docker outage produced explicit readiness failures during revalidation; it was not counted as a pass. No live-provider cost, multi-host stress result or physical-mobile measurement is claimed.

## 8. Interview preparation and exercises

**Why three agent roles rather than one large prompt?** Planning decides candidate explanations and clarification; analysis decides the next approved calculation based on evidence; reporting communicates supported output. The division is useful because decisions use different schemas and conditional transitions. More agents would add cost without a demonstrated responsibility. The roles share typed state and deterministic supervision; autonomy does not grant arbitrary execution permission.

**Why both checkpoints and business records?** A checkpoint knows graph position and state. A job ledger establishes authorization, accepted results, idempotency and events. Framework persistence alone does not enforce those business invariants. Our separate commits are reconciled using a checkpointed UUID and immutable accepted results. Be ready to identify the exact crash windows, not merely say “PostgreSQL is durable.”

**Can you guarantee exactly-once inference billing?** No. A reservation records that an attempt may happen, and cached responses prevent repeats after completed persistence. A crash between dispatch and caching leaves ambiguous billing. We expose that state and avoid automatic retry. An upstream idempotency mechanism with proven semantics might improve this, but ours does not invent one.

**How do you prevent stale workers after cancellation?** Cancellation increments the run epoch under a row lock. Every mutation checks the matching lease holder/epoch and live/terminal policy under that same lock. An old worker is fenced even if its provider call finishes. This prevents stale persistence; it does not reverse provider billing or prove a remote request was cancelled.

**Why is VERIFIED insufficient for server trust?** The source remains in the browser. The server can compare two client values, validate population/hash/job bindings and record provenance, but an adversarial client can forge both. Trusted recomputation would require an explicitly supplied dataset and a separate trusted execution mode. Hash identity alone is not attestation.

**How would you scale this beyond a demo?** Measure browser/runtime limits separately from API capacity. Add deployment-wide admission controls and connection budgets, scheduled retention and proxy/SSE tests. Keep keys request-scoped and avoid holding background jobs that require persistent secrets. Introduce a queue only after a demonstrated long-running or global scheduling need and an ADR explaining its privacy/operational cost.

A two-minute explanation should follow one concrete question: local snapshot and metric → consent → recoverable metadata creation → bounded typed reasoning → checkpointed approved job → isolated independent local computation → idempotent evidence → conditional follow-up/report. End with the client-reported trust limit and zero automatic retry on uncertain billing.

For ten minutes, draw the three diagrams, explain reservation/cache timing and checkpoint/business crash windows, walk through the row lock and epoch check, contrast SSE observation with job authority, then use a disagreement fixture and lost-response test. Discuss why arbitrary SQL/Python, persistent keys and extra infrastructure were rejected. Conclude with remaining Phase 3–5 gates rather than asserting production readiness.

Practical exercises: run the reserved-inference crash test and explain why only one mock call occurs; alter one returned plan field and watch the browser reject it; post the same evidence twice then change its population; cancel a held lease and attempt a saver write; force a lost creation ACK and recover by ID; expire a session and inspect native checkpoint cleanup; inspect the report's HTML-like string in DOM and verify no image element exists.

## 9. Prioritized learning checklist

Must understand before an interview:

- [ ] Explain role routing, partial state updates and interrupt node restart using actual workflow functions.
- [ ] Trace each key/token/dataset/metadata boundary without conflating client agreement and server attestation.
- [ ] Defend creation idempotency, reservation/cache behavior and billing uncertainty.
- [ ] Explain row locks, lease epochs, terminal policy and duplicate-result ACKs.
- [ ] Reproduce one checkpoint/business recovery test and one browser negative test.

Important production concepts:

- [ ] Distinguish request deadlines, cleanup bounds, leases and deployment-global capacity.
- [ ] Explain schema validation versus authorization, and SSE observation versus durable job authority.
- [ ] Understand expiry denial versus physical purge and backup retention.
- [ ] Recognize that citations/free text require stronger grounding in Phase 3.

Optional advanced topics:

- [ ] Study native checkpoint serialization/version migration and connection-pool trade-offs.
- [ ] Compare reconciliation with a transactionally coupled saver/outbox design.
- [ ] Design measured global admission control and provider idempotency integration without persisting BYOK secrets.
