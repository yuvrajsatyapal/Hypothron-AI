# Interactivity implementation and functional audit

2026-10-14 · existing main · local only. Scope and acceptance: [SPEC_PLAN.md](SPEC_PLAN.md). Latest connected Stitch landing screen was inspected; its existing type, palette, section order and split hero are preserved. [Meetstream](https://meetstream.ai/) informed the input/output interaction pattern. No historical DESIGN.md governs this work.

## Delivered behavior

The five-card timeline is now a reusable React investigation graph. Local dataset, schema and question converge on hypotheses; approved calculations branch into DuckDB-WASM and Pyodide, converge on an exact comparison, then connect to the report. Nine measured curved SVG edges draw and carry signals on one reversible GSAP timeline. Cards retain readable text while their position and emphasis progress. Gradient coordinates use user-space units so straight vertical/horizontal connections also render correctly.

Desktop pinning is conditional on the measured graph plus sticky header fitting the viewport. Height-only resizing, content/disclosure resizing and header changes recalculate geometry and eligibility. Short desktops, tablets and touch layouts scroll normally; mobile retains connected inputs and parallel engines. Reduced motion shows final static content without pinning, scrub, float or parallax. Server-rendered curves plus mobile direction indicators preserve readable order without JavaScript.

The existing hero has staggered entrances, a gently floating layered preview, bounded desktop fine-pointer parallax, chart transitions, result movement and CTA feedback. Product showcases progressively move into view, draw the hypothesis branch and reveal bundle rows. Text-bearing light containers stay fully opaque throughout scrub to retain contrast. Motion pauses offscreen/when the document is hidden and is removed through scoped GSAP contexts/matchMedia and observer/listener cleanup. The generic rotating WebGL point-field invocation is removed; no new WebGL scene is necessary for this graph.

Native disclosures explain calculation approval, disputed results and report provenance. Mobile section navigation is now available and closes after anchor selection. Landing examples remain labeled synthetic and hand-derived; none starts a real computation, provider request or Save. The actual workspace uses its original application logic.

## Functional audit

| Area | Result |
|---|---|
| Header/footer links, investigation CTAs | Existing destinations retained; tested /app navigation and home return |
| Section anchors | Pipeline, evidence and privacy targets retained; mobile navigation added |
| Dataset selection/validation | Actual CSV acquisition, invalid replacement, exact Parquet conversion/refusals and cancellation exercised |
| Hypotheses/approval/API integration | Existing metadata consent, metric approval, clarification and conditional investigation tested against real API/LangGraph/PostgreSQL; only external provider HTTP mocked |
| Local execution/comparison | Genuine DuckDB/Pyodide, exact values, disputed/inconclusive populations, cancellation and execution-channel refusals exercised |
| Reports/history/replay | Existing evidence-backed report and Save/history/storage semantics retained; bundle/replay validation recorded below |
| Privacy/resource isolation | No implicit IndexedDB in landing/unsaved workspace; landing GSAP/WebGL code not loaded by direct workspace entry |

No disconnected backend/workspace action was found in the exercised flows. No application behavior, API, schema, runtime lock or database code was replaced. Changes restore missing marketing interactions rather than fabricate workspace capabilities.

## Validation record

- RED baseline: new scroll acceptance failed because the previous page had zero of the nine graph connections.
- `pnpm test`:113 tests across19 files passed, including14 real Pyodide unit cases.
- `pnpm typecheck`: web and executor passed. `pnpm format:check` and `git diff --check`: passed. Production `pnpm build`: passed; landing111kB first-load JS and workspace165kB unchanged from this task's earlier build. No standalone ESLint script is configured; report format/type/build checks rather than invent an ESLint pass.
- Final landing production browser suite:14 passed. Covers forward/reverse scroll, parallax, media toggle cleanup, same-width height resizing, short desktop, touch navigation, native details, no-JavaScript readability, reduced-motion375/768/1280/1440 layouts, route isolation and clean console.
- Existing functional production browser cases:18 foundation cases plus1 real API investigation passed. These include numerical correctness, genuine replay, privacy/no-upload, disabled/invalid controls, cancellation, execution-origin egress, contradiction and inconclusive cases. Later edits are confined to marketing motion.
- Saved-history/Parquet/bundle group:10 passed in2.1minutes:3 persistence/storage cases,4 Parquet cases and3 real bundle/replay cases. Covers export/import confirmation/idempotence, zero-inference replay, cancellation/retry, forged historical agreement and changed snapshot detection. Across the documented runs,43 unique relevant browser cases passed.
- Independent design/code gate: ACCEPT after fixing viewport pin fit, height-only resize invalidation, hero selector wiring, static fallback and text contrast. Reviewer independently confirmed1440×1000 pins the814px graph;1440×850/820 removes pinning; reduced motion leaves zero pin spacers.
- Final screenshot capture recorded progress0.043→0.477→1.000→0.043 and zero page errors. Static full-page screenshots use reduced motion; motion screenshots show actual normal-motion states.

## Before/after evidence

| View | Before | After |
|---|---|---|
| Desktop overview | [Before](screenshots/before-desktop.png) | [After](screenshots/after-desktop.png) |
| Pipeline | [Five-card timeline](screenshots/before-pipeline.png) | [Connected static graph](screenshots/after-pipeline-static.png) |
| Mobile | [Before390px](screenshots/before-mobile.png) | [After390px](screenshots/after-390.png) |
| Tablet | — | [After768px](screenshots/after-768.png) |

Motion states: [hero](screenshots/after-hero-desktop.png), [inputs](screenshots/after-pipeline-inputs.png), [branching signals](screenshots/after-pipeline-branches.png), [evidence report](screenshots/after-pipeline-report.png), [reverse](screenshots/after-pipeline-reverse.png).

## Limits and handoff

Browser evidence is installed Chrome/macOS with emulated tablet/touch/mobile sizes, not physical-device or Safari/Firefox certification. No live provider requests, external deployment, push, publishing, paid resource or backend/database change. Public-release gates remain as recorded in CURRENT_PHASE.md. Existing unrelated source/document edits and newly appearing unowned artifacts remain unstaged. Local tested-task commit identity is recorded in the final response/Git history.
