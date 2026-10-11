# Phase 2 — durable bounded investigation

Updated: 2026-10-12. **In progress, not complete.** T2.1 provider transport is complete; T2.2 conditional graph module is implemented/tested with Gate3.5 ACCEPT. T2.3 durable ownership/checkpoints/jobs and T2.4 UI/API/SSE integration remain pending. No Phase2 completion/deep-dive gate is claimed.

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

T1 foundation:29b4b6c05a9f04fb6f01b6877f698e78f8347949. T2.1:4465520085dabd6d126f23e9c1632cf1793cc372. T2.2 hash recorded after reviewed task commit. Next:T2.3 real PostgreSQL saver/ledger/lease/recovery and T2.4 UI/provider consent/SSE integration. No automatic provider retry on uncertain billing. No raw data/key persistence. Continue without another approval; external release remains unauthorized.

Final T2.2 check:42backend tests pass (11workflow+26provider+5realPostgreSQL), Ruff and mypy10source files pass. Reviewer independently reran11workflow tests and accepted the scoped module. Citation validation currently checks existence, not every free-text numeric claim; Phase3 must strengthen it. The compiled graph closes over its ephemeral provider/key: production must construct/discard it per segment, never cache credential-bearing graph instances. Durable reservation/ownership/fencing/recovery remain T2.3 gates.
