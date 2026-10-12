# Phase 3 — Verification and Evidence Expansion

Date: 2026-10-12. Status: **complete for the existing ADR-015 local desktop target**. T3.1–T3.3 pass the available scoped gates. Stop before Phase4 under the latest user instruction. This is not a public-release or server-attestation claim.

## Implemented behavior and code map

T3.1 extends `revenue_sum` with an explicit v2 contract while preserving v1 USD/UTC wire and fixed-source compatibility. Approved v2 metrics support exact USD/EUR minor scale2 and JPY scale0, half-open periods, explicit fixed offsets, null policies, unique declared grain and one approved local lookup relationship. SQL/Pandas independently validate original grain, lookup-key uniqueness, full coverage, one-to-one/many-to-one cardinality and population preservation before exact sums. Relationship approval is separate consent; sources remain immutable browser-memory snapshots and derived join frames are ephemeral.

- [Executor contracts/templates](../../apps/executor/src/contracts.ts), [SQL diagnostics](../../apps/executor/src/advanced.ts), [worker](../../apps/executor/src/worker.ts) and [execution bridge](../../apps/web/lib/execution.ts) own fixed operation compilation, local source/hash/approval checks and paired computation. Collision-free Pandas helpers avoid both source names and internal indicator reservations.
- [Approved metric controls](../../apps/web/components/metricApproval.ts), [workspace](../../apps/web/app/page.tsx) and [investigation panel](../../apps/web/components/Investigation.tsx) preserve v1 defaults, approve derived joins and retain the original lookup for memory-only replay.
- [Strict immutable models](../../services/api/src/hypothron/agents/models.py), [verifier](../../services/api/src/hypothron/verification.py) and [browser semantic verifier](../../apps/web/lib/verification.ts) compare counts, exact values, diagnostics and contract identity. Equal totals cannot override grain/null/population contradictions. One empty versus one populated engine is disputed; both empty is inconclusive. Incompatible/missing v2 diagnostics are inconclusive.
- [Conditional workflow](../../services/api/src/hypothron/agents/workflow.py) appends immutable evidence with contract hash/version/currency, exact tolerance, dependencies and CLIENT_REPORTED provenance. Disagreement permits two deterministic reruns of unchanged approved semantics per metric identity, within six jobs and twelve role calls. Corrections add no inference. Exhaustion preserves dispute and routes to reporting.

T3.2 adds bounded structured observations, mathematically grounded claims and accessible paired-engine charts. [Reporting domain](../../services/api/src/hypothron/reporting.py) validates total/count/exact percentage change against explicit verified operands, source/contract IDs and units; percentage operands are ordered baseline/current. Currency/version/business semantics must be compatible; zero baselines are undefined. Python Fraction and [browser report validation](../../apps/web/lib/report.ts) using BigInt avoid floating-point authority. An existing citation alone does not prove support.

Unsupported figures, orphan/incompatible references, disputed operands and causal/correlation/contribution claims are rejected. Those latter relations lack supporting operations in this phase. Arbitrary provider prose, including spelled-out or obfuscated numbers, is refused publication through a fixed qualitative grammar. Published conclusions/findings/charts are deterministic from accepted evidence; rejected drafts or exhausted report inference budgets use an explicit fallback without another provider call. Disputed SQL/Pandas values remain visible. [EvidenceReport](../../apps/web/components/EvidenceReport.tsx) renders text and typed SVG with exact tables, signed rational pixel scaling, citation anchors, status, provenance, currency and lineage. Null, zero and below-chart-resolution values remain distinct.

Phase2 checkpoint observations hydrate from original issued jobs before reporting; immutable accepted business results are preserved. Completed legacy free-text reports show a revalidation notice rather than receive new numerical authority. Existing native PostgreSQL checkpoints, idempotent jobs/results, fenced leases, expiry and cancellation remain in use. No migration was necessary: approved contracts/diagnostics/reports are explicitly versioned JSON payloads in existing records; Alembic remains0002head.

## Decisions and alternatives

[ADR-017](../../DECISIONS.md) records v1/v2 compatibility, supported exact currencies/fixed offsets, approved single-lookup derived views, original-source recomputation and two corrections. Alternatives were unconstrained model SQL/Python, metadata-only join checks, floating money and silent semantic revisions; all weaken correctness or trust boundaries. Fixed offsets deliberately avoid unproven IANA/DST interpretation. User approval and a separately approved new run are required for changed business semantics.

[ADR-018](../../DECISIONS.md) records typed claim support and deterministic publication. Fraction/BigInt replace approximate display-number comparisons; React text/SVG replace model HTML. A small narrative grammar trades flexibility for numerical authority. Nonterminating percentages without an exact bounded decimal assertion are rejected; no silent rounding policy is introduced. Deterministic fallback communicates observations even when a report draft fails.

The registry is the immutable approved per-run contract collection, stored with jobs/checkpoints. No shared metric CRUD service, floating statistics, FX, arbitrary filters, decomposition, causal identification, many-to-many joins, Redis, queues, extra runtime agents or paid infrastructure was added.

## Acceptance evidence

| Gate | Result | Evidence | Scope/limitation |
|---|---|---|---|
| Join/grain/population correctness | Pass | Actual dual-engine advanced/golden browser fixtures; fourteen independent Pyodide tests | One full-coverage lookup; one-to-one/many-to-one only |
| Period/offset/null/currency semantics | Pass | Half-open UTC/+05:30, null-only/error, refunds, JPY fractional refusal, currency/contract incompatibility tests | Fixed offsets only; no FX or geographic DST |
| Exact disagreement and two-correction termination | Pass | `test_verification.py`; 11800/12000 mismatch persists through three immutable jobs; native recovery/cancel test | Client values remain untrusted |
| Traceable observations/claims/charts | Pass | `test_reporting.py`, client validators, SSR and real investigation browser chart/table assertions | Observed total/count/arithmetic percentage only |
| Orphan/incompatible/unsupported numerical or causal claims | Pass | Correct18 vs false20, missing refs, mixed currency, zero baseline, disputed operands, causal/correlation/contribution/prose rejection | Qualitative grammar is conservative |
| Ten golden questions and adverse fixtures | Pass | [Measured evaluation](PHASE_3_EVALUATION.json) and [synthetic fixtures](../../tests/fixtures/phase3-golden.json) | Finite deterministic suite, not universal accuracy |
| Privacy/credentials/recovery/cancel/replay regressions | Pass | Full backend/browser suites, owner/fence/cache/secret/egress/no-save tests | Local target; known-key filtering is not universal detection |
| Deep dive and actual diagrams | Pass | Linked artifacts below; skill and real Chrome validation | Offline font fallbacks; no product-brand claim |
| Engineering/security review | ACCEPT | Independent task/final reviews and regression fixes recorded below | Not a public-production certification |

## Validation

Environment: Chrome154.0.8037.99, macOSarm64/local origins, existing local PostgreSQL17 fixture, pinned DuckDB-WASM/Pyodide/Pandas assets. Provider HTTP is mocked; no paid/live inference ran.

| Command | Actual result | Notes |
|---|---|---|
| `DATABASE_URL=<local fixture> services/api/.venv/bin/pytest services/api/tests -q` | **92 passed /4.60s** | Real PostgreSQL/native saver; no mandatory tests skipped |
| `pnpm test` | **72 passed /10.75s**, nine files | Includes fourteen genuine mirrored Pyodide/Pandas tests |
| `pnpm e2e` | **22 passed /3.8min** | Real browser/API/graph/DB/engines; external provider HTTP mocked |
| `pnpm typecheck` | Pass | Strict web/executor TypeScript |
| API `ruff check src tests` | Pass | Production/test lint |
| API `ruff format --check src tests` | Pass | Formatting |
| API `mypy src` | Pass /18 source files | Strict Python typing |
| `pnpm format:check` | Pass | Project TypeScript/TSX/CSS/script formatting |
| `pnpm build` | Pass; Next compile1703ms | Executor bundle and production frontend;117kB first-load JS excludes separate analytical runtimes |
| API `alembic current` | `0002 (head)` | Actual database; no new schema migration |
| `scripts/export-api-contracts.py --check` | Pass | Committed OpenAPI matches implemented routes |
| diagram skill `scripts/self_check.py` | Pass /four diagrams | Accessible SVG/static single-file contract |
| `node scripts/check-diagrams.mjs docs/diagrams/phase-3-*.html` | Pass /four diagrams | Geist loaded, no text outside canvas,390px local scrolling without page overflow |
| Local Markdown/file-link consistency and `git diff --check` | Pass | Final documentation consistency |

[PHASE_3_EVALUATION.json](PHASE_3_EVALUATION.json) records actual22 worker observations in61493ms: ten golden questions (eight VERIFIED, two correctly INCONCLUSIVE), twelve refused adverse fixtures, zero false VERIFIED adverse results, zero POSTs and zero IndexedDB databases. The 18/20 probe remains DISPUTED. Deliberately forged agreeing values remain VERIFIED/CLIENT_REPORTED, explicitly demonstrating the attestation limit. Expected values are hand-derived; they are not produced by the helper under test. Do not add fixture counts to test-wrapper counts or treat this as a stochastic model benchmark.

Observed Red→Green: new verifier/report/semantic-client tests failed before their implementations; wrong18/20 support and unsupported prose/citations were rejected. Reviews reproduced shallow contract freezing, forbidden-null diagnostics, empty/populated classification and scalar-only UI verdict; all gained fixes/regressions. Later reviews reproduced negative fractional percentages, report String coercion, an agreement-substring error and Pandas source/internal-helper collisions; these were fixed with exact regressions, including actual Pyodide cases. Browser consent locators were scoped after the new advanced checkbox.

A usage-limit interruption left an uncompleted browser run and stopped PostgreSQL. Its failed readiness tests were not passes; fixtures were restored and fresh services used. One unit run hit a5s harness timeout during genuine Pyodide initialization/calculation; the fixture budget became30s, consistent with the executor deadline, and the full suite passed. An intermediate browser run passed20 and failed2: an outdated empty/populated assertion and a mixed compiler bundle during rebuild. The assertion was corrected to the reviewed contradiction policy; stable rebuilt execution passed all22. No source changes occurred during the final stable run. Compiler source binding correctly refuses mixed builds rather than trusting mismatched artifacts.

## Mandatory learning and diagram gate

[PHASE_3_DEEP_DIVE.md](../learning/PHASE_3_DEEP_DIVE.md) is an approximately6000-word technical resource: before/after, SQL/Pandas/Python internals and alternatives, complete actual execution flow, exact algorithms/complexity/invariants, contract/tolerance/provenance, lineage/report support, correction, PostgreSQL/LangGraph recovery, resource/security/concurrency failures, actual tests, interview questions, two-/ten-minute explanations, practical exercises and prioritized study checklist. [SYSTEM_DESIGN_GUIDE.md](../SYSTEM_DESIGN_GUIDE.md) links the study sequence.

Implementation diagrams, linked from [ARCHITECTURE.md](../../ARCHITECTURE.md):

- [Verification components, independent computations and trust boundary](../diagrams/phase-3-verification.html).
- [Evidence lineage and claim support](../diagrams/phase-3-evidence.html).
- [Bounded correction and conditional routing](../diagrams/phase-3-correction.html).
- [Report validation/fallback/visualization](../diagrams/phase-3-reporting.html).

Rendering was inspected; connector masks were corrected to the skill's6–10px gap, unsupported legend entries removed, and actual font/bounds/narrow-scroll checks passed. The installed skill supplies self-check; its repository-only geometry helper is unavailable, so connector geometry was inspected directly. Screenshots/generated bundles remain uncommitted.

## Security, reliability and limitations

No raw-upload endpoint, automatic browser persistence, arbitrary execution surface, provider destination, secret store or infrastructure was added. Paired engines run serially on a credential-free origin under existing CSP/worker/time/size controls. Sources and lookup bytes stay local; metadata and aggregates still require consent and remain sensitive. Corrections preserve approved semantics and append bounded evidence. Cancellation and recovery use existing fenced ownership; report fallback adds no provider retry.

Remaining risks: CLIENT_REPORTED is not server attestation; correct computations can share a wrong business definition or dataset. Fixed-offset/exact-revenue/single-lookup scope is intentionally narrow. Conservative browser expansion estimates are not hard heap guarantees. Broader devices, hosted egress/retention/backups/global quotas, live provider compatibility and production-readiness remain unvalidated. No numerical/causal guarantee is inferred from charts or compilation. Save/Dexie/export/import/saved zero-inference bundles remain Phase4, not current memory-only replay.

## Commit ledger and next phase

Existing `main` only:

- T3.1: `9259104` — `feat(verification): validate exact metrics and bounded evidence corrections`.
- T3.2: `a42919f` — `feat(reports): ground numerical claims and render accessible evidence`.
- T3.3: `42dc291` — `test(verification): complete golden evaluation and phase 3 learning gates`.

This completion-ledger documentation update records the already-created task hashes without amending history.

No push, publish, deployment, PR, branch/worktree or paid inference occurred. Unrelated untracked `services/api/.env.example` was preserved and excluded.

Phase3 is complete. **Stop before Phase4.** Before later authorization, study content-addressed immutable snapshots, canonical manifest hashing, atomic IndexedDB/quota/delete transactions, runtime/compiler compatibility, immutable replay DAGs and zero-inference replay versus report playback versus AI re-investigation. Use the deep-dive exercises to explain why two engines can agree and still be wrong and why causal claims need more than numerical reconciliation.
