# Stitch redesign implementation plan

Goal: implement latest Stitch appearance on the existing Next.js application.
Architecture: shared Tailwind4 tokens and local fonts; route-local marketing effects; existing client workspace state and analytical modules reused without changing APIs or computation. Tech: React19, Next15, Tailwind4, GSAP3, Three.js.

1. Write browser acceptance tests for landing links, required pipeline, responsive/reduced-motion/no-storage and workspace controls. Run before implementation and observe missing landing failure.
2. Add PostCSS/Tailwind tokens/local fonts. Implement shared Brand and icons, static synthetic revenue visualization and landing sections matching downloaded HTML (hero, navy pipeline, alternating analytical deep dives, privacy boundary, CTA/footer).
3. Implement scoped GSAP matchMedia scroll timeline with SVG draw and stages; clean up on unmount. Lazy-load bounded Three scene only on desktop motion-enabled clients, pause offscreen/hidden, dispose resources, preserve fallback on errors.
4. Restyle existing `/app` only: shared navigation, state-driven five-stage progress, responsive schema/metric controls and evidence rail. Preserve handlers, consent, test labels, real status/result rendering, iframe lifecycle, Investigation and LocalHistory.
5. Run pnpm test/typecheck/build, task formatting and focused production Chrome landing, foundation, investigation, persistence/replay tests. Inspect desktop/mobile screenshots; repair regressions. Run independent design/engineering gate; record evidence/limitations and commit only task-owned changes on main.

Completed:all five steps. Written scope/design, observed RED baseline, implementation, broad functional regression, final source refinements, independent Design Gate ACCEPT and latest-production6-case verification complete. Detailed command evidence and limits:docs/design/stitch/IMPLEMENTATION_REPORT.md. Only local main commits; no external action.
