# Hypothron AI — Architecture

Status: target architecture with an implemented deterministic foundation; current tested scope and remaining validation are in CURRENT_PHASE.md and the Phase 1 report. See DECISIONS.md for rationale and docs/RISKS_AND_RESOLUTIONS.md for unresolved release gates.

## System shape

Use a modular monorepo, one Next.js application and one FastAPI service with PostgreSQL. Analytical compute runs on the user's browser; the server coordinates LangGraph and calls user-selected providers. No broker, separate agent services or paid compute worker is required. A second static execution origin is a security boundary, not another backend service.

### Component responsibilities

| Component | Owns | Must not own |
|---|---|---|
| Next.js App Router | UI, consent, provider-key entry, local memory and explicit Dexie storage, job bridge | Backend secrets, provider proxying, graph orchestration |
| Execution host / workers | Pinned DuckDB-WASM SQL and Pyodide Pandas/NumPy operations, profiling, numerical recomputation, replay | App authentication, BYOK keys, unrestricted egress, arbitrary generated code |
| FastAPI | Identity, ownership, contract validation, job issuance/results, SSE, deterministic verification comparison, budget policy | Raw-data analytics or arbitrary code in the API process |
| LangGraph | Typed durable reasoning state, conditional delegation, task DAG, interrupts, follow-up decisions | Authorizing itself, overriding budgets, declaring numerical truth |
| Provider adapters | OpenRouter/Gemini API calls, capability mapping, structured-output parsing, usage accounting | Persisting credentials, arbitrary upstream URLs |
| PostgreSQL | Sanitized checkpoints, job/event ledger, scoped metadata and versioned metrics | Raw uploaded datasets, browser artifact snapshots, credentials |
| Dexie | User-consented local snapshot + investigation bundle | Automatic persistence, remote synchronization |
| Optional local worker | Explicitly authorized native DuckDB/Python recomputation under OS/container limits | Public arbitrary execution or proof of external real-world truth |

[System and trust-boundary diagram](docs/diagrams/system-architecture.html) and [execution handoff sequence](docs/diagrams/execution-sequence.html) are the diagram-design deliverables. Written flows below remain authoritative if a rendering changes.

## Data flow

1. User selects files. The app holds bytes in memory, hashes original content and sends bytes only to its local execution host. Profiling produces bounded schema/quality summaries; previews stay local.
2. User inspects an outbound disclosure preview. Selected schema and aggregate profile metadata, a question and approved metric contracts may go to FastAPI/providers. Raw rows and high-cardinality values are excluded by default. Sensitive column names and aggregate results can still disclose information.
3. FastAPI binds the run to a server-issued session and snapshots policy/metric versions. LangGraph proposes hypotheses and dependencies; unresolved business semantics trigger a user interrupt.
4. Analytical agents emit an allowlisted operation plan. A deterministic validator/compiler issues a job with source hashes, contract hash, compiler/runtime requirements, output schema and budget. No LLM output bypasses policy.
5. Graph commits the pending job and interrupts. SSE announces it; browser fetches it and executes locally. Results are submitted through authenticated POST, not back over SSE.
6. API validates ownership, job/attempt IDs, source/version claims, result shape, size and budget. This validates a client report, not its numerical truth. Deterministic comparison checks paired local SQL/Pandas results and semantic consistency.
7. Bounded contradictions return to planning. Report generation receives approved evidence references and explicit status/provenance. Backend validates numerical references against evidence; prose validation is evaluated, not assumed perfect.
8. User sees report and source operations. Save copies snapshots, plans, results, runtime manifest and report into Dexie atomically. Export produces a sensitive portable bundle. Without Save, the local dataset and report disappear when memory is lost.
9. Deterministic replay runs the saved approved operation DAG in the browser and compares typed results without an API/LLM dependency after required assets are available. AI re-investigation separately creates a new server run.

## Genuine multi-agent control

Implement LangGraph roles as graph nodes/subgraphs within one process, not as microservices. Distinct analytical agents must have typed contracts, independent bounded task context and different tools; a static series of identical prompts is insufficient.

| Role | Responsibility and permitted tools | Invocation policy |
|---|---|---|
| Supervisor | Route state, prioritize ready work, decide stop/follow-up | Deterministic policy gates surround optional LLM routing; no separate call every transition |
| Planner / hypothesis | Testable hypotheses, DAG revisions, evidence assessment | At start and when new evidence warrants revisions |
| SQL analyst | SQL-compatible operation plans over registered datasets | Joins, grouping, decompositions; restricted compiler tool |
| Python analyst | NumPy/Pandas-compatible plans and statistics | Only when a statistical or independent computational path is needed |
| Report agent | Structured findings, evidence citations, chart specs | After terminal evidence assessment |
| Data quality | Deterministic profile tools; optional interpretation by planner | No mandatory additional LLM agent in MVP |
| Verification engine | Contract checks, independent plan construction and result comparison | Deterministic; never replaced by an LLM critic |

Verification plans are built from approved metric contracts by separate implementations, not copied from analyst code. SQL and Python may be logically independent but initial heavy-worker concurrency is one to limit memory. Dynamic DAG revisions append versions and preserve history; require acyclicity and enforce total limits. Routing can skip Python for nonnumerical tasks or omit report inference when budgets run out, using a deterministic evidence summary.

## State and failure model

Investigation lifecycle: CREATED → PROFILING → NEEDS_CLARIFICATION or PLANNING → WAITING_FOR_EXECUTION → VERIFYING → PLANNING or REPORTING → COMPLETED. PAUSED, CANCELLED, FAILED and EXPIRED are explicit outcomes. Disputed findings can coexist with COMPLETED; completion does not imply all claims verified.

LangGraph state contains run/session IDs, consent references, dataset hashes and sanitized schema, metric versions, hypotheses, task/evidence references, budget counters and pending job IDs. Large outputs live in bounded evidence records; snapshots and keys never enter state. Use a PostgreSQL checkpointer plus application tables; version/migrate both. Do not persist hidden chain-of-thought: store concise decision summaries and observable inputs/actions.

[LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence) and [interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts) support checkpointed continuation. Our idempotency and privacy policies still require explicit implementation around that framework.

Use database transactions to commit pending jobs, state versions and events consistently. An application runner claims a run using a renewable PostgreSQL lease and fencing epoch; no held connection throughout browser execution. Recovery resumes at most one owner. Checkpoint integration must be proven against the pinned LangGraph saver; if atomic writes cannot be coordinated, reconcile from the job ledger before graph resume. This is a Phase 2 gate, not a solved framework assumption.

Run execution is divided into short request-triggered segments. SSE is an observation channel; opening it does not start/restart execution. Durable events/job records let clients reconnect and submit later. Deployments may terminate in-flight requests: record CALL_STARTED before inference and CALL_COMPLETED after; ambiguous provider completion requires user-controlled retry and consumes another attempt. Do not promise exactly-once LLM billing. A sleeping free host does not autonomously run investigations while the browser is absent.

## Trust boundaries

- Browser app ↔ execution origin: transfer only selected bytes/plans and return bounded results through a dedicated MessageChannel; never keys or session credentials.
- Browser ↔ FastAPI: TLS, owner-scoped session authorization, CORS, CSRF protections, Pydantic validation and quotas. Client results remain untrusted.
- FastAPI ↔ providers: fixed upstreams, request-scoped credentials, minimized approved context; provider retention is outside our control.
- FastAPI ↔ PostgreSQL: parameterized queries, restricted role, owner predicates and database integrity constraints; server metadata is sensitive.
- Bundle import ↔ app: hostile archive/JSON/code inputs. Validate sizes, hashes, schemas and capabilities; never execute imported free-form code.

## Storage and semantic model

PostgreSQL logical entities: sessions, investigations, dataset_manifests, metric_contract_versions, hypotheses, task_revisions, execution_jobs, execution_attempts, evidence_records, verification_reports, events and LangGraph checkpoints. Every child is tied to an owner/run; referential integrity prevents dangling evidence. Metrics and dataset manifests are immutable by version; corrections create new revisions. A demo session is an opaque capability, not a fabricated user account. Multi-user workspaces are deferred.

Dexie stores investigation bundles, source snapshot blobs and local index entries only after Save. Deduplicate snapshots within an origin by hash, with reference-counted deletion. Keep one artifact manifest as the source of export/replay truth. IndexedDB is not a reliable backup or cross-device store; advise export. Local contract definitions can run without a backend; approved definitions sent for orchestration are versioned in PostgreSQL.

## Performance and deployment

Start with serial compute and bounded metadata. Transfer ArrayBuffers rather than repeatedly serializing large tables; account for engine-specific copies and transfer ownership. Pin Arrow/Parquet interchange only after round-trip tests for decimals, nulls and timestamps. Do not move a full table to the backend to work around browser limits.

Single-threaded WASM is the compatibility baseline. Test multi-thread/SAB modes and cross-origin isolation separately before opting in; the iframe/worker/package-loading strategy must work on both desktop and mobile. Use pinned runtime assets and explicit package manifests; [DuckDB deployment guidance](https://duckdb.org/docs/stable/clients/wasm/deploying_duckdb_wasm) describes asset/worker deployment.

Proposed public layout: Vercel personal frontend plus static execution host, Render FastAPI and Neon PostgreSQL, all conditional on eligibility and quotas. Runtime payload transfer is browser-local; provider calls bypass Next.js server routes. See TECH_STACK.md and docs/DEPLOYMENT.md. Local development remains the fallback when a free tier changes.

## Verification boundary

Server checks can establish authorized job issuance and a syntactically consistent result ledger. Independent browser engines can reveal accidental disagreement. Neither proves an honest client or correct business meaning. Display VERIFIED + CLIENT_REPORTED as “Locally verified; client-reported.” Optional isolated local recomputation may establish RECOMPUTED_LOCAL; actual controlled server recomputation requires an explicit data-handling design and consent. See docs/VERIFICATION_AND_REPLAY.md for exact guarantees.

## Implemented foundation versus target system

Only the Phase 1 deterministic slice exists. Local flow: Next.js memory snapshot/metric → typed MessageChannel after readiness → credential-free host with hash-checked asset buffers → network-denied DuckDB/Pyodide workers → validated paired numerical evidence → CLIENT_REPORTED comparison → original-plan in-memory replay. Runtime-source bundling and dataset-free bootstrap are ADR-013; local opaque capability transport is ADR-014. FastAPI currently owns PostgreSQL health/session metadata but the browser foundation does not yet run an investigation API workflow. LangGraph, providers, durable ledgers/checkpoints, report/evidence expansion and opt-in replay bundles remain target components. See FILE_MAP.md and docs/reports/PHASE_1_REPORT.md for actual files and evidence.

Current independent prework: the Gemini/OpenRouter HTTP transport library is implemented and mock-tested, without graph/API/UI integration or durable attempt accounting. Its tested boundary is documented in SECURITY.md and the Phase 1 report; provider capability/pricing selection remains target behavior.

## Implemented foundation diagrams

[Phase 1 components and trust boundaries](docs/diagrams/phase-1-architecture.html) and [actual local computation sequence](docs/diagrams/phase-1-sequence.html) depict working code. Read [Phase 1 deep dive](docs/learning/PHASE_1_DEEP_DIVE.md) for arrow-by-arrow explanations, failure flows and invariants. Earlier full-system diagrams depict the target. Initial supported runtime/device scope is ADR-015; no mobile or public-host guarantee follows from localhost measurements.

Phase2 module now implements planner/analyst/report schemas and conditional LangGraph clarification→immutable job interrupt→bound local evidence→follow-up/report routing. It is tested with InMemorySaver only; production saver/ledger/API/UI remain pending. Construct/discard credential-bearing role provider and compiled graph per request segment. Citation existence checks are implemented; per-numerical-claim report validation remains Phase3.
