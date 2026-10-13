# F1 — Evidence Observatory design system and static prototypes

> **REJECTED / SUPERSEDED — 13 October 2026:** The user rejected F1's visual direction. This document is retained as historical context, not approval or instructions for a new design. Prototype code, fonts, fixture, validator and screenshots were removed; see the [reset record](../F1_RESET_REPORT.md) and [current master-plan decision](../FRONTEND_EXPERIENCE_MASTER_PLAN.md). Old plain-CSS/token/milestone instructions below no longer govern future work.

Authorized 13 October 2026 by the user's instruction to begin F1 from the proposed direction. This implements the static design stage of the [master plan](../FRONTEND_EXPERIENCE_MASTER_PLAN.md), not F2 routes or application behavior.

## Scope and acceptance

Use plain CSS and custom properties throughout F1. No Tailwind migration or dependency changes. Establish shared light/dark colors, typography, spacing, radii, outlines and motion tokens. Produce representative landing/story, setup/consent, progress, exact report/evidence, and history/replay compositions. Include empty, loading, error, disputed and inconclusive treatments. All displayed data is synthetic; prototype actions never compute, persist, import files or invoke a provider. Trust vocabulary preserves local agreement and CLIENT_REPORTED provenance.

Acceptance requires local fonts with license notices; distinct marketing/application compositions; native keyboard navigation and disclosures; readable consent and exact values; theme switching; no viewport overflow at 375/390/768/1440; reduced-motion, reflow and forced-color checks. Design review is separate from production acceptance. No claim of implemented routes, physical-mobile support, screen-reader certification, field performance or public release follows.

## Implementation plan

1. Write this scope before prototype code. Use the master plan's selected direction and token palette; document decisions in DESIGN.md.
2. Build tokens and basic controls, then screen compositions in an isolated static HTML/CSS/JS surface. Use local font assets; retain notices and source hashes. Never import application data, executor or persistence libraries.
3. Run actual-browser layout/font/interaction checks across themes, views and widths. Capture desktop/mobile screenshots, inspect them visually, calculate opaque contrast pairs, exercise keyboard/zoom/reduced motion/forced colors and disabled-JavaScript reading.
4. Run the Spartan Design Gate with the builder and independent design-critic; address findings before accepting F1. Save evidence and limitations in REPORT.md.
5. Commit the tested F1 artifacts on existing main. Then evaluate official Tailwind v4/Next15 guidance against installed locks, styles and browser target. Record the final conditional adoption decision and incremental strategy in the master plan; no migration or F2 production code in this task.

Documentation and static prototype validation replace artificial application tests. Future changed application behavior still requires meaningful red → green tests and the project regression gates.
