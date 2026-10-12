# Phase 4.5 — GitHub Actions CI

Date: 2026-10-12. Local implementation and required validation complete; hosted GitHub execution unverified. Scope supersedes the Phase4 stop only for CI. Phases1–4 remain complete for the local ADR015 target; Phase5 remains unstarted. See [spec](../../.planning/specs/phase-4-5-ci.md), [plan](../../.planning/plans/phase-4-5-ci.md), [CI guide](../CI_CD.md) and [deep dive](../learning/PHASE_4_5_CI_DEEP_DIVE.md).

## Implementation and workflow

One workflow: `.github/workflows/ci.yml`. Push-main, PR-main, workflow_dispatch; no deployment. Static/backend/frontend are independent; full browser integration depends on all three.

| Job | Responsibility | Timeout |
|---|---|---|
| static | actionlint/schema/action references, shellcheck, Ruff lint/format, strict configured Mypy, OpenAPI export drift, four guard subprocess tests | 10min |
| backend | fresh PostgreSQL17, target/readiness refusal, Alembic up/down/up, complete pytest, head/table/column/nullability checks, caught-network audit | 15min |
| frontend | frozen pnpm install, committed runtime integrity, units/strict types/format/production build, generated-contract/lock consistency | 15min |
| browser | own DB, locked Chromium/Linux dependencies, bootstrap/build, port refusal, production Next/executor/test-only API, guard negative proof and all genuine browser tests | 30min |

Toolchains: Ubuntu24.04 x64 fast gates / ubuntu-24.04-arm browser; Node22.22.3/pnpm10.33.0; Python3.12.15/uv0.13.0; locked Playwright1.64.0 / measured Chromium156.0.8078.4; Next15.5.27; DuckDB-WASM1.32.0/Pyodide0.29.3. PostgreSQL17 Alpine digest `b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`. actionlint1.7.12 SHA-checked before extraction. All four actions pinned to official verified commit SHAs: checkout7.0.1 `3d3c42e5aac5ba805825da76410c181273ba90b1`, setup-node7.1.0 `949feb2413d6458794dcd2491c4babbbce0c15c1`, setup-uv10.3.0 `1c37ad07a6a961277cf70c0d37d6f313000f5884`, pnpm/action-setup6.1.0 `ea17c68df8912ef543352723c149a84f56e3d413`. Official action.yml inputs and Node24 runtime declarations verified; Actions Node24 is distinct from appNode22.

The initial local x64 Linux reproduction uses official Playwright Noble image digest `06a9939e57531807f8d5fd76ce44b53165ffb7d7501d87ab10e285c20b1e971f`, linux/amd64 under Docker emulation on macOSarm64. Node/uv were replaced with the exact checksum-pinned project versions. No host ports published; the test runner shares only its own disposable DB network namespace. The full browser attempt was stopped after a41.7s UI assertion failure: unchanged35s app execution deadline exceeded during emulation. Direct genuine engine test passed in2.8min. This is a failed/partial x64 browser run, never a passing target. The final helper/browser job use native Linuxarm64 with independently verified Node/uv/actionlint arm64 digests; native complete-suite results follow below. No unrelated services/databases were stopped or mutated. Existing ports3000/3001/5432/55432/55433 were preserved. This target is separate from the prior Chrome154/macOS acceptance record.

## Commands and evidence

| Actual command / environment | Result | Scope |
|---|---|---|
| `pnpm exec vitest run scripts/tests/assets.test.ts` before implementation | RED: 1pass/1fail; missing verifyManifest | Immutable manifest drift test |
| Same command after implementation | 2pass | Source-byte tamper and missing/changed manifest refusal |
| `services/api/.venv/bin/python scripts/ci/test_network_guard.py` | 4pass, local pinned Python and Linux | Refused DNS/directIP/connect_ex/UDP, audit, loopback, missing audit path |
| `pnpm test` local / Linux | 99pass/15files | Includes real Pyodide/Pandas unit calculations |
| `pnpm typecheck`, root format and explicit Playwright/test formatting | Pass local and Linux | Strict app/executor types and all changed JS/TS |
| Verified actionlint1.7.12, `shellcheck scripts/ci/*.sh` | Pass Linux; actionlint also passes macOS | YAML/schema/action inputs and embedded shell; no shellcheck suppressions |
| `bash scripts/ci/static.sh` Linux, rerun after explicit Mypy fix | Pass; Ruff35files; strict Mypy18files; OpenAPI match;4probes | Local Linux gate, not Actions execution |
| `bash scripts/ci/backend.sh` Linux | 93pass in17.01s x64 emulation /2.80s native arm64; migrations up/down/up; single head/schema checks pass | Genuine disposable PostgreSQL and LangGraph native saver |
| `bash scripts/ci/frontend.sh` Linux | 99pass in56.97s x64 /10.20s native arm64; production build pass (compile24.1s x64 /4.4s arm64);12asset hashes; drift checks clean | Local container timing, not hosted benchmark |
| `pnpm exec playwright install --with-deps chromium` Linux | Pass x64 and native arm64 | Actual Linux dependency installation; locked browser |
| `bash scripts/ci/browser.sh` Linux | x64 startup/active guard probe/direct engine pass; UI execution deadline failure; run stopped. Native arm64 complete: 32pass in8.7min, gate exit0, audit/drift clean | Production startup, fixture/DB, real engines and no-emulation test assertions |
| Port/DB target negative checks, local | `CI_PORT_OCCUPIED_3000` and `CI_DATABASE_TARGET_REFUSED` as expected | No existing process/DB changed |
| Diagram installed skill self-check + `node scripts/check-diagrams.mjs docs/diagrams/phase-4-5-ci.html` | Pass; realChrome fonts loaded, no text overflow, narrow local scroll | One static architecture HTML; exact connector geometry inspected |
| Local Markdown links / `git diff --check` | Pass across changed root/docs files; final recheck before commit (15Markdown files, zero missing targets) | No remote publishing |

Initial container setup failed because the official image omitted xz extraction support; local reproduction now installs xz-utils before unpacking Node. Local macOS checksum tooling exposed nonportable sha256sum flags; actionlint verification now uses Python SHA256. Final compatibility review also replaced older action pins after verifying official Node20 retirement and current Node24 metadata. These failures were corrected, not relabeled as successful validation. Test assertions and the35s application deadline were not weakened. Standard ARM hosted-runner availability was verified in official GitHub documentation/changelog; the browser job now selects ubuntu-24.04-arm. CI evaluation writes ignored Linux output rather than rewriting historical Phase3 macOS observations.

The complete native suite used one disposable service serially after backend tests. Hosted backend/browser jobs each own a separate fresh service. The reproduction helper now performs a guarded, target-validated downgrade before browser upgrade to match that boundary. A separate focused integration run started with a new empty PostgreSQL service (no backend tests or seeded state): same guarded browser gate with `pnpm exec playwright test tests/e2e/investigation.spec.ts`; 1pass in1.1min (test57.3s), exit0, fixture readiness/real API/LangGraph/DB/engines and negative provider probe pass; network audit and generated-source drift clean. Both native reproduction environments were removed by their own cleanup traps. Final helper shellcheck passes on Linux.

## Security review and controls

Independent Gate3.5 engineering/security review: workflow/script code-clear after one must-fix strict Mypy discovery issue. Root Mypy otherwise ignores nested `strict=true`; explicit backend config now passes18sourcefiles on local and Linux. Complete native browser and separate fresh-DB evidence pass. Final independent Gate3.5 verdict: **ACCEPT**. Review covers workflow permissions/triggers, secret handling, dependency/runtime integrity, database/browser isolation, provider refusal, reproducibility, timeouts/resource use, diagnostics and documentation accuracy. No outstanding engineering/security findings.

Read-only contents, nonpersisted checkout credential, normal PR trigger, no production/provider secrets, no OIDC/deployment authority, frozen installation, SHA action/tool/image pins and verified runtime manifest. Only package-download caches; no raw data, browser artifacts or mutable DB volumes. Job cancellation and finite timeouts; one browser worker/zero retries; no `pull_request_target`, publishing or automatic generated-source push.

Real provider wire is MockTransport; active Python refusal plus audit catches swallowed network errors. Browser context request audit/abort includes automatic negative proof even when a priority route fulfills mock content. Traces/screenshots/video off; no artifact upload. Native-extension/hostile-code/browser-internal bypass limitations are documented. Compute worker CSP/privacy/zero-inference replay tests remain mandatory, not replaced by this guard.

## Learning and diagrams

[Comprehensive deep dive](../learning/PHASE_4_5_CI_DEEP_DIVE.md) covers CI versus deployment, actual workflow/runner/service lifecycle, layered reproducibility, native saver migrations, real browser execution, mocked HTTP/refusal, caches/artifacts/concurrency/security, file flow, detailed interview answers and prioritized exercises. [Architecture diagram](../diagrams/phase-4-5-ci.html) shows parallel gates feeding isolated integration. Existing provisional project style reused; no UI branding change. Installed self-check/real Chrome geometry/font/narrow-scroll validation pass. Repository-only geometry/skin linters are unavailable in the installed skill; connectors/masks manually checked.

## Commits and remaining boundary

- T4.5.1: `f60dd25c2567154e82fb63a24188569c4271af40` — test harness integrity and active network refusal, scoped spec/plan.
- T4.5.2: `0c986a542659392b11a13c0d27f4114b8f6d6ab3` — isolated pinned workflows/gates, complete native Linux validation.
- T4.5.3: documentation/validated diagram/final ACCEPT completion commit; its hash is available from local Git history and the final response (a commit cannot include its own final hash).

No push, PR, release, paid inference or deployment occurred. Hosted workflow status: **not executed; awaiting authorized push and actual GitHub run**. Actions setup/cache/merge-ref/service behavior cannot be claimed verified from local Linux gates. CI timeout/resource budgets are configured, not measured hosted costs. Product support remains ADR015 local desktop; Linux CI does not expand release support or attest client numerical honesty. Phase5 must not start as a consequence of this work.
