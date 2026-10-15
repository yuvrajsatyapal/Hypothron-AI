# Rejected landing cleanup

14 October 2026. The user stopped the cinematic redesign and authorized removal of rejected landing/frontend work, while preserving the existing `/app` analytical application completely. No replacement design, backend work, push or deployment is authorized.

## Scope and acceptance

- Keep `/app/page.tsx`, `/app/layout.tsx`, `/app/workspace.css`, analytical components/libraries, dataset workers, API/LangGraph, verification, history and replay unchanged.
- Replace only the rejected root landing with a server redirect to `/app`; retain the neutral root layout/global reset and existing `/app` browser-test destinations.
- Remove exclusively marketing components, stylesheet, icon, animation tests, synthetic visual screenshots, temporary capture scripts, abandoned new UI spec/plan and unused Three/GSAP/Tailwind/PostCSS dependencies after verifying import ownership.
- Preserve architecture, security, all phase reports/learning/diagrams and implemented workspace design/history. Retain historical F1/lens design records with clear rejection notices; the master plan records the latest stop decision.
- Validate fresh TypeScript, formatting, unit tests, production build, redirect/bundle isolation and real browser numerical/graph/verification/persistence/replay regressions. Preserve unrelated environment/evaluation edits. Local main commit only after validation.

## Ownership inspection and execution plan

1. Snapshot hashes of `/app`, analytical domain/executor/backend/contracts and historical reports/learning. Inventory every removed file by path, length and SHA256 before deleting.
2. Searches found Three/GSAP imports only in marketing components; Tailwind only in `marketing.css` and its PostCSS plugin. Workspace uses its own ordinary CSS; no analytical dependency needs those packages.
3. Add a failing root-redirect/browser-resource regression; remove explicitly inventoried artifacts, replace root with redirect, prune package manifests/lock without upgrading retained packages.
4. Mark historical documents rejected, update status links and run static/unit/build/browser checks. Verify preserved hashes and Git ownership before a local commit.

## Removed artifact groups

The exact pre-removal inventory is [UI_CLEANUP_INVENTORY.json](UI_CLEANUP_INVENTORY.json). 72 files: nine marketing component/scene files, marketing CSS/icon/PostCSS, two marketing tests, lens/atlas visual screenshots and first-pass JSON, abandoned atlas spec/plan, and ignored marketing capture scripts/results. Empty artifact directories are removed only after their listed files. No broad Git reset or directory wipe.

Retained documents: `FRONTEND_EXPERIENCE_MASTER_PLAN.md`, `F1_RESET_REPORT.md`, `f1/{DESIGN,SCOPE_AND_PLAN,REPORT,REVIEW}.md`/historical validation, `cinematic/{SCOPE_AND_DESIGN,IMPLEMENTATION_PLAN}.md`, all implemented `.planning/design` and phase spec/plan records. These have either existing or new rejection notices where appropriate. They preserve decisions and failure history without authorizing another redesign.

## Validation

| Check | Fresh result |
|---|---|
| Redirect regression RED | Expected failure: rejected landing remained at `/`; observed before removal |
| `pnpm typecheck` | PASS: strict web/executor TypeScript |
| `pnpm format:check` | PASS: all matched source/style/script files |
| `pnpm test` | PASS: 113 tests / 19 files, 3.99s, including 14 real Pyodide/Pandas cases |
| `pnpm build` | PASS: executor and Next.js 15.5.27 production build; `/` redirect and `/app` |
| `node scripts/verify-assets.mjs` | PASS: pinned analytical runtime integrity |
| Documentation links | PASS: local links in the four cleanup-owned design Markdown files |
| Removal/dependency check | PASS: all 72 inventoried files absent; all five marketing-only package links removed; manifests and lock retain exact pre-landing dependency versions |
| Production browser regressions | Running; result recorded below when complete |

The offline dependency reinstall initially lacked a cache entry; a frozen-lockfile reinstall completed without upgrading retained packages. pnpm emitted a missing `arrow2csv` helper-bin warning; that CLI is not used by the application. The full build and real analytical worker checks validate the application's runtime paths.

The first browser-suite attempt stopped before tests because Docker/API readiness was unavailable. Docker and only the existing `hypothron-phase5-db` container were started on port55433; unrelated containers were left stopped. The rerun uses real PostgreSQL/FastAPI/LangGraph/DuckDB/Pyodide and mocks only external provider HTTP. No live inference, schema change or paid resource. The identified Hypothron production server was refreshed on3000; no unrelated server was stopped.

The existing working app remains at `/app`; `/` is a convenience redirect, not a new UI. No public-release readiness claim follows.
