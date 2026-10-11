# Phase 2 — durable bounded investigation

Date: 2026-10-12. **Complete for the scoped local desktop target.** Implementation, documentation, available validation and engineering/design gates pass. Covers T2.1–T2.4 in [TASKS.md](../../TASKS.md). The user's latest scope is **finish Phase 2, then stop before Phase 3**.

## Implemented behavior and code map

The [investigation panel](../../apps/web/components/Investigation.tsx) uses the primary approved CSV metric plus up to two locally profiled additional snapshots. Explicit consent authorizes questions, schema, contracts and bounded aggregates to reach FastAPI and the chosen provider. Raw CSV bytes stay in memory and execute on the credential-free origin. A clarification pauses the graph; a fresh answer/key resumes the original provider/model/question. Conditional follow-up executes genuine DuckDB-WASM and Pyodide calculations and produces evidence-cited output. No Save or persistent browser storage is introduced.

[models.py](../../services/api/src/hypothron/agents/models.py), [workflow.py](../../services/api/src/hypothron/agents/workflow.py) and [provider.py](../../services/api/src/hypothron/agents/provider.py) implement three typed LangGraph roles: planner, analyst and report. Deterministic policy bounds twelve outbound attempts, six jobs and one clarification. Issuance checkpoints a UUID before the interrupt node, so resume does not regenerate the job. [providers](../../services/api/src/hypothron/providers) implement genuine Gemini/OpenRouter HTTP with fixed destinations, strict structured replies, bounded bodies/timeouts and ephemeral keys. Tests mock external transport; no paid or live provider calls ran.

[investigations.py](../../services/api/src/hypothron/investigations.py) provides bearer-owned creation, read, advance, result submission, cancellation and finite authenticated SSE. Creation is an idempotent metadata transaction with a client-generated UUID and **zero inference**; advance is separate. [ledger.py](../../services/api/src/hypothron/ledger.py), [driver.py](../../services/api/src/hypothron/driver.py), [checkpoints.py](../../services/api/src/hypothron/checkpoints.py) and [retention.py](../../services/api/src/hypothron/retention.py) implement durable reservation/cache, lease fencing, exact-thread native PostgreSQL checkpoints, immutable acceptance and bounded lazy expiry cleanup. Migration 0002 is applied. [openapi-v1.json](../../packages/contracts/openapi-v1.json) is exported from the actual routes, with a drift check.

## Decisions and alternatives

ADR-016 in [DECISIONS.md](../../DECISIONS.md) records recoverable creation and request-scoped inference. Persisting keys or holding a background job across pauses would violate the privacy boundary. Retrying uncertain inference could duplicate charges; an unfinished durable reservation instead yields BILLING_UNKNOWN. Completed replies can be reused only with matching ordinal/role/context digest.

Native checkpoints and business records use separate commits. Recoverable reconciliation bridges them; this is not universal atomicity or exactly-once inference billing. Lease epochs fence stale writes under row locks, including native saver writes. Cancellation clears keys before awaiting and captures a UI generation/run ID so delayed callbacks cannot affect a subsequent investigation. A fixed number of roles keeps responsibilities clear without adding services or runtime agents.

## Acceptance evidence

| Roadmap gate | Result | Evidence | Limit |
|---|---|---|---|
| Three datasets, ambiguity, prioritized hypotheses, conditional execution and evidence-driven follow-up/report | Pass | Real-browser investigation test; eleven graph tests | Three descriptors; individual approved revenue sums, not joins |
| Job issuance/result receipt crash and reconnect recovery | Pass | test_driver.py, test_recovery.py, test_ledger.py; browser lost-creation-ACK recovery | Full reload loses anonymous capability and unsaved bytes |
| Twelve attempts, six jobs, ownership, sanitized state and provider errors | Pass | Real PostgreSQL ledgers, typed workflow and 26 provider tests | No live provider pricing/capability or deployment-global quota claim |
| Scripted providers prove routing/failures with no paid inference | Pass | MockTransport only replaces external HTTP; API/graph/DB/browser engines are real | Live smoke tests not run; no provider charge incurred by tests |
| Deep dive, actual diagrams, implementation consistency | Pass | Links below; skill self-check and Chrome geometry checks | Local desktop target only |
| Engineering/design review | Pass: Design ACCEPT; final engineering ACCEPT | T2.3 engineering ACCEPT; final T2.4 review ACCEPT after cancellation-generation fix; UI review ACCEPT | Reviewer independently inspected final cancellation code and previously passed30unit tests; complete backend/browser/build evidence is the builder’s |

## Validation

Environment: macOS arm64, Node22.22.3/pnpm10.33.0, Python3.12.15, PostgreSQL17 via Docker, installed Chrome154.0.8037.99. Synthetic fixtures only.

| Command | Measured result | Scope |
|---|---|---|
| `DATABASE_URL=<local fixture URL> .venv/bin/pytest -q` from services/api | **65 passed, 15.58s** | Actual local PostgreSQL; external provider HTTP mocked |
| `pnpm test` | **30 passed, 640ms** | Five Vitest files |
| `pnpm e2e` | **19 passed, 3.6m** | Real Chrome, API, graph, DB and analytical engines |
| `pnpm e2e tests/e2e/investigation.spec.ts` final rerun | **1 passed, 1.8m**; test1.3m | Includes delayed cancellation ACK/new-run-key regression |
| `pnpm typecheck`, `pnpm format:check` | Pass | Web/executor TypeScript and configured Prettier paths |
| `.venv/bin/ruff check src tests`, `.venv/bin/mypy src` | Pass; mypy16 source files | API code/tests |
| `pnpm build` | Pass; compile5.8s | Production frontend/executor; 111kB first-load JS excludes analytical assets |
| `.venv/bin/alembic current` | `0002 (head)` | Actual database |
| `.venv/bin/python ../../scripts/export-api-contracts.py --check` | Pass | Implemented OpenAPI matches committed contract |
| diagram-design `scripts/self_check.py` on three HTML diagrams | Pass | Accessible SVG/static single-file checks |
| `node scripts/check-diagrams.mjs docs/diagrams/phase-2-{architecture,sequence,routing}.html` | Pass | Loaded fonts, no text outside canvas, 390px local scroll without page overflow |

Red → Green examples: absent workflow modules initially failed collection; malformed clarification exposed incorrect routing; parent/event insertion order, independent job cap, cross-run saver reads and terminal mutations gained regressions. Lost creation ACK led to separating idempotent metadata creation from inference. Cancellation during a provider call proves late writes are fenced; a held browser cancellation response proves the next run remains intact. Label association failures were fixed with explicit input/select labels. Docker stopping caused readiness failures and was restored before reruns. A final backend command initially used the wrong environment variable and failed; the corrected DATABASE_URL run is the measured pass above. None of those failures were counted as successful validation.

## Mandatory learning and diagram gate

Read [PHASE_2_DEEP_DIVE.md](../learning/PHASE_2_DEEP_DIVE.md) for practical framework internals, fourteen numbered execution steps, transaction/recovery algorithms, examples/invariants/complexity, production trade-offs, actual tests, interview answers, exercises and prioritized study checklists.

Implementation diagrams use the user's selected default editorial diagram-design style:

- [Components and trust boundaries](../diagrams/phase-2-architecture.html).
- [Creation/inference/execution sequence](../diagrams/phase-2-sequence.html).
- [Conditional routing and recovery](../diagrams/phase-2-routing.html).

All are linked from [ARCHITECTURE.md](../../ARCHITECTURE.md) and the deep dive. Visual inspection corrected an obscured hash/schema annotation, an overlong provider label, inaccurate generic sequence subtitles and a missing terminal return arrow. Google Fonts have offline fallbacks. No UI brand system is inferred from diagram styling.

## Learning guide

Read models → workflow → providers → ledger → checkpoints → driver → routes → Investigation → recovery/browser tests. Study interrupt restart semantics first, then database row locks/fencing, side-effect reservation vs cached results, reconciliation across separate commits, and browser/server trust. The [system-design guide](../SYSTEM_DESIGN_GUIDE.md) links the phase learning progression.

## Security and reliability

No raw-upload endpoint, default browser persistence or persistent credential storage was added. Keys are request-scoped and checked against outgoing/stored structures, never checkpoint configuration. Fixed HTTPS provider mappings disable proxy/redirect behavior; body/deadline limits bound transport. Result ownership/hash/job binding and canonical digest enforce idempotency. SQLAlchemy and native saver operations have bounded waits; whole graph segments are60s, leases90s, provider calls20s, client requests65s and interactions10min. SSE streams terminate/reconnect with committed event cursors; events contain no keys.

VERIFIED with CLIENT_REPORTED provenance means agreement of browser values, not server attestation. Schema/metadata/aggregates remain sensitive. Known-key echo checks do not prove detection of every transformed secret. Structured citation checks do not ground every free-text numerical or causal assertion; Phase3 must strengthen that contract. No measured universal memory/security/performance guarantee is claimed.

## Resume / remaining work

Stop before Phase3 at the user's request. No known failing available test remains at validation closure. Pending later work: richer verification/correction/lineage and supported numerical claims (Phase3), explicit Dexie Save/delete/export/import and complete replay bundles (Phase4), Parquet, broader evaluations, CI, scheduled retention, global quotas and hosted security/header/recovery probes (Phase5). No deployment, paid services, push or PR is authorized. Production readiness is not claimed.

Run locally using [README.md](../../README.md). Required API variable: DATABASE_URL; optional APP_ORIGIN and frontend NEXT_PUBLIC_API_ORIGIN retain tested localhost defaults. Provider credentials are entered in the UI; never put them in env files. Automated browser tests launch the mock-HTTP fixture API themselves; stop a real API on8000 first.

Commit ledger (existing main): foundation `29b4b6c05a9f04fb6f01b6877f698e78f8347949`; providers `4465520085dabd6d126f23e9c1632cf1793cc372`; graph `4b72afc1c800407832cade07587a45a1447f66f2`; durable foundation `94b32d8`. Final integration hash is recorded after its tested-task commit without amending history.
