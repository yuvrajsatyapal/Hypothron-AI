# Phase 2 — durable bounded investigation

Updated: 2026-10-12. **In progress, not complete.** T2.1 provider transport is complete; T2.2 conditional graph module is implemented/tested with Gate3.5 ACCEPT. T2.3 durable ownership/checkpoints/jobs is reviewed complete; T2.4 workspace/SSE integration remains in progress. No Phase2 completion/deep-dive gate is claimed.

## Implemented behavior and code map

[models.py](../../services/api/src/hypothron/agents/models.py) defines strict metadata/approved metric, hypothesis, planner/analyst/report and numerical evidence contracts. No rows or arbitrary source fields are accepted. [workflow.py](../../services/api/src/hypothron/agents/workflow.py) builds a genuine LangGraph StateGraph: planner conditionally clarifies or delegates; analyst chooses an existing hypothesis; deterministic issuance selects its unchanged approved contract; an interrupt waits for a hash/job-bound result; new evidence returns to the analyst for follow-up or report. A separate issuance node checkpoints a UUID before the replayed interrupt node, avoiding regenerated IDs on resume.

[provider.py](../../services/api/src/hypothron/agents/provider.py) adapts genuine request-scoped Gemini/OpenRouter HTTP to three distinct role instructions/schemas. The key lives in an ephemeral transport instance, never graph state/config. It requires reservation/usage callbacks. Production atomic reservation and role-response caching are T2.3 work. No live-model calls or inference routes exist yet.

Policy caps outbound graph attempts at12, execution jobs at6 and clarification round at1. IDs/citations must belong to the approved graph. Independent scalar evidence comparisons retain CLIENT_REPORTED provenance; unknown/noncanonical output fails. Metadata includes approved questions/schema/contracts and aggregate evidence, not CSV bytes. Policy is outside LLM discretion.

## Tests and Red → Green

The first workflow test run failed collection because the implementation was absent. Five routing/budget/binding/citation tests passed after implementation. A new invalid-clarification test then exposed a fixed edge that incorrectly restarted planner inference after rejection; conditional failure routing now stops it. Eleven workflow tests pass, including clarification→job→evidence-driven follow-up→report, 12-call refusal, six-job termination, hash binding, orphan citations, provider timeout without retry, one clarification cap, selection among three approved dataset descriptors and real adapter wire construction with no canary in checkpoint state/metadata. InMemorySaver is a deterministic test harness, not durable production persistence.

## Learning and decisions

Read models→workflow→provider→test_workflow.py. Distinguish the reasoning control graph from the job dependency DAG. `interrupt` restarts its node on resume: keep side effects/UUID creation in a completed earlier node. Typed model outputs still need ownership/contract/citation policy checks. Absolute provider deadlines do not imply exactly-once billing. LangGraph checkpointing alone does not atomically commit a business job ledger; T2.3 must reconcile both with fenced ownership and durably reserved/cacheable side effects.

Primary API references used during implementation: [LangGraph interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts), [persistence](https://docs.langchain.com/oss/python/langgraph/persistence). Study the installed version/lock alongside documentation. The Phase2 deep dive and implemented diagrams are mandatory before the phase exits; they will teach the integrated system after T2.3/T2.4 exist rather than inventing those flows now.

## Commit ledger and next work

T1 foundation:29b4b6c05a9f04fb6f01b6877f698e78f8347949. T2.1:4465520085dabd6d126f23e9c1632cf1793cc372. T2.2:4b72afc1c800407832cade07587a45a1447f66f2. Next:T2.3 real PostgreSQL saver/ledger/lease/recovery and T2.4 UI/provider consent/SSE integration. No automatic provider retry on uncertain billing. No raw data/key persistence. Continue without another approval; external release remains unauthorized.

Final T2.2 check:42backend tests pass (11workflow+26provider+5realPostgreSQL), Ruff and mypy10source files pass. Reviewer independently reran11workflow tests and accepted the scoped module. Citation validation currently checks existence, not every free-text numeric claim; Phase3 must strengthen it. The compiled graph closes over its ephemeral provider/key: production must construct/discard it per segment, never cache credential-bearing graph instances. Durable reservation/ownership/fencing/recovery remain T2.3 gates.

## T2.3 durable foundation evidence (2026-10-12)

Migration0002 installs the native saver schema through Alembic and metadata-only run/job/attempt/event tables. SQLAlchemy transactions row-lock runs before reservation, acceptance and lease mutations. Creation explicitly flushes the parent before its event. Attempts are durably reserved before transport, completed strict replies cached by role/context digest/ordinal, and unfinished reservations fail with BILLING_UNKNOWN without retry. Both graph and ledger enforce12 calls/6jobs. ExecutionJob rejects extra fields.

FencedPostgresSaver scopes reads/listing/writes to its leased run; unrestricted listing/cross-run before cursors/deletion are denied. Live epochs and terminal checks fence writes. Cancellation invalidates the epoch; an identical previously accepted result still receives its ACK, while new terminal results are denied. Driver reconstructs adapters/savers per request, disables tracing and applies a60s whole-segment deadline with separately bounded5s cleanup. Native connections/statements/locks have5s limits; the process-local2-slot semaphore is not a deployment-global quota.

Crash injections prove the same checkpointed job is inserted after a missed ledger write, accepted evidence resumes a fresh driver, and interruption after reservation produces billing uncertainty without another inference. Expiry sweep locks parents, removes checkpoint writes/blobs/checkpoints, then cascades business metadata. It runs on session creation; a scheduled hosted sweep/backup policy remains Phase5. Completed-state inspection checks owner/expiry before an exact-thread read and cannot invoke inference.

Red runs exposed missing modules, event-before-parent insertion, missing independent job cap, cross-run native reads, terminal mutation and orphan native retention. Each reproduced issue now has a passing regression. Latest full run:61backend tests passed in2.54s; subsequently two added API negative/SSE tests also pass (63 total pending next full run). Ruff/mypy16 modules pass. Gate3.5 ACCEPT; reviewer independently37provider/workflow tests pass, reviewer local TCP unavailable for PostgreSQL. Parent realDB evidence is explicit. API tests use real Gemini wire construction with MockTransport, never live inference.

Read ledger→checkpoints→driver→retention and their tests to study transaction boundaries, fencing vs leases, interrupt node restart, cached side effects vs exactly-once billing, and recovery across separate checkpoint/business commits. Comprehensive Phase2 teaching/diagrams remain mandatory before phase exit.
