# Execution Protocol v0.1 — Proposed Contract

This is a design contract, not implemented OpenAPI. Pydantic schemas will produce versioned JSON Schema/TypeScript definitions. Reject unknown fields at security boundaries; support explicit protocol-version negotiation, not permissive fallback.

## Analytical operation IR

An OperationPlan contains operation_version, operation_id, kind, source_dataset_ids + immutable hashes, approved metric_contract_ref, typed parameters, declared dependencies and expected output_schema. Initial kinds: profile, aggregate_metric, grouped_metric, validated_join, period_comparison and supported_statistics. Each kind maps to a fixed compiler implementation. SQL/Python source is compiled for inspection, not accepted as execution authority. Unknown operators/functions/dynamic identifiers are rejected; identifiers must resolve in the approved schema.

Metric contract fields: metric_id/version/hash, name, units/currency, expression tree, source references, grain, join keys/cardinality and duplicate policy, filters, date column, timezone, explicit half-open period bounds, null/NaN behavior, decimal scale/rounding, grouping semantics, zero-denominator policy, absolute/relative tolerances and validation rules. Editable prose alone is not executable semantics. Ambiguity requires a user interrupt. Currency conversion needs a pinned conversion input; no hidden live lookup.

## Job envelope

| Field | Purpose |
|---|---|
| protocol_version, run_id, job_id | Version and owner-scoped identity |
| task_id, attempt_id, attempt_number | One immutable attempt; corrections get new attempt IDs |
| state_version, fencing_epoch | Reject obsolete run owner/state transitions |
| operation_plan, operation_hash | Approved IR and canonical semantic identity |
| dataset_refs, metric_ref | Immutable inputs and semantic version |
| runtime_manifest_ref, compiler_version | Compatible runtime/compiler requirement |
| expected_output_schema | Bounded typed output and canonicalization |
| timeout_ms, output_byte_limit, policy_hash | Effective lower-of-user/deployment execution policy |
| issued_at, expires_at, nonce | Freshness and correlation; no truth attestation |

ResultEnvelope repeats run/job/attempt/operation identifiers and declares dataset/runtime hashes, started/finished timestamps, status (SUCCEEDED/FAILED/CANCELLED), typed values/table, result_hash, warnings and redacted error code. Provenance is assigned by the receiving authority; clients cannot submit RECOMPUTED_SERVER to obtain that label. Runtime/timing/source declarations remain client claims. Decimal values travel as scale-aware strings; timestamps include timezone rules; nonfinite values use explicit tags, not invalid JSON numbers. No preview rows, keys or arbitrary HTML in result payloads.

## Proposed API surface

| Action | Route sketch | Semantics |
|---|---|---|
| Create demo identity | POST /v1/sessions | Rate-limited opaque expiring capability; no user-chosen owner ID |
| Create investigation | POST /v1/investigations | Consent + metadata + budget; raw snapshots rejected |
| Advance a graph segment | POST /v1/investigations/{id}/advance | Idempotency key and expected state version; request-scoped BYOK when inference needed |
| Observe events | GET /v1/investigations/{id}/events | SSE, authenticated; Last-Event-ID reconnect, heartbeat, no key in URL |
| Fetch issued job | GET /v1/investigations/{id}/jobs/{job_id} | Authoritative immutable approved envelope |
| Submit execution result | POST /v1/investigations/{id}/jobs/{job_id}/results | Validate and durably acknowledge; cannot itself bypass graph ownership |
| Resolve interrupt | POST /v1/investigations/{id}/approvals | Binds approval to exact plan/hash/state version |
| Cancel/delete | POST .../cancel; DELETE .../{id} | Tombstone/cancel immediately; purge under retention policy |

A result receipt may schedule a bounded continuation only when credentials are present and authorization remains valid. Otherwise expose READY_TO_ADVANCE and request a fresh authorized advance call. Never keep a key in the pending job or graph to make this convenient. Native EventSource cannot set arbitrary Authorization headers; use cookie-auth or fetch-based SSE as selected in the session transport spike.

## Job and idempotency state

Job: ISSUED → CLIENT_RUNNING (advisory) → RESULT_ACCEPTED or FAILED/CANCELLED/EXPIRED. Result acceptance means protocol validity only. Use a unique (run_id, job_id, attempt_id) key. Same canonical result hash twice returns the first acknowledgement; a different hash for an accepted attempt returns conflict and is preserved as a security diagnostic without overwriting evidence. Reissued retries create a new attempt ID and count toward job limits.

Validate owner, expiry, expected state/fencing epoch, hash binding, allowed operation, required datasets/contracts, output schema and size. Unexpected fields, stale attempts, duplicate conflict, too-large payload and incompatible runtime have distinct machine-readable errors. Never serialize internal exceptions/provider headers to clients.

Persist event sequence numbers monotonically per run. If the reconnect cursor is older than retained events, return a state snapshot and explicit event-history gap. SSE is at-least-once observation; the client deduplicates events. It is not a command queue or durable compute runtime.

## Crash consistency and replay protection

Reserve calls/jobs and record the pending transition before sending effects. Commit result/evidence/event atomically, then resume with a compare-and-swap state version and fenced run lease. Expired leases permit a new owner; old owners cannot write. Graph checkpoint/ledger reconciliation handles crash between result commit and resume, without reaccepting evidence.

Inference is an external side effect: after a timeout the provider may have completed and charged. Record UNKNOWN outcome; do not infer “no cost.” Retries require remaining budget and consume a new call attempt. A cancelled run rejects future results and prevents new dispatch; in-flight provider work may still finish. Exact-once billing and provider cancellation are not guaranteed.

## Budgets

Deterministically enforce PRD caps on both API and executor. The backend owns attempted outbound call count, global/session concurrency and task revisions. Browser owns local wall-time termination and output/data caps; a malicious browser can ignore them, so API caps still hold. Timeouts, schema-repair calls, retries and verifier jobs all count. Terminal budgets produce a partial evidence report with explicit unresolved findings. LLM decisions never increase effective caps.

## Required fixtures

Duplicate same/different results, lost ACK, job expiry, cancellation race, state-version conflict, run-owner restart, forged source/runtime declarations, out-of-order DAG task, malicious operation, over-limit payload and ambiguous provider timeout. Result signatures/hashes may protect envelope integrity but cannot prove execution correctness.
