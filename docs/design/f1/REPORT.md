# F1 static design milestone report

> **REJECTED / SUPERSEDED — 13 October 2026:** The user rejected F1's visual direction. This document is retained as historical context, not approval or instructions for a new design. Prototype code, fonts, fixture, validator and screenshots were removed; see the [reset record](../F1_RESET_REPORT.md) and [current master-plan decision](../FRONTEND_EXPERIENCE_MASTER_PLAN.md). Old plain-CSS/token/milestone instructions below no longer govern future work.

Date: 13 October 2026. Scope: [written specification/plan](SCOPE_AND_PLAN.md) and [design decisions](DESIGN.md). This is the frontend F1 milestone, separate from analytical Phases1–5 and the blocked public release gate. F2 application integration is unstarted.

## Delivered

Six standalone compositions: landing/story, dataset/metric/optional AI consent, investigation progress, exact report/evidence/audit, saved/replay/fresh modes, and component/token samples. Plain CSS and shared custom properties preserve the authorized F1 styling approach. Local fonts and notices, synthetic source fixture, browser validator and review screenshots are included. Prototype navigation is interactive; computation/provider/storage actions are explicitly unavailable.

## Gate evidence

Final acceptance is pending the current validator and independent review. The final evidence files are [VALIDATION.json](VALIDATION.json) and [REVIEW.md](REVIEW.md). Run the validator with a loopback server rooted at this directory; it uses installed Chrome and task-owned browser contexts.

Checks cover 48 screen/theme/width combinations (six screens, two themes, four widths), five adverse state selections on each applicable composition, opaque text/action/outline contrast pairs, native disclosure, keyboard consent prerequisite and preview navigation, evidence links, reduced-motion zero timing tokens, forced-color focus, 720 CSS-pixel reflow and all six readable compositions without JavaScript. Capture six desktop/mobile review frames. No external page requests or JS exceptions are allowed.

The independent critic reproduced contradictory ready agreement/stage labels on adverse states during source review. They were corrected with context-specific state copy, withheld ready labels/findings, and disclosed synthetic disagreement/incompatible-currency evidence. Finding assessment now remains separate from numerical agreement and CLIENT_REPORTED provenance. Spacing/radii were normalized and initial setup captures retain unchecked consent. Browser QA also reproduced and fixed a citation-anchor navigation reset. Intermediate failed validator runs are not final passes.

## Limits and continuation

This is static-design evidence, not production integration or certification. Hand-derived synthetic USD1,250.00 across five records is not a newly executed engine result. No application/backend/worker behavior, dependencies, artifact contracts, consent storage or API routes changed. Application suites were not rerun for documentation-only artifacts. No physical mobile, Safari/Firefox, screen-reader audit, native browser zoom, field Web Vitals, hard heap measurement or actual-host CSP claim follows. Reflow uses CSS viewport equivalence; contrast checks cover opaque specified pairs, not every future state.

F2 must implement semantic controls/session ownership through a scoped production plan and meaningful behavior regressions. F1 fonts are full local TTFs; WOFF2/subsetting/font fallback shifts remain a production packaging task. Marketing WebGL/scroll motion is deferred to F6. Evaluate Tailwind only after F1 acceptance and document a conditional incremental path before F2; no migration in F1.

Local task commit is recorded in the master plan after this gate closes. No push/deployment/PR or public-phase advancement.
