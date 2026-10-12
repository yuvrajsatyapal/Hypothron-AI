# Phase 4 — Explicit Local Persistence and Deterministic Replay

Date: 2026-10-12. Status: complete for the scoped local desktop target. Scope T4.1–T4.3 only; Phase 5 remains unimplemented. See [CURRENT_PHASE](../../CURRENT_PHASE.md) and [TASKS](../../TASKS.md).

## Implemented behavior and code map

Explicit Save discloses and commits raw immutable CSV snapshots, question, approved metric contracts, accepted calculation lineage/results/compiled source, grounded report and runtime identity to local Dexie. Upload and unsaved investigation remain memory-only; reload does not restore unsaved sensitive data. Existing inventory reads saved metadata; explicit Load displays historical evidence. Save/delete/deduplication/quota share native IndexedDB transactions; failures never report success. Last-reference deletion removes blobs. Storage is unencrypted, app-origin accessible and evictable.

Canonical strict manifestv1 binds content hashes, approved unused inputs, IR/compiler/parser/numerical semantics, runtime versions/asset-lock digest, accepted evidence/status/provenance and dependency order. Replay validates these boundaries and executes only original approved IR through the existing credential-free DuckDB-WASM/Pyodide origin. It makes zero provider/API/planner calls, recomputes verification, compares deterministic fields and appends bounded replay history while preserving original evidence. Timing/allocation measurements are excluded from numerical equality. Imported/replayed results remain CLIENT_REPORTED, never server-attested.

Explicit Export produces a bounded stored-only ZIP. Import rejects malicious paths/duplicate entries/offsets/sizes/CRC/corruption/unknownschema/IR/runtime/compression/encryption/expansion before an in-memory preview; separate confirmation persists atomically. Exact reimport is idempotent; changed content under an existing ID is refused. No arbitrary imported SQL/Python/JavaScript/instructions execute.

Completed AI runs capture all accepted real local results and approved snapshots, including unused inputs. Local results are retained before POST/results ACK, then filtered to durable accepted evidence. Frozen original question/provider/model survives clarification and Resume. Fresh preparation mounts a separate form with empty key/unchecked disclosure; Start creates a distinct budgeted server run with newID/parent. Structural hypotheses/plans/findings/status and actual-or-unavailable ledger token/time comparisons preserve original history. Unknown measurements are null, never invented zero.

Owning files: [artifacts](../../apps/web/lib/artifacts.ts), [storage](../../apps/web/lib/storage.ts), [bundles](../../apps/web/lib/bundles.ts), [replay](../../apps/web/lib/replay.ts), [comparison](../../apps/web/lib/comparison.ts), [history UI](../../apps/web/components/LocalHistory.tsx), [investigation capture](../../apps/web/components/Investigation.tsx), [ledger observations](../../services/api/src/hypothron/ledger.py). FILE_MAP records tests and documentation. No new database migration, provider destination, execution privilege, raw-data endpoint or external service.

## Decisions and alternatives

ADR019 adopts strict canonical manifests, lazy explicit Dexie transactions and storedZIP. Alternatives were automatic history, server snapshot storage, permissive ZIP/decompression and imported executable source; these conflict with consent or enlarge the untrusted execution/allocation surface. The subset sacrifices compression and general ZIP-tool compatibility.

ADR020 separates immutable captured runs from parent-linked fresh stochastic runs, freezes creation attribution, preserves lost-ACK replay evidence and projects owned observed measurements. Cached LLM responses and reprompting are not replay. Finalv1 requires approvedcontracts; incomplete unreleased between-task v1 development artifacts are refused, not migrated. Phases1–3 had no saved format. Future migrations require explicit new records preserving originals.

Logical limits: snapshot10MiB/three snapshots/raw30MiB,metadata1MiB,bundle32MiB,storage64MiB/20investigations,ten replay records per original/256KiB each. Execution remains existing30s host/35s client and scoped input/expansion checks. These are not physical storage quotas or portable peak-heap guarantees.

## Acceptance evidence

| Roadmap/required gate | State | Evidence and practical limit |
|---|---|---|
| Explicit opt-in Save; unsaved reload loss | Pass | RealChrome IDB has no database before Save; original bytes only restored through explicit Load |
| Atomic quota/abort/delete/shared bytes | Pass | Native request abort and QuotaExceededError injection; logical quota/shared-last-reference unit fixtures; browser eviction simulation, not physical crash proof |
| Canonical integrity/IR/DAG/schema/runtime | Pass | Unit negative hashes, source/evidence, forwarddependencies, unknownversions, assetlock and storage schema refusal |
| Validated portable import/export | Pass | StoredZIP malicious path/compression/expansion/encryption/offset/CRC/schema/runtime fixtures; repeated import/collision and credential exclusion |
| Compatible original local replay | Pass | Actual engines on saved simple/multi-input/approvedlookup snapshots; exact comparison and history |
| Zero inference | Pass | Active fetch/route refusal fails replay test if API/provider is attempted; guard explicitly exercised; no paid/live request |
| Corruption, mismatch, cancel/recovery | Pass | Rehashed forged historical agreement is detected by genuine computation; changed bytes fail; cancel/retry preserves original |
| Separate fresh AI with parent/new consent/key | Pass | Real API/LangGraph/Postgres + mocked external HTTP; unused approved inputs, newID/parent, immutable original, unknownmeasurements |
| Lost ACK/frozen attribution | Pass | Accept results then drop HTTP ACK, Resume COMPLETE→Save; edited UI cannot rewrite original provider/question |
| Architecture/learning/reviews | Pass | Six diagrams, comprehensive learning guide; independent engineering/security and design ACCEPT after fixes |

## Validation

Environment: ADR015Chrome154.0.8037.99/macOSarm64/local127.0.0.1:3000web/3001executor/8000API. All external provider HTTP in automation is mocked. PostgreSQL17fixture on55433, Alembic0002head; unrelated55432 preserved. User authorized temporarily stopping unrelated Portfolio servers3000/3001; both development servers were restored after tests and returned HTTP200. Only task-owned local main commits; unrelated services/api/.env.example remains untracked and excluded.

| Command | Actual result | Scope |
|---|---|---|
| DATABASE_URL local55433 `.venv/bin/pytest services/api/tests -q` | 93 passed / 2.65s | Full backend, real migrated Postgres, mocked provider HTTP |
| `pnpm test` | 98 passed / 6.39s | Full frontend/executor unit suite including 14 actual mirrored Pyodide tests |
| `pnpm typecheck` | Pass | Web/executor strict TypeScript |
| Strict `tsc` six Phase4 browser files | Pass | Typed IDB fixtures, no new any helpers |
| Ruff check/format | Pass / 31 files | services/api source/tests |
| mypy services/api/src | Pass / 18 source files | Backend type boundaries |
| `pnpm format:check` | Pass | Configured code globs; new browser files separately formatted |
| `PYTHONPATH=services/api/src .venv/bin/python scripts/export-api-contracts.py --check` | Pass | OpenAPI drift check |
| Alembic current | 0002head | No Phase4 migration needed |
| `pnpm build` | Pass | Executor and final production Next.js build |
| T4.1 Chrome persistence | 2pass/43.2s | Explicit Save/reload/unsaved/deletion/native abort/quota |
| T4.2 Chrome bundles/replay | 3pass/1.2min | Simple replay/import/corruption/cancel/inferenceguard |
| Fresh-history scoped Chrome | 1pass/1.8min | Completed multi-input Save/fresh-parent/replay |
| First full31Chrome | 27pass/4fail/7.2min | Three unscoped status selectors and retry assertion racing old CANCELLED state; corrected |
| Second full31Chrome | 29pass/2fail/9.1min | Initial runtime loading timeout and import selection while Delete pending; fixed readiness lifecycle and enabled-control synchronization |
| Targeted six affected Chrome | 6 passed / 1.1min, then 6 passed in startup-diagnostic run | Persistence, import, replay and corruption |
| Delayed-document startup Chrome | 1 passed / 19.8s | Genuine early execution then replay; hydration and readiness |
| Final full32 Chrome | 32 passed / 6.1min | Real Chrome/IndexedDB, actual DuckDB/Pyodide, mocked external HTTP; all Phase1–4 regressions |
| diagram-design self_check.py sixfiles | Pass | Accessible SVG/single-file contract |
| Chrome check-diagrams sixfiles | Pass | ActualGeist fonts, text bounds,390px local scroll/no page overflow; revised root relationships checked |
| Markdown local targets / git diff whitespace | Pass | 43 documents and 296 local targets after final report links; no missing file targets or whitespace errors |

Representative RED: missing storage/replay/comparison modules; missing Ledger.measurements; unused approved input rejected; completed AI Save contained only primary calculation; missing observation count falsely fell back to0. Green scoped tests followed implementation. Real browser checks found hydration/load initialization and repeated-file picker issues; review fixed frozen attribution, lost-result-ACK retention, historical evidence labels, trusted comparison flags and diagram relationships. Test selector/wait changes retain numerical/error expectations. A delayed-document test failed before hydration because file selection occurred before its handler existed; uploads now remain disabled until hydration. A credential-free exact-source/origin PROBE/HOST_READY bootstrap transfers one channel, handling early Execute and late iframe load. Seven execution-unit cases and actual delayed-document computation/replay pass. One full run was interrupted by a continuation message and is not counted as acceptance. Docker had stopped and removed the ephemeral fixture; another partial run was stopped to recreate the cached PostgreSQL17 fixture on isolated55433 and migrate it to0002. Backend gates were rerun on the replacement database before the final complete Chrome suite. These partial runs are excluded from acceptance.

## Mandatory learning and diagrams

[Comprehensive deep dive](../learning/PHASE_4_DEEP_DIVE.md) covers before/after, each major technology's internals/alternatives/limits, all concrete flows/functions/messages, canonical identity/content addressing/transactions/DAG/compatibility/comparison algorithms, production risks, actual tests, detailed interview answers, two-/ten-minute explanations, exercises and prioritized learning. [System-design guide](../SYSTEM_DESIGN_GUIDE.md) links the learning progression.

Six distinct implemented diagrams: [persistence/trust](../diagrams/phase-4-persistence.html), [Save lifecycle](../diagrams/phase-4-save.html), [manifest model](../diagrams/phase-4-manifest.html), [replay sequence](../diagrams/phase-4-replay.html), [bundle validation](../diagrams/phase-4-bundles.html), [fresh AI versus replay](../diagrams/phase-4-modes.html). Inherited provisional editorial style; no UI rebranding. Installed skill self-check and realChrome rendering pass. Repository-only skill geometry/skin linters are unavailable; exact connector/port/mask geometry was independently inspected. Static font fallbacks are disclosed.

## Security/reliability review and residual risks

Engineering/security ACCEPT: strict executable authority, consent, bounded imports/storage, no credential/capability serialization, owner-scoped measurements, immutable parents, active zero-inference guards, frozen identity and lost-ACK recovery. Design ACCEPT: historical/provenance labels, focusable local scrolling, meaningful error recovery and implementation-accurate diagrams. Final nullable-observation, strict readiness bootstrap and hydration changes independently re-reviewed ACCEPT. The final full Chrome gate passes.

Browser-local records are unencrypted and readable by application-origin scripts. Physical eviction/quota/crash and secure deletion are not guaranteed. Exports are sensitive independent copies. Logical limits do not establish a universal hard heap ceiling. CLIENT_REPORTED agreement and hashes do not attest a client or validate business definitions/causality. Unsupported formats/versions fail; no automatic migrations, encrypted storage, cloud sync, server recomputation, Parquet/generalanalytics or mobile/hosted support. The actual operation/runtime/device scope remains Phases1–3. No live/paid model requests or production-readiness claim.

## Resume and task commits

- T4.1 `6bc489e94c36e3b103f389f2b71e2917d2fdc74a` — explicit local persistence;10unit/2Chrome/TypeScript/design+engineering.
- T4.2 `26c0e959cd2092721fe00189f13e212f2b4b8595` — validated bundles/zero-inference replay;20unit/3Chrome/TypeScript/build/engineering.
- T4.3 `27caaed24ae04c37ad1627b6b29eb5b021d1d7ed` — linked fresh runs, measurements, diagrams/learning and all final acceptance gates.

Phase4 acceptance gates pass. Stop before Phase5; no push, PR, deployment, publication or paid inference. The historical Phase3 evaluation is preserved byte-for-byte; [Phase4 regression observations](PHASE_4_REGRESSION_EVALUATION.json) retain the final ten golden/twelve adverse fixtures, 22 passes and zero false VERIFIED adverse outcomes. These fixtures are finite honest-client evidence, not execution attestation or universal accuracy.

All three tested tasks are locally committed on main. The completion-ledger update records their immutable hashes without amending them.
