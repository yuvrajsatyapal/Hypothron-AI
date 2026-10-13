# F1 design reset — scope, inventory and validation

Date: 13 October 2026. Authorized task: remove the rejected F1 static implementation, preserve the working application, update direction and stop before redesign implementation. Baseline: `320ca32b27e190ad2156b45ce9e7a7954265e0be`, existing `main`.

## Written scope and acceptance criteria

- Remove only positively identified F1 prototype code, unused assets, fixture, validator and screenshots. No blind revert or directory deletion.
- Preserve the master plan and historical design/report/review/validation records, explicitly marking them rejected or superseded.
- Preserve all original frontend, API, database, executor, contracts and tests; retain unrelated `apps/web/next-env.d.ts` and `services/api/.env.example` byte-for-byte.
- Record MeetStream as primary visual reference, optional 21st.dev/ThreeUI resources, Next.js 15/React 19, Tailwind v4, GSAP/ScrollTrigger and meaningful Three.js scenes as future decisions. Do not install or implement the redesign.
- Pass relevant type checks, units, production build, supported-origin original-app browser regressions, local documentation links and diff/ownership checks before a local commit. No push, deployment or paid services.

## Execution plan

1. Compare Git status, recent history, tracked source and dependency locks with the pre-design working baseline; inspect prototype imports and asset ownership.
2. Record this scoped inventory before changes. Remove each listed artifact explicitly; retain and label historical records, repair links to intentionally removed files.
3. Add a concise authoritative reset decision to the master plan; archive the old visual direction, token proposal, reference breadth and workspace-first milestone sequence while preserving valid engineering contracts.
4. Run checks, inspect the final diff and stage only owned documentation. Record fresh results here and make a conventional local commit on main, then stop.

## Inspection findings

`git log --all` contains no F1 implementation commit. The latest commit, `320ca32`, adds only the 648-line master plan. `git diff 85349a9 HEAD -- apps services packages tests scripts pnpm-lock.yaml package.json` is empty. All F1 implementation artifacts were untracked under `docs/design/f1/`; no Next.js route, React component, global application style or dependency was added by F1. No mixed original/F1 application file needs surgery.

The original App Router entry remains `apps/web/app/page.tsx`, with `layout.tsx` and `globals.css`; `Investigation`, `EvidenceReport`, `LocalHistory`, metric approval and domain libraries remain untouched. Frontend libraries handle memory-only source approval, exact local calculations, consented AI/API/SSE, report validation, explicit Save/history/bundles and zero-inference replay. Backend orchestration and isolated execution remain separate.

Tailwind v4/PostCSS configuration is absent from tracked manifests, lockfile and filesystem configuration. F1 uses isolated plain CSS. No prototype-only npm dependency exists to uninstall; existing Next.js/React/Dexie and test tooling are preserved, with locks unchanged. GSAP, ScrollTrigger, Three.js and Tailwind are future additions requiring a separately authorized implementation task. Global design skills are not application dependencies; this task neither uses nor uninstalls them.

## Exact removal inventory

The files below were untracked at inspection. They therefore cannot appear as tracked deletions in the commit; this before-removal inventory documents the filesystem cleanup. Inline authored SVG and six screen compositions are removed with `prototype.html`. Font license notices and manifest are removed together with their unused font files.

| Removed file | Bytes before removal | SHA256 before removal |
|---|---:|---|
| `docs/design/f1/assets/ibm-plex-mono-OFL.txt` | 4456 | `7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da` |
| `docs/design/f1/assets/ibm-plex-mono.ttf` | 135580 | `6a3412f058c7d8dfd9170c41e85ade48e5156ecb89356110ca57a0a27734af46` |
| `docs/design/f1/assets/manifest.json` | 523 | `c37097e4ff7d7839c38e5683aab7867ea2e9608edbd15f75398a4bc19025e1d6` |
| `docs/design/f1/assets/manrope-OFL.txt` | 4387 | `58172e0c0fac2cda8a37b348164bb55e44b0e69051e557e92b1d3f6910141f7b` |
| `docs/design/f1/assets/manrope.ttf` | 164700 | `3ae11c49db0455a3cc33e37d380f20fdb8c7f8b41dc07625c177e3d87a9d6ae6` |
| `docs/design/f1/prototype.css` | 14398 | `4ed1e3042f8fa342e50349dbf9aa88c9b13128ddba1e7ed418b2f15bd66b4290` |
| `docs/design/f1/prototype.html` | 39632 | `f20e671d16cfad095e4d976dafb5f5ebf0bb453f7d7f91c969e4b86da3c72448` |
| `docs/design/f1/prototype.js` | 5819 | `ff204171dfa44bad8a5e8acffe8018e04cc3c45d756e3de07f74ab93b927daeb` |
| `docs/design/f1/screenshots/landing-dark-1440.png` | 282780 | `ce5d095661fe21849c4acb3748dedaa4f3e07f2cd7982ce1ad993c5c58849c44` |
| `docs/design/f1/screenshots/landing-dark-390.png` | 232531 | `99b2e40c13857ac7f5a5732503b828ee3fce5dc704cd29d64c639e30c18404a5` |
| `docs/design/f1/screenshots/report-dark-1440.png` | 211543 | `0c4484a32584d8327d4fe4524c4dadc3cf3534d335ec7a70ac2ef35ce6b9bf7d` |
| `docs/design/f1/screenshots/report-dark-390.png` | 186312 | `78ca56479f843a3c595d1811ea2091ab57e7e409d62f49499a1d4cc362c24b60` |
| `docs/design/f1/screenshots/report-light-1440.png` | 211620 | `23d2bf65f71f2169941256ebbb05b098e2891c6dacd17f47994be68588f40960` |
| `docs/design/f1/screenshots/setup-light-390.png` | 180885 | `60ee2496319c6228309c7530083c84d0b6056ba03251396ed9067da44b340094` |
| `docs/design/f1/synthetic-revenue.csv` | 126 | `f43b38650d8e42dd0fb8082e269e0031341b740024ae3563058d2d394cb9ad68` |
| `docs/design/f1/tokens.css` | 1554 | `23a6efbdca1bb7ec4df612f7b0d01f83e236a79afbbf43d5d523eb683a579073` |
| `docs/design/f1/validate.mjs` | 10043 | `20133d19bb0c4721a9da157252b87821609bc8eefb9db69d05a7879d888449b3` |

## Preserved historical records

`docs/design/f1/DESIGN.md`, `SCOPE_AND_PLAN.md`, `REPORT.md` and `REVIEW.md` are retained with rejection/supersession notices. `VALIDATION.json` is retained unchanged as historical static QA evidence; those checks do not approve a rejected visual direction. The master plan remains intact below its authoritative reset decision. All phase reports, original .planning artifacts and application files remain preserved.

## Fresh validation

| Check | Fresh result |
|---|---|
| `pnpm test` | PASS: 113 tests / 19 files, 9.72s; includes 14 real Pyodide/Pandas cases |
| `pnpm typecheck` | PASS: strict web and executor TypeScript |
| `pnpm format:check` | PASS: all matched source/style/script files |
| `node scripts/verify-assets.mjs` | PASS: runtime asset identity/integrity |
| `pnpm build` | PASS: executor build and Next.js 15.5.27 production build; original `/` and `/_not-found` only |
| Existing production Chrome foundation/persistence/replay-bundles | PASS: 24 tests in 2.9min on production Next.js / installed Chrome; original test files unchanged |
| Original homepage / obsolete URL probes | PASS: `/` HTTP 200 with original calculation controls; `/f1`, `/prototype`, `/docs/design/f1/prototype.html` HTTP 404 |
| Documentation/removal checks | PASS: local Markdown targets in all six owned Markdown files exist; exactly 17 inventoried files absent, five historical F1 records retained |
| Ownership/lock checks | PASS: no app/domain/executor/API/database/contracts/tests/scripts/package/lock change; unrelated files preserved byte-for-byte; whitespace/diff checks pass |

The first sandboxed loopback HTTP probe was denied by filesystem/network sandbox permissions; the same read-only probe passed with authorized execution. This was not an application failure. Existing Personal_Portfolio on port 3000 was paused with explicit user authorization for production browser checks at the fixed supported origins. A task-only ignored Playwright config omits the unneeded API/DB service for these three suites; no production/test source, executor-origin policy or assertion is modified. All 24 checks passed. The task-owned test servers exited; Personal_Portfolio was restarted with its original `npm run dev` / Vite command on port 3000. The temporary ignored config was removed after use.

No full backend/database or AI integration suite is claimed for this documentation/static-artifact cleanup: those sources are unchanged. The selected browser checks validate real numerical execution, egress/bootstrap negatives, cancellation, responsive original layouts, explicit storage, bundle handling and zero-inference replay. Historical F1 visual QA is retained without re-running a deleted prototype. No unresolved application restoration blocker has been identified.

## Commit record

The local reset commit contains this report; retrieve its exact ID with `git log -1 --format=%H -- docs/design/F1_RESET_REPORT.md`. The final response will report that ID. No new landing-page implementation is authorized by this reset.
