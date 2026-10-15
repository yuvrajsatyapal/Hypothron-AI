# Cinematic landing — implementation contract

> **REJECTED / SUPERSEDED — 14 October 2026:** The user rejected the landing direction and requested a UI restart. Its marketing code, animation dependencies and screenshots have been removed. This document preserves implementation history only; it is not an active specification or permission to redesign. The working analytical UI remains intact at `/app`. See [cleanup record](../UI_CLEANUP_REPORT.md).

14 October 2026. The user's implementation brief supersedes the reset's stop-before-implementation decision. This is one landing page, with the original analytical application relocated to `/app`. No analytical phase advancement, backend changes, live inference or public deployment.

## Direction

**The Evidence Lens.** A precision optical instrument, constructed from metallic concentric apertures, illuminated striations and a luminous core. Structured data fragments move into its aperture; two separated arcs express independent computation; the aperture opens into inspectable evidence. This is original procedural geometry, not the rejected F1 observatory/node composition. Near-black graphite, acid citron, silver and warm paper replace the rejected palette. Oversized restrained sans typography paired with occasional editorial italic serif; fine monospace captions. No external fonts or assets are required.

MeetStream was inspected in a real browser at desktop and mobile sizes: large atmospheric hero, foreground/background depth, generous whitespace, product illustrations held beside advancing text. Borrow only the level of composition and continuity. No reference imagery, code, text or layout is reused. Its mobile resize showed an inconsistent intermediate scaled layout; our mobile story will use its own explicit composition.

## Screen and motion

Navigation / asymmetric hero with original 3D lens / short editorial explanation / six-beat sticky investigation story / independent-calculation comparison / paper report preview / privacy and replay / closing CTA and footer. The six beats are Data, Question, Hypotheses, Calculation, Verification, Report. All text is semantic HTML, readable without JS/WebGL. Story rail remains accessible and can navigate to each beat using native anchors. Browser scroll remains native, reversible and untrapped.

The hero instrument gradually rotates and opens as the hero scrolls away. A second, visibility-loaded instance reuses the same scene implementation for the story; its geometry morphs with section progress. Only intersecting scenes render, at at most 30fps and pixel ratio 1.5 (mobile 1.25), without shadows, postprocessing or remote textures. Reduced motion uses the original static SVG lens and fully readable sequential text; no GSAP/Three download. WebGL initialization/context loss falls back to SVG. Resize, intersection, visibility and media listeners, RAF, GPU resources and GSAP contexts are disposed.

## Routing and privacy

Root layout is neutral. Marketing has a route-specific Tailwind v4 stylesheet, GSAP controller and lazy Three module. Workspace uses its existing stylesheet and unchanged state-owning component at `/app`; update only relative imports after moving. Marketing links to `/app` use ordinary anchors, preventing workspace prefetch and accidental worker initialization. Workspace has no marketing imports or navigation that silently destroys unsaved state. Existing origin, sandbox, credentials, workers, database, contracts and numerical semantics are untouched.

## Copy and synthetic demonstration

Explain hypothesis-led analysis, separate SQL/Python arithmetic and evidence references. The report demonstrates the existing five-row golden CSV: 10.10 + 20.20 + 0.03 within Q3 = USD30.33, three included rows; fourth row excluded at the half-open endpoint and fifth row missing revenue. Label synthetic example, CLIENT_REPORTED local agreement, no causality or server-attestation claim. Replay requires explicitly saved snapshots and compatible runtimes, and makes zero new model requests. Raw data stays local by default; optional AI requires consent to share approved metadata and aggregates. Save is explicit, local, unencrypted and browser-evictable.

## Acceptance

- `/` includes both hero CTAs and the complete story; `/app` preserves original controls and real engine behavior.
- No marketing workers, API/provider requests or IndexedDB; no Three/GSAP downloaded on direct workspace load.
- Real WebGL draws, progress changes geometry and scrolling backward restores prior states.
- 1440px desktop and 390px mobile, full-page and intermediate screenshots personally reviewed; at least one recorded visual refinement.
- Reduced-motion and denied WebGL keep equivalent readable content and working navigation; keyboard focus, 200% reflow and no horizontal overflow.
- Strict TypeScript, format/lint if available, all existing units, production build and appropriate existing workspace browser suites pass.
- Local main commit contains only task-owned changes, plus validation report and exact known limits. Preserve unrelated next-env and env-example edits.

## Final tokens and state contract (Design Gate resolution)

Route-scoped tokens: ink `#0b0e0c`, cream `#eeeee4`, citron `#dfff91`, silver/body `#a9b1a4`, quiet `#7c8775`, rule `#2c342c`; paper `#e4e5d9` with text `#1e271a` and secondary `#59634f`. Display/UI: Arial, Helvetica, sans-serif. Editorial accent: Georgia, Times New Roman, serif italic. Technical labels: SFMono-Regular, Consolas, Liberation Mono. Display range48–104px, section44–72px, body13–15px/1.75–1.8; tiny scene labels are decorative only. Section spacing80–144px, desktop gutters64px, mobile24px; CTA radius2px, min48px. Links and actions have visible2px citron focus with6px offset (dark green on paper). New tokens apply exclusively to marketing and do not restyle the workspace.

Story state details: Data shows three structured source rows alongside an intact instrument; Question emphasizes the approved period/currency/definition; Hypotheses reveals three testable checks as rings separate in depth; Calculation alternates ring offsets into two paths with a paired SQL/Python readout; Verification brings exact-match status forward and dims the instrument; Report resolves fragments toward a rectangular matrix and overlays an ivory evidence sheet, then leads directly to the complete always-readable HTML report. Reverse scroll selects the preceding state. Static/reduced-motion keeps the SVG illustration and all six HTML explanations, calculation table and report without animation gates.

Mobile uses a dedicated compact300px sticky stage with illustration on the left and readout on the right, above the advancing text; its rail is keyboard accessible and anchors clear the stage. Tablet has its own bounded hero type/scene composition. 768px review,200% reflow,44px targets, context-loss fallback and media-preference changes are browser acceptance checks. The initial screenshot review led to a shorter mobile hero, a raised fully framed lens, a single-line tablet accent headline, active per-step ScrollTriggers and cross-faded readouts.
