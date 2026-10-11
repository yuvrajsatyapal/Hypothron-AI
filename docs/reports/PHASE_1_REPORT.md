# Phase 1 — Deterministic browser foundation

Updated: 2026-10-12. Status: **complete for ADR-015 scoped local desktop target**. Phase 0 workflow review is complete. Phase 2 starts after this scoped exit; independent provider prework is recorded below. No later phase is implicitly approved as complete by this report. See [CURRENT_PHASE](../../CURRENT_PHASE.md) and [TASKS](../../TASKS.md).

## Implemented behavior and component map

A real local CSV is hashed in browser memory. The user specifies amount/date columns and a half-open UTC interval; the initial contract is USD revenue, exact cents, excluding empty amounts. A separate credential-free static origin receives a dedicated MessageChannel. It preloads and verifies pinned runtime assets **before signalling readiness**. Dataset-bearing compute workers receive immutable asset buffers and CSP denying connections and arbitrary script imports. DuckDB runs inspectable compiler-generated SQL; Pyodide runs a fixed independent Pandas/Decimal/NumPy template. The UI compares typed results, labels CLIENT_REPORTED provenance and displays the executed contract, sources, runtime versions and measured data allocations.

Replay re-executes the original in-memory plan/snapshot and compares both engines' results and runtime versions. It does not call any provider. This minimal replay disappears on reload; durable manifests/import/export/Dexie are Phase 4 work. No mock analytics or hardcoded displayed totals are used. Browser fault injection is confined to tests.

| Actual files | Responsibility |
|---|---|
| [page.tsx](../../apps/web/app/page.tsx), [globals.css](../../apps/web/app/globals.css) | Local dataset/metric/evidence UI; original-contract replay; accessible status and controls |
| [execution.ts](../../apps/web/lib/execution.ts) | Readiness, immutable typed jobs, result validation, cancellation/deadlines and stale reply rejection |
| [contracts.ts](../../apps/executor/src/contracts.ts) | Restricted IR, SQL compiler, fixed independent Python, exact comparison, input/result bounds |
| [host.ts](../../apps/executor/src/host.ts), [assets.ts](../../apps/executor/src/assets.ts), [worker.ts](../../apps/executor/src/worker.ts) | Bootstrap and compute boundaries; local asset readers; actual engine execution and cleanup |
| [server.mjs](../../apps/executor/server.mjs) | Separate-origin security headers, static GET-only runtime delivery; no access logs/cookies |
| [build-executor.mjs](../../scripts/build-executor.mjs), [verify-assets.mjs](../../scripts/verify-assets.mjs), [bootstrap-assets.mjs](../../scripts/bootstrap-assets.mjs) | Mirror pinned dependencies, verify source integrity, bundle without compute-time script loading |
| [api.py](../../services/api/src/hypothron/api.py), [limits.py](../../services/api/src/hypothron/limits.py), [db.py](../../services/api/src/hypothron/db.py) | FastAPI health/readiness, expiring hashed demo capabilities, bounded metadata bodies, SQLAlchemy persistence |
| [0001_sessions.py](../../services/api/migrations/versions/0001_sessions.py) | Real PostgreSQL metadata migration; no dataset storage |
| [runtime-manifest.json](../../packages/contracts/runtime-manifest.json) | Exact mirrored asset SHA-256/runtime lock |
| [foundation.spec.ts](../../tests/e2e/foundation.spec.ts) | Actual browser engine, contradiction, privacy, cancellation and CSP regressions |

The browser foundation does not call FastAPI during calculations. FastAPI's metadata/session slice has real PostgreSQL integration tests; investigation API integration, LangGraph and SSE are not implemented.

## Decisions and alternatives

- **Separate bootstrap from computation (ADR-013).** `connect-src 'self'` in dataset-bearing workers allowed a synthetic canary GET to reach the static origin even though the server returned 404. Returning 404 is not an exfiltration barrier. Trusted runtime JS is now bundled and hash-checked at build time; fixed binary/package assets are checked and preloaded by the dataset-free host. Compute and nested workers deny native connections. The in-memory fetch adapter supplies assets; CSP supplies the network barrier. A monkey patch alone was rejected.
- **Exact monetary arithmetic.** SQL uses DECIMAL(18,2); Python parses strings into Decimal and converts to integer cents. NumPy counts rows rather than summing monetary floats. `10.10 + 20.20 + 0.03 = 3033` cents. No rounding-away of contradictions. Overflow/invalid precision is a failure, not a silently rounded metric.
- **Finite operation surface.** One supported revenue operation has no source/URL/path/tool fields. Arbitrary SQL/Python, file operations, package imports, joins and other metrics are rejected or unavailable. Unsupported operations must be implemented through new versioned contracts; displaying compiled code does not authorize running edited code.
- **Ephemeral bearer identity (ADR-014).** Only a token hash enters PostgreSQL; the random capability is returned once. Cookie/SSE deployment behavior remains unproven. Development DB ownership is broad for migration convenience, not a production least-privilege claim.
- **Heuristic ingestion guard.** A 10 MiB source cap plus conservative character/delimiter estimate and row/column limits protects ordinary expansion. The estimate deliberately over-counts quoted delimiters. Measured dataframe/SQL allocations are checked separately. JS/WASM runtime overhead has no portable hard cap; no heap-limit claim is made.

## Acceptance evidence

| Roadmap gate | Status | Evidence and limits |
|---|---|---|
| Independently agreeing SQL/Pandas totals | Pass on tested fixtures | Real engines produce 3033 cents; negative/decimal and exclusive-end cases produce 9 cents |
| Injected contradiction and missing verification | Pass | Browser result fault injection yields DISPUTED; empty metric yields INCONCLUSIVE; malformed evidence is rejected before comparison |
| No raw upload or IndexedDB before Save | Pass on tested flow | Request POST capture empty; IndexedDB database count zero; Save/storage code does not exist |
| Denied operation/network/script capabilities | Pass on tested local Chrome boundary | Free-form code rejected through real channel; wrong hash rejected; native XHR and dynamic import blocked in main compute worker; static POST denied. Nested-worker native XHR denial and wrong-origin/sibling-source handshake rejection also pass |
| Minimal replay without inference | Pass | Both real engines execute again, values match, no POST requests; runtime/snapshot mismatch unit refusal. No provider calls occur on this path |
| Exact runtime lock and source integrity | Pass locally | Hash-checked mirrored assets and tampered-source build rejection; runtime versions in result. Export/replay migration support not implemented |
| Desktop startup and resource measurements | Partial | JSON records fresh desktop five-row and 100,000-row samples, dataframe memory and tracked SQL allocation. Process-tree RSS includes shared pages and runtime overhead; not a continuous maximum |
| Initial supported target / larger input | Pass within explicit ADR-015 scope | Actual100k and near-source-limit padded100k workloads pass. Chrome154/macOSarm64/8GiB local target only;100k row cap enforced. Physical mobile and public/other-target checks deferred rather than claimed |

## Validation evidence

Recorded successful commands, before the final consistency audit:

| Command | Actual result |
|---|---|
| `pnpm test` | 26 tests pass: contracts, bridge deadlines/cancellation/result rejection, runtime-source tamper rejection |
| `DATABASE_URL=… services/api/.venv/bin/pytest services/api/tests -q` | 5 real-PostgreSQL tests pass: migration readiness, hashed/owner-scoped session, secret-safe schema rejection/no dataset endpoint, chunked body limit, expiry/purge |
| `pnpm e2e` | 18 actual installed-Chrome tests pass in 1.6 minutes in the final run |
| `pnpm typecheck` | Web and executor strict TypeScript pass |
| Ruff check/format; `mypy services/api/src` | Pass; four typed source files |
| `pnpm build` | Final executor bundling and Next.js production build pass |
| `node scripts/measure-browser.mjs` | Actual measurement in [JSON](PHASE_1_BROWSER_MEASUREMENT.json) |

Representative observed Red → Green: compiler tests initially failed three restrictions; coerced null policy/malformed evidence added seven failures before fixes; four bridge tests failed/time-out before bounded handling; the same-origin CSP test observed 404 before compute/bootstrap separation and then native denial; source integrity test resolved when it should reject before hash checking; metadata body-limit test returned 422 before its 413 fix. Do not infer that every existing test had an independently recorded failing run. A development/production `.next` collision caused missing client assets; separate build directories now avoid that regression.

No live LLM requests, paid inference, deployment, commits or PRs occurred. Provider UI/API functionality is not implemented and has not been smoke-tested. Independent transport prework is recorded below.

## Learning guide

Read the implementation in this order:

1. **contracts.ts and contract tests.** Trace string inputs to approved IR to independent SQL and Python. A runtime validator rejects unknown fields and coercion even when a TypeScript caller claims a valid type. Compare Decimal/int arithmetic with binary floating point; study SQL SUM(NULL) versus a zero-valued nonempty metric. Exercise: derive the total if the end date becomes inclusive and identify which evidence changes.
2. **worker.ts and assets.ts.** Pandas vectorized timezone filtering selects the same half-open population as SQL; Decimal conversion is deliberately exact and separate. Workers make CPU work responsive but do not themselves deny network or protect origin secrets. Exercise: remove the CSP in a test branch and explain why replacing fetch is insufficient against native XHR.
3. **host.ts, server.mjs and build scripts.** Trace build-time reviewed JS → hash-checked dataset-free bootstrap → transferred buffers → network-denied workers. Hash integrity establishes artifact identity, not publisher trust or truthful computation. Explain why 404 still meant the canary was sent and why arbitrary edited Python is unavailable.
4. **execution.ts and bridge tests.** MessageChannel data is an untrusted runtime boundary. Correlation IDs bind replies to one pending snapshot/contract. Local cancellation rejects immediately; host cancellation terminates work; deadlines bound lost handshakes/replies. Exercise: deliver an old successful reply after cancel/new execution and identify why it cannot resolve the new job.
5. **api.py, limits.py, db.py and migrations.** `async` overlaps DB I/O; it is not a numerical execution sandbox. `async_sessionmaker.begin()` defines a transaction, SQLAlchemy maps metadata records and Alembic owns schema evolution. Capability hashes permit equality lookup without storing the bearer. The ASGI receive loop bounds chunked bodies before JSON parsing. Exercise: remove expiry filtering and show the security regression in the PostgreSQL test.
6. **page.tsx and browser tests.** An upload generation prevents stale asynchronous hashes from replacing current data. Controls cannot mutate a running snapshot. Failed runs clear prior evidence; replay explicitly shows the original executed contract. Study CLIENT_REPORTED separately from VERIFIED: a forged browser can still lie consistently.

Interview explanation: “I first built a deterministic local slice before adding inference. SQL and Pandas independently calculate an approved metric on an immutable browser snapshot. Runtime code loads before data arrives; compute has native network denial. Typed evidence carries versions and client provenance. Replay recomputes without inference. The measured cost is substantial runtime/browser memory, and I have not established mobile support or server attestation.” Say “planned” for LangGraph roles, durable recovery, opt-in persistence and public deployment.

Relevant diagrams: [planned system architecture](../diagrams/system-architecture.html), [planned investigation flow](../diagrams/execution-sequence.html). These depict the full target; only the deterministic foundation is implemented.

## Security, reliability and remaining risks

Implemented: no raw-data API, no browser persistence, separate credential-free execution origin, fixed IR/templates, hash binding, strict numerical/envelope validation, native compute CSP, output/time/source/preflight bounds, worker cleanup, expiring hashed capabilities and secret-safe errors.

Open: peak/large-input/device resource matrix, physical mobile runtime compatibility, public-origin configuration/TLS/headers, anonymous abuse limits, production DB roles, compiler/runtime migration contracts, integrated provider consent/redaction, cross-owner investigation/job state and durable recovery. Later features require later tests; current session ownership tests are not job ownership proof. An honest-client numerical result is never server attestation.

## Exact resume

Phase 1 is complete under ADR-015 scoped support. T2.2 is next. Start local PostgreSQL and app/executor using README. Rerun the full final suite after any change. The continuation brief authorizes explicit desktop scoping; ADR-015 records evidence and mobile limitations. Continue automatically to Phase 2 adapter integration, genuine conditional LangGraph and PostgreSQL ledger/checkpoint recovery. The user's continuous authorization persists; no new phase approval is needed.

## Final audit record

Final available suite: 26 unit/script tests, 5 real PostgreSQL integration tests and 18 actual Chrome browser tests pass. Strict TypeScript, Ruff, mypy, Prettier checks and production executor/Next.js builds pass. Local documentation file-link check: 56 targets exist. Frontend design review accepts the corrected UI; engineering review's concrete validation/bridge/source-integrity findings were fixed. This historical run preceded scoped support; the 2026-10-12 final exit below supersedes its gate status.

Desktop measurement records: five-row fixture startup 6795 ms, computation 5479 ms, Pandas dataframe 572 bytes, DuckDB tracked data 104448 bytes, sampled process-tree RSS 1106247680 bytes. Synthetic 100,000-row fixture startup 6832 ms, computation 5512 ms, Pandas dataframe 7500072 bytes, DuckDB tracked data 4263936 bytes, sampled process-tree RSS 1269874688 bytes; both totals were asserted against 101000000 cents. Samples are 200 ms apart and include shared RSS pages; they are individual observations rather than a performance distribution or hard-memory guarantee. No mobile hardware evidence exists.

Available application: local deterministic foundation only. Required env: backend DATABASE_URL and APP_ORIGIN (default localhost). BYOK UI/API configuration, LangGraph, full durable investigation API, evidence/report expansion, opt-in saving/deletion/export/import and full replay bundles are incomplete. Consequently final all-platform investigation/recovery/BYOK/retention/20-question baseline tests cannot yet run. Deployment prerequisites include completing all local phases, tested public origins/TLS/static-worker headers, least-privilege DB roles, abuse limits/retention and current host quotas. External deployment remains separately authorized work. Follow README for actual local setup, this report's six-step foundation study order, then SYSTEM_DESIGN_GUIDE's future phase sequence.


## Independent safe work while the phase gate remains open

T2.1 adds [http.py](../../services/api/src/hypothron/providers/http.py) and [test_providers.py](../../services/api/tests/test_providers.py). Genuine OpenRouter/Gemini REST requests use official fixed hosts and request-scoped header keys. Structured responses, reported/unknown usage, sanitized errors, absolute deadlines, no redirects/proxies/retries and a required attempt-reservation callback are implemented. No LangGraph, durable budget ledger, inference endpoint, BYOK UI or live-model smoke test is claimed.

Red → Green evidence: a prompt containing the canary key, a Unicode-escaped output echo and unexpected response encoding failed their new tests before fixes. Review independently reproduced an escaped key entering a decoded reply and a 2,067-byte gzip body expanding to 2,097,152 bytes before the old decoded-size cap. Fixes check outbound decoded content before reservation; recursively check decoded output keys/nested values and validated output; request identity encoding; reject other encodings before consuming bytes; bound live raw streaming to 64 KiB. Added nested/field-name/raw-stream regressions. Gate 3.5 reviewer independently reran **26 provider tests**, then returned **ACCEPT** for this module only.

Final backend command `DATABASE_URL=… services/api/.venv/bin/pytest services/api/tests -q`: **31 passed** (26 mocked-HTTP provider and 5 real-PostgreSQL). Ruff check/format and mypy pass on six source files. Tests used synthetic canaries; no paid or live inference ran. Study the provider section in [SYSTEM_DESIGN_GUIDE.md](../SYSTEM_DESIGN_GUIDE.md) for async lifetime, decoded trust boundaries, decompression limits and billing ambiguity. This prework alone did not close T1.5; the scoped exit below does.

Final rerun on 2026-10-12: 26 Vitest tests, 31 backend tests, 18 real-Chrome tests (1.4 minutes) pass. TypeScript, Ruff check/format, mypy and Prettier pass. Local Markdown target audit passes on all 61 links across 28 checked documents. Later-phase feature tests cannot run until those features exist; these 75 tests are the complete available suite, not all roadmap validation.

Final `pnpm build` also passed: executor asset validation/bundling and Next.js production compilation/type checks/static generation. Root route is 5.09 kB with 108 kB first-load JS; this is the UI bundle only and excludes the large analytical runtime assets.


## Scoped Phase 1 exit — 2026-10-12

The continuation explicitly authorizes narrowing support by ADR when physical mobile tooling is unavailable. ADR-015 adopts the measured local Chrome154/macOSarm64/8GiB target; mobile/other-device/public-host evidence remains deferred. `xcrun devicectl` is unavailable. A new 100000-row ceiling regression failed before enforcement and passes afterward. Worker initialization now releases job runtime buffers; fresh unpadded/padded100k observations are in the JSON. Padded source is ~9.2MB; both independent totals equal101000000 cents. No hard heap or universal CSV-shape claim is made.

Final checks: **27 Vitest,31 backend,18 actual Chrome tests** pass (browser1.1min), strict TypeScript, Ruff, mypy, Prettier and production build pass. Engineering Gate3.5 reviewer independently reran27unit tests and returned ACCEPT for T1.5/scoped support. [Deep dive](../learning/PHASE_1_DEEP_DIVE.md) and [component diagram](../diagrams/phase-1-architecture.html)/[sequence](../diagrams/phase-1-sequence.html) complete the new teaching gate. Both installed-skill self-checks pass; Chrome rendering confirms Geist/InstrumentSerif loaded, no text outside SVG, local horizontal scrolling at390px without page overflow. Manual visual inspection corrected obscured annotation/lifeline label. The installed skill lacks the repository-only verify-geometry helper; geometry was checked through render/manual inspection, not claimed as that tool's result.

**All scoped Phase1 exit gates pass.** Read the deep dive's nine sections and prioritized exercises. Continue automatically into T2.2; the full application and Phases2–5 are not complete. Local task commit hashes are appended after commits, without rewriting history.

Task completion commit: `29b4b6c05a9f04fb6f01b6877f698e78f8347949` — T1.0–T1.5 initial tested foundation baseline on main. No push/deployment.
