# Stitch frontend redesign implementation report

Date: 2026-10-14. Scope: existing application frontend only. Source IDs and assets: [SOURCE_MAP.md](SOURCE_MAP.md). Written scope/plan/design reside in `.planning/`. Latest Stitch screens supersede historical visual specifications; old design docs remain intact.

## Implemented

- `/`: Stitch asymmetric Arctic hero, local synthetic analytical preview, navy five-stage investigation pipeline with visible SVG connections, alternating analytical sections, consent/privacy panels and real workspace CTAs. No fabricated benchmarks, causal models, cloud connectors, certified/signed proofs, unsupported statistics or fake product controls.
- Required sequence: Local Dataset + Schema + User Question → AI Hypotheses → Approved Calculations → DuckDB/Pyodide Comparison → Evidence Report.
- GSAP/ScrollTrigger: scoped hero reveals, scroll-scrubbed SVG path and stage progression; reduced-motion shows complete static content and cleans up media/timeline state.
- Lazy Three.js: 72 decorative points, capped1.5DPR, at most20renders/s, desktop and motion-enabled only; offscreen/hidden suspension, resize observer, scene/material/renderer disposal, media-generation fencing and blueprint fallback. No frame-by-frame React state or data access. SVG dash drawing intentionally repaints a single small path; other motion uses transform/opacity. Physical-device frame performance not measured.
- `/app`: actual existing workspace retained, compact Stitch navigation, truthful five-stage local progress, separate workspace palette, right inspector on desktop, stacked dataset-first mobile flow, useful honest empty state, readable navy compiled-source blocks and evidence tables. Historical restored evidence is explicitly historical. Existing state/handlers/API/executor/consent/Save/replay/report behavior preserved.
- Tailwind CSS4/PostCSS compilation; reusable Brand, WorkspaceChrome, SyntheticEvidence, InvestigationPipeline and route-local motion components; approximately108KiB self-hosted variable fonts with OFL licenses. Accessible text-role contrast corrections preserve decorative source colors.

## Preservation and changed files

Compared committed original workspace against current `/app`: only relative imports, visual header/main/section anchors, progress and empty-state JSX differ; all existing state, handlers, iframe and analytical integration remain. No backend, database, worker, provider, API, compiler or storage implementation was edited. All existing unit tests remain unchanged.

New/changed source: `apps/web/app/page.tsx`, `globals.css`, `fonts.css`, `app/{page.tsx,layout.tsx,workspace.css}`, `postcss.config.mjs`, `components/Brand.tsx`, `WorkspaceChrome.tsx`, `marketing/{SyntheticEvidence,InvestigationPipeline,LandingMotion,AmbientGraph}.tsx`; LocalHistory receives only an anchor ID. `apps/web/package.json` and `pnpm-lock.yaml` record added packages. Font assets are app assets, not generated executor runtimes.

Tests: `tests/e2e/stitch-redesign.spec.ts` covers widths375/768/1280/1440, required stages, synthetic labeling, navigation, reduced motion, page overflow, no implicit storage, real SVG scroll progression and workspace animation isolation. The previously untracked landing-cleanup root-redirect assertion is adapted into a workspace-isolation regression because this request intentionally restores a landing at `/`. Existing analytical test `/app` routing changes from the preexisting cleanup are retained as necessary integration changes.

Prior unrelated dirty docs, evaluation artifacts, cinematic assets and `.env.example` are excluded from task commits. Related preexisting `/app` routing/analytical test moves are included so the committed redesign is self-contained. Test-generated evaluation measurements are not treated as source changes or new product claims.

## Validation

RED:375px acceptance failed on the original root redirect (`Inspect the evidence.` instead of landing heading). First GREEN:4 responsive acceptance tests passed. Existing113units/19files, strict TypeScript/executor check and Next production build passed. Prettier and git whitespace checks passed. Broad production browser regression and final visual-refinement checks are recorded below after completion.

Independent dual-agent Design Gate: initial contrast/SVG/progress findings corrected; final ACCEPT. Reviewer verified muted-on-violet4.71:1 contrast and current/historical progress. Actual desktop/mobile landing, pipeline and workspace screenshots inspected; no clipping in tested viewports. This is a scoped visual and functional review, not a universal accessibility or device-performance certification.

## Boundaries

Provider HTTP is mocked in browser integration; numerical runtimes/API/LangGraph/PostgreSQL are real. No paid/live inference, push, PR, publication or deployment. Existing Hypothron test database on55433 was restarted; unrelated containers/services remain untouched. This task does not change phase status or complete public-release gates. Synthetic demo is hand-derived, not a running investigation. Metadata/aggregate sensitivity, client-reported verification, unencrypted explicit local Save and existing runtime/device limitations remain visible.

### Final commands and results

- `pnpm test`:113/113 tests in19files pass; includes14real Pyodide verification tests.
- `pnpm typecheck`:web strict TypeScript and executor TypeScript pass.
- `pnpm format:check`, targeted Prettier for new browser specs and `git diff --check`:pass. No standalone ESLint script/config is present; Next build performs its configured validation.
- `pnpm build`:executor build and final Next15 production build pass. Reported initial shared/load JS:landing108kB; workspace165kB. Optional asynchronous Three/GSAP chunks are separate and not included in that initial-size figure.
- Broad production run:all39existing functional tests and4responsive landing tests pass. One new motion assertion initially failed because a horizontal SVG path has a zero-height geometric bounding box; assertion corrected to inspect its visible SVG and actual geometry/progression.
- After visual refinements,13focused production checks ran:7existing numerical/responsive/API workflow checks and5new redesign checks pass; the workspace-isolation check exposed real Next Link prefetch of landing client code. Brand home-link prefetch disabled rather than weakening isolation. No animation resource executes or preloads on an initial workspace visit.
- Final latest production build:all6redesign/isolation tests pass in9.2s (375/768/1280/1440, SVG node alignment within3px, scroll progress, reduced-motion static view, no IndexedDB, no console page errors, navigation and no landing-motion chunks on workspace).
- Desktop/mobile screenshots inspected after final layout refinements. Design Gate ACCEPT; contrast4.71:1 for the previously failing small text role. Physical-device frame rates and a comprehensive assistive-technology audit remain unmeasured.

The passing39functional regression cases and6redesign/isolation cases cover45distinct browser cases across the broad and focused runs. They are not represented as a single45-case run on one final artifact. No backend test rerun is claimed; no backend implementation changed.

## Local task commit

Implementation and tested routing integration: `1205a0cf7a57c917a1e39eea91b702212a251b14` (`feat(web): implement Stitch landing and investigation studio design`), existing main only. A subsequent documentation-only commit records this hash; neither commit was pushed.
