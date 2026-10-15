# Configurable OpenRouter free models

Status: approved by the user on 2026-10-14 with discovery/selection before durable fallback. Implementation and validation are tracked in ../plans/2026-10-14-saas-implementation.md and ../../reports/SAAS_IMPLEMENTATION_REPORT.md. Catalogue availability is never guaranteed model access.

## Intent and authorized scope

Implement the user's configurable OpenRouter free-model discovery, manual selection, compatibility validation and approval-gated fallback requirements. Preserve existing Gemini behavior, LangGraph checkpoints, consent, twelve-call budgets, numerical verification, replay and UI styling. This is an integration extension, not the broader account/cloud SaaS project. Work exclusively on existing main; no deployment, push, paid inference or infrastructure. Preserve unrelated existing edits, especially Investigation.tsx, and never print user environment values.

## Audit findings

- `providers/http.py` already sends fixed-host, bounded, strict JSON-schema OpenRouter requests with ephemeral keys and sanitized failures. It does not discover models, enforce endpoint parameter support or constrain pricing.
- `RunRecord.model` records the concrete selection. `ledger.create` binds it into idempotency checks; the driver always uses that value. Preserve this property.
- Every provider reservation consumes a durable ordinal. An unresolved reservation is BILLING_UNKNOWN and cannot be repeated. Do not weaken this crash/billing protection.
- The workflow converts provider failures into terminal FAILED, or a deterministic report fallback. Supporting model-switch approval therefore requires a real resumable graph state, not changing the input field and retrying a terminal run.
- The existing frontend freezes run context but accepts arbitrary model text. It defaults to Gemini and uses a paid-looking OpenRouter model slug; do not change Gemini defaults as part of this task.
- Root `.env` is currently preparation only. Add explicit root dotenv loading for the API launcher as scoped configuration work; never source user values as shell code or expose credentials through frontend configuration. Migrations/other SaaS environment settings stay outside this feature.

## Proposed configuration (builder defaults)

`OPENROUTER_MODEL=auto` means Hypothron resolves a compatible concrete free model locally. Never send `auto`, `openrouter/auto`, `openrouter/free`, a preset, model list or another dynamic router as the model of an investigation. A configured explicit concrete slug is a preferred initial choice, validated against discovery. Manual selection overrides the default, not compatibility requirements.

Add `OPENROUTER_FALLBACK_MODELS` as a comma-separated ordered list of at most ten concrete free IDs; default empty. Add `OPENROUTER_DISCOVERY_TTL_SECONDS=300`, validated within 30–600 seconds. Invalid configuration fails with sanitized startup errors. Do not overwrite an existing user's model setting or credentials. Update only new non-secret placeholders in the private file when implementation begins.

Use the existing request-scoped BYOK input. This feature does not activate the shared `OPENROUTER_API_KEY` environment credential for inference; doing so needs a separate shared-key admission/security decision. Keys never enter discovery cache, checkpoints, metadata, logs, URLs or artifacts. Explicit discovery can send a BYOK key in a request body to the backend, then only in the fixed upstream authorization header. No keyless automatic paid fallback.

## Discovery and compatibility

Add a backend model catalogue service and authenticated bounded discovery endpoint. Request the fixed `https://openrouter.ai/api/v1/models` endpoint with no redirects, environmental proxies or arbitrary URLs. Validate a bounded streamed response and timeout; cap catalogue entries and total requests/pagination. Cache only normalized public catalogue metadata in process memory with monotonic expiry, one refresh in flight and bounded refresh failure backoff. Do not cache credentials or account-specific entitlement assumptions. Catalogue availability is distinct from account access and successful role output.

Eligibility fails closed: concrete bounded ID, text input/output, finite nonnegative decimal pricing with zero prompt and completion costs, no known positive request/other applicable text-request fees, `structured_outputs`, `response_format`, `temperature` and `max_tokens` capability support. Unknown required prices/capabilities are ineligible; missing optional non-text fees do not by themselves exclude a text-only request. Honour expiry/deprecation metadata. Validate output capacity for 1024 tokens. Require context capacity sufficient for the existing bounded prompt plus schema/output reserve, using a documented conservative estimate rather than claiming a universal tokenizer guarantee. A builder chooses exact catalogue/schema ceilings and estimate, writes them into tests/docs, and keeps existing prompt/body/output ceilings intact.

Auto selection: first eligible configured fallback/preference, then eligible catalogue IDs sorted deterministically by context capacity descending and ID ascending. This is a reproducible policy, not a quality ranking. Empty eligible set, stale catalogue on refresh failure or unavailable configured explicit model blocks start with a clear error; never relax structured output or select a paid model.

The UI must display the resolved concrete model and current advertised free status before Start consent. Refreshing discovery or changing provider/model resets consent. Start carries the concrete selected model, and server revalidation rejects changed eligibility without creating/dispatching an investigation. `auto` configuration is returned as a preference, not persisted as the selected model. Validate again before each new uncached OpenRouter dispatch, including resumed runs; completed cached role responses require no discovery/provider call. No catalogue call consumes an inference reservation, but discovery itself is time/concurrency/payload bounded.

For OpenRouter dispatch set `provider.require_parameters=true`, disable upstream provider fallback, and constrain prompt/completion/request maximum prices to zero for free-mode runs. Submit one concrete model only. Reject response model identity mismatches if the response identifies a different canonical model; normalize only documented identity equivalents. Strict response/Pydantic validation remains authoritative and successful discovery is not numerical or server execution attestation.

## Consent and resumable fallback

On a definitive 429, model/endpoint-unavailable response, or failed fresh preflight, pause at the failing graph role with a sanitized model-approval interrupt. Do not retry automatically. Persist no provider response body. A failed HTTP attempt consumes its existing durable ordinal; preflight failure before dispatch does not consume one. Preserve all completed role replies, pending jobs, evidence, corrections, clarification count, elapsed/usage observations and remaining budget. Explicit provider auth failures and malformed outputs are not fallback triggers. Timeout/disconnect/crash reservations remain billing-unknown and cannot be retried by approving a model switch.

Record a definitive failed-attempt status so restart can distinguish known rejection from ambiguous reservation. Route the retry through a checkpointed pause node, avoiding an `interrupt` around untracked side effects that would repeat a reservation on resume. A builder may choose exact graph node names and new state fields, but must prove ordinal reconciliation across process restart.

Fallback choices are the configured compatible free list (current model removed); absent eligible configured choices, users can manually choose another discovered compatible free model. Nothing is selected or dispatched until explicit approval. A model approval requires fresh provider/metadata consent, exact expected current model/revision, selected model, fresh ephemeral key and idempotency token. Validate ownership, expiry, paused role, remaining budget, current eligibility and absence of an active lease. Use existing ledger fencing to serialize with advance/cancel and prevent overlapping requests. Preserve the same run/thread/checkpoint; never restart with a fresh twelve-call budget.

Store original/current concrete model, monotonic selection revision and sanitized approval events with old/new model, reason, timestamp and approved role. Bind each new attempt to the selected model/revision so historical evidence remains attributable and cached responses cannot be relabelled. Existing rows/migrations need backwards-compatible defaults; no credential columns. Run inspection exposes original/current model and revision/history. Saved artifacts retain original model attribution and explicit switch lineage without invalidating legacy v1/v2 bundles; version any extended artifact schema if required. Replay still performs zero inference.

## UI changes

Reuse the existing investigation panel and styles. For OpenRouter add explicit model discovery/refresh, resolved Auto preview and a compatible free-model selector. Preserve Gemini's existing form. Disable model changes on active runs; show original/current models with switch history. A paused run displays the sanitized failure, remaining budget, compatible fallback choices and explicit Approve model switch and resume action. Cancelling or declining leaves checkpoint/evidence intact and clears keys. Do not turn general Resume into implicit approval. No new screens or animation.

## Written decision updates required during implementation

Add an ADR for model compatibility/discovery caching and approval-gated model revisions, explicitly preserving request-scoped BYOK, no automatic model/provider routing and billing-unknown safety. Update configuration/provider/security contracts and implemented-status documentation only after tests pass. Do not describe this extension as completing production SaaS or live-model verification.

## Acceptance and validation

1. TDD catalogue/config tests cover malformed/missing prices, paid models, routers, schema support, text/context/output requirements, expiry, deterministic auto policy, manual selection, TTL/concurrent refresh, payload/time limits and sanitized upstream failures.
2. Transport tests verify one concrete model, endpoint capability/zero-price/fallback constraints, model identity checks and secret redaction; no additional HTTP attempt after 429 until approval.
3. Real PostgreSQL/Alembic/LangGraph integration proves selected model persistence, idempotent create, pause/restart, explicit switch approval, attempt lineage, stale/conflicting approval denial, cancellation/lease races, foreign-owner denial and unchanged total budgets. Billing-unknown reservations stay blocked. Gemini regressions pass.
4. Frontend unit/type tests and focused real-browser API/DB/graph/executor workflow cover Auto preview/consent, manual choice, rate-limit pause, rejection, approval, restart recovery and saved attribution. Preserve unrelated UI changes. External HTTP doubles are appropriate for deterministic adversarial tests; record them explicitly.
5. Fetch a real OpenRouter catalogue for non-inference integration validation if the network permits, with no private data and no secrets in outputs. A real-model inference smoke test requires separate explicit authorization for any possible cost; if absent, report live inference as unvalidated rather than substituting mocks for that claim.
6. Run backend lint/types/relevant regression, web types/units/build, contract drift checks and migration validation. Record exact pass/block evidence and review before local task commits.

## Sources checked 2026-10-14

- [Model catalogue](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties): prices, modalities, parameters, pagination and capacities.
- [Structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs): capability checks and require_parameters; strict enforcement varies by endpoint.
- [Provider routing](https://openrouter.ai/docs/guides/routing/provider-selection): allow_fallbacks, require_parameters and max_price request controls.

These sources describe upstream contracts, not compatibility measurements for Hypothron. No inference or private credential request was made during the audit.
