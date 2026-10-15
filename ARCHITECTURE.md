# Hypothron AI — Architecture

Status: target architecture with implemented local Phases 1–5; tested scope and remaining validation are in CURRENT_PHASE.md and the phase reports. See DECISIONS.md for rationale and docs/RISKS_AND_RESOLUTIONS.md for unresolved release gates.

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

Business transitions and their events commit transactionally. The native saver commits separately; the driver reconciles checkpointed job IDs and accepted results before resume. Live run epochs/holders/expiry fence native writes under the parent row lock. Short 60-second request segments use a 90-second lease; no connection/lease is held during a browser pause. Lease renewal is not implemented. Crash-boundary and stale-owner tests use the pinned native PostgreSQL saver. See ADR-016 and the Phase 2 deep dive.

Run execution is divided into short request-triggered segments. SSE is an observation channel; opening it does not start/restart execution. Durable events/job records let clients reconnect and submit later. Deployments may terminate in-flight requests: record CALL_STARTED before inference and CALL_COMPLETED after; ambiguous provider completion requires user-controlled retry and consumes another attempt. Do not promise exactly-once LLM billing. A sleeping free host does not autonomously run investigations while the browser is absent.

## Trust boundaries

- Browser app ↔ execution origin: transfer only selected bytes/plans and return bounded results through a dedicated MessageChannel; never keys or session credentials.
- Browser ↔ FastAPI: TLS, owner-scoped session authorization, CORS, CSRF protections, Pydantic validation and quotas. Client results remain untrusted.
- FastAPI ↔ providers: fixed upstreams, request-scoped credentials, minimized approved context; provider retention is outside our control.
- FastAPI ↔ PostgreSQL: parameterized queries, restricted role, owner predicates and database integrity constraints; server metadata is sensitive.
- Bundle import ↔ app: hostile archive/JSON/code inputs. Validate sizes, hashes, schemas and capabilities; never execute imported free-form code.

## Storage and semantic model

PostgreSQL logical entities: sessions, investigations, dataset_manifests, metric_contract_versions, hypotheses, task_revisions, execution_jobs, execution_attempts, evidence_records, verification_reports, events and LangGraph checkpoints. Every child is tied to an owner/run; referential integrity prevents dangling evidence. Metrics and dataset manifests are immutable by version; corrections create new revisions. A demo session is an opaque capability, not a fabricated user account. Multi-user workspaces are deferred.

Dexie stores investigation bundles, source snapshot blobs and local index entries only after Save. Deduplicate snapshots within an origin by hash, with last-reference deletion by scanning remaining manifests. Keep one artifact manifest as the source of export/replay truth. IndexedDB is not a reliable backup or cross-device store; advise export. Local contract definitions can run without a backend; approved definitions sent for orchestration are versioned in PostgreSQL.

## Performance and deployment

Start with serial compute and bounded metadata. Transfer ArrayBuffers rather than repeatedly serializing large tables; account for engine-specific copies and transfer ownership. Pin Arrow/Parquet interchange only after round-trip tests for decimals, nulls and timestamps. Do not move a full table to the backend to work around browser limits.

Single-threaded WASM is the compatibility baseline. Test multi-thread/SAB modes and cross-origin isolation separately before opting in; the iframe/worker/package-loading strategy must work on both desktop and mobile. Use pinned runtime assets and explicit package manifests; [DuckDB deployment guidance](https://duckdb.org/docs/stable/clients/wasm/deploying_duckdb_wasm) describes asset/worker deployment.

Proposed public layout: Vercel personal frontend plus static execution host, Render FastAPI and Neon PostgreSQL, all conditional on eligibility and quotas. Runtime payload transfer is browser-local; provider calls bypass Next.js server routes. See TECH_STACK.md and docs/DEPLOYMENT.md. Local development remains the fallback when a free tier changes.

## Verification boundary

Server checks can establish authorized job issuance and a syntactically consistent result ledger. Independent browser engines can reveal accidental disagreement. Neither proves an honest client or correct business meaning. Display VERIFIED + CLIENT_REPORTED as “Locally verified; client-reported.” Optional isolated local recomputation may establish RECOMPUTED_LOCAL; actual controlled server recomputation requires an explicit data-handling design and consent. See docs/VERIFICATION_AND_REPLAY.md for exact guarantees.

## Implemented foundation versus target system

Phase 1 supplies the restricted local calculation and memory-only replay. Phase 2 integrates genuine planner/analyst/report LangGraph routing, request-scoped Gemini/OpenRouter BYOK, native PostgreSQL checkpoints, fenced business ledgers, idempotent metadata creation and results, bounded SSE and a consent-gated workspace. Three local CSV descriptors can drive conditional jobs; CSV bytes never leave the browser. Keys and bearer capabilities remain ephemeral. Phase3 adds v2 exact currency/offset/grain/approved single-lookup joins and bounded correction. Structured report claims are checked against exact evidence operands and compatible contracts; arbitrary narrative and unsupported causal/statistical claims are refused. Phase4 adds explicit Dexie storage, canonical bundles and local-only replay. Parquet, general analytics, global abuse controls and hosted deployment remain unimplemented. FILE_MAP and phase reports distinguish tested code from the broader target.

## Implemented foundation diagrams

[Phase 1 components and trust boundaries](docs/diagrams/phase-1-architecture.html) and [actual local computation sequence](docs/diagrams/phase-1-sequence.html) depict working code. Read [Phase 1 deep dive](docs/learning/PHASE_1_DEEP_DIVE.md) for arrow-by-arrow explanations, failure flows and invariants. Earlier full-system diagrams depict the target. Initial supported runtime/device scope is ADR-015; no mobile or public-host guarantee follows from localhost measurements.

## Implemented Phase 2 diagrams

[Component/data boundaries](docs/diagrams/phase-2-architecture.html), [creation/inference/execution sequence](docs/diagrams/phase-2-sequence.html) and [conditional routing/recovery](docs/diagrams/phase-2-routing.html) describe implemented code. [Phase 2 deep dive](docs/learning/PHASE_2_DEEP_DIVE.md) explains each component/arrow, SQLAlchemy transactions, native saver fencing, side-effect caches and recovery limitations. The business and checkpoint records use one PostgreSQL deployment but separate commits. The driver is recreated per segment, with tracing disabled; no credential-bearing graph is cached.

## Implemented Phase 3 verification and reporting

[Verification and trust boundaries](docs/diagrams/phase-3-verification.html), [evidence lineage and numerical support](docs/diagrams/phase-3-evidence.html), [conditional bounded correction](docs/diagrams/phase-3-correction.html) and [report validation and visualization](docs/diagrams/phase-3-reporting.html) depict implemented code. Read [the Phase3 deep dive](docs/learning/PHASE_3_DEEP_DIVE.md) and [phase report](docs/reports/PHASE_3_REPORT.md) for actual algorithms, tests and limitations.

The credential-free worker computes approved v2 revenue sums and ephemeral LEFT JOIN views independently in SQL/Pandas from hash-bound originals. Unique declared grain, lookup keys, coverage, relationship cardinality and populations are checked before exact aggregation. Fixed offsets are explicit; named-zone/DST/FX/many-to-many semantics fail. Sources remain in browser memory; relationship approval is separate consent. Internal Pandas helper columns avoid collisions with user columns.

`verification.verify_evidence` compares exact integers and bounded semantic counts before recording contract identity and CLIENT_REPORTED provenance. Disputed evidence triggers at most two original-contract reruns per identity in LangGraph, using immutable dependent jobs and the existing PostgreSQL lease/checkpoint recovery protocol. An explanation cannot rewrite results. Correction exhaustion routes to reporting with the conflict preserved.

`reporting.validated_report` and browser `validateReport` reject unsupported figures, incompatible/orphan references and unverified operands. Exact percentage change uses Fraction/BigInt and an explicit baseline; supported observational totals and arithmetic changes do not establish causality. Statistical association, arithmetic decomposition and causal claims lack supporting operations and are rejected. Invalid provider drafts produce deterministic fallback without inference retries. React text/SVG charts show paired values and exact tables. Legacy evidence is enriched from issued contracts; legacy completed narrative is marked for revalidation. No new migration, provider destination, persistent raw-data store or execution privilege was introduced.

## Implemented Phase 4 persistence and replay

`artifacts.ts` binds copied original CSV bytes, approved contracts (including unused inputs), accepted jobs/dependency order, generated source, result/contract hashes, exact semantics, verification/provenance and runtime asset lock in a strict canonical manifest. Unknown versions fail closed; no automatic migration exists. `storage.ts` opens a new Dexie store only after explicit Save/import consent. Existing inventory reads do not restore unsaved bytes. One transaction owns Save collision/deduplication/quota/writes; Delete removes history and last-reference blobs atomically. Logical bounds are64MiB/20investigations and ten replay records per original. Browser eviction, quota, unavailability and interruption are exposed honestly.

`bundles.ts` implements the documented stored-only ZIP subset, bounded paths/counts/offsets/CRC/schema/hashes/IR/runtime before in-memory preview. Explicit confirmation persists the validated import transactionally. `replay.ts` depends only on manifest/IR validation, local executor and verifier: zero provider/API/planner requests. Compatible original snapshots execute serially; current evidence/status compares deterministic fields and appends separate bounded history. Stored SQL/Python is inspection data; imported code never executes. Original evidence is immutable. A hash is identity, not trustworthy-computation proof; all current evidence remains CLIENT_REPORTED, never server-attested.

`Investigation` captures executed results before submission, filters to server-accepted IDs at completion, freezes creation configuration across Resume, and reads owner-scoped measured token/request-time totals. A separate fresh action restores approved inputs to memory, clears consent/key, creates a new run and records its parent. Structural comparisons do not reproduce LLM reasoning. New Save remains explicit. Browser-local storage is unencrypted, accessible to app-origin scripts and unsuitable as a guaranteed permanent backup.

[Persistence trust boundaries](docs/diagrams/phase-4-persistence.html), [Save transaction/lifecycle](docs/diagrams/phase-4-save.html), [manifest/snapshot relationships](docs/diagrams/phase-4-manifest.html), [deterministic replay sequence](docs/diagrams/phase-4-replay.html), [bundle validation/failure](docs/diagrams/phase-4-bundles.html), and [fresh AI versus replay](docs/diagrams/phase-4-modes.html) describe actual implementation. The [bundle contract](docs/INVESTIGATION_BUNDLE_V1.md), [deep dive](docs/learning/PHASE_4_DEEP_DIVE.md) and [report](docs/reports/PHASE_4_REPORT.md) own format, algorithms, validation and limitations. Phase5 is outside this continuation.

Phase4 executor readiness: a credential-free PROBE/HOST_READY exchange verifies exact parent/frame origins and source before a single MessageChannel transfer. Lazy creation plus iframe-load re-probing handles hydration and delayed documents without replacing an accepted channel. Handshake/cancellation deadlines remain bounded.

## Phase 4.5 CI validation architecture

[CI gate diagram](docs/diagrams/phase-4-5-ci.html) shows independent static/backend/frontend jobs feeding isolated real-engine Chromium integration. Read-only workflow/test authority is separate from deployment. Every DB is disposable test-only; production UI/worker integration uses test-only mocked provider HTTP with active network refusal. [CI guide](docs/CI_CD.md) and [report](docs/reports/PHASE_4_5_CI_REPORT.md) distinguish local Linux container results, prior macOS support and independently verified hosted Linux CI execution. At that historical Phase4.5 milestone there was no product trust/persistence change and Phase5 was unstarted. The following implemented Phase5 delta supersedes that status.

## Phase5 implemented integration delta

The local v1 candidate adds genuine bounded Parquet ingestion without broadening analytical IR. `apps/executor/src/ingestion.ts` inspects Parquet envelopes, metadata expansion and supported scalar schema, then fixed DuckDB projections cast exact numbers to strings before Arrow conversion. Original bytes stay immutable; the approved canonical CSV has a distinct SHA256. `parquet-runtime.json` pins the actual extension separately, preserving historical runtime-manifest identity. Both DuckDB and Pandas independently compute the approved canonical CSV. They share decoding; agreement is CLIENT_REPORTED and cannot prove original data truth, independent decoding or server execution.

Three logical inputs include any lookup. Each calculation permits one full-coverage one-to-one/many-to-one join or an independent revenue computation. Combined primary/lookup CSV stays10MiB, each source/derived file10MiB, all original+derived run blobs30MiB. Grain, uniqueness, missing-key/population and exact minor-unit checks remain in both numerical paths. No arbitrary SQL/Python, generic statistics, three-way joins or connectors are added. Native UI source/type/version feedback and explicit derived/relationship/provider consent use existing workspace conventions.

Manifest2 preserves original Parquet plus derived CSV and strict normalization/decoder/rows/schema lineage; CSV-only artifacts remain unchanged manifest1. `artifacts.ts` excludes original source descriptors from executable authorities. Bundle parser paths are hash-named and STORED-only. Replay hashes both original and derived blobs, executes saved canonical CSV and compares historical evidence without inference/re-decoding. Fresh reasoning stays separately consented and parent-linked.

Operational events use strict allowlisted JSON and hashed UUID correlation. Workflow wrappers sanitize ordinary exceptions before native checkpoint error writes; cancellation/GraphInterrupt propagate. HTTP and lifespan failures suppress exception payloads. A cooperative lifespan task periodically runs existing fenced transactional retention cleanup. Admission is a bounded local actual-peer cap, not distributed public defense. Evaluation runs genuine durable graph versus a bounded single decision loop using equal ceilings and actual mocked HTTP; observed browser arithmetic is reused explicitly.

Validated new diagrams: [ingestion and provenance](docs/diagrams/phase-5-ingestion.html), [local validation and release gates](docs/diagrams/phase-5-release.html). Reuse [implemented graph recovery](docs/diagrams/phase-2-routing.html) and [immutable zero-inference replay](docs/diagrams/phase-4-replay.html). [Phase5 report](docs/reports/PHASE_5_REPORT.md) owns actual current evidence; [deep dive](docs/learning/PHASE_5_DEEP_DIVE.md) explains flows and trade-offs. External release remains BLOCKED.


## Account and configurable provider extension (2026-10-15)

[ADR-024](DECISIONS.md#adr-024--account-ownership-approved-model-revisions-and-consented-cloud-bundles) extends the earlier anonymous/local persistence scope under explicit user authorization. FastAPI now mounts account authentication, compatible OpenRouter catalogue discovery, approval-gated model revisions and explicit account history. Stable account-linked owner sessions retain existing ledger authorization boundaries; separately revocable login capabilities do not enter graph state. Active run/checkpoint retention remains expiring; durable account Save copies sanitized evidence/report/protocol metadata into separate account tables. Cloud bundle bytes are a separately consented, disabled-by-default private object-store boundary, never metadata table content. A durable PENDING reservation precedes PUT and remains counted during uncertain outcomes.

Next.js keeps account tokens and unsaved datasets in memory, adds existing-style account/model/history controls and preserves browser deterministic computation. Model changes keep the same thread and total attempt budget, with explicit approval history and original/current attribution. v3 local manifests retain that lineage while v1/v2 replay remains provider-free. Deployment origins are configurable and validated; hosted security and live service acceptance remain open. See [implementation evidence](docs/reports/SAAS_IMPLEMENTATION_REPORT.md) and [deployment instructions](docs/SAAS_DEPLOYMENT.md). This section supersedes earlier claims that accounts/cloud code are entirely absent; it does not supersede unpassed release gates.
