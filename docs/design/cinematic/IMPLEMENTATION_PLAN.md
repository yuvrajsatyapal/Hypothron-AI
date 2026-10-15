# Implementation plan

> **REJECTED / SUPERSEDED — 14 October 2026:** The user rejected the landing direction and requested a UI restart. Its marketing code, animation dependencies and screenshots have been removed. This document preserves implementation history only; it is not an active specification or permission to redesign. The working analytical UI remains intact at `/app`. See [cleanup record](../UI_CLEANUP_REPORT.md).

1. Record scope/design and reference findings. Add failing route/privacy/fallback browser acceptance tests before application behavior changes.
2. Install pinned Three, GSAP and Tailwind v4 with pnpm. Move existing state-owning page to `/app`; isolate root/route styles and preserve workspace code verbatim except import paths. Update existing browser destinations to `/app`, preserving assertions.
3. Build static semantic marketing sections and procedural SVG fallback. Implement the bounded lazy Three lens with disposal and reduced-motion handling. Add scoped GSAP ScrollTrigger orchestration and native six-beat navigation.
4. Run design gate with an independent design critic. Start real browser checks, inspect desktop/mobile heroes, full pages, intermediate states, reduced motion, WebGL denial and workspace. Refine the design after inspection.
5. Validate units/types/format/production and original integration flows with zero live inference. Review route bundle privacy and GPU lifecycle, resolve findings, document actual evidence and limitations. Run independent engineering review.
6. Update file map, usage/reset authority and task report, then conventional local commit on existing main. No push/deployment or backend edits.
