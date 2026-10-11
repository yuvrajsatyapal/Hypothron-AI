# Diagram Deliverables

Markdown documents were created before rendering these diagrams. Generated with the requested diagram-design skill; the user explicitly selected its default editorial palette on this run. This choice is provisional until the UI design system exists. The shared installed style guide and profile library were not changed.

- [System architecture](system-architecture.html): Architecture with secure paved road semantics, doc-wide 1280×720, public browser mode; seven components and eight routes including one blocked ingress.
- [Execution handoff](execution-sequence.html): Sequence, doc-wide 1280×720, four actors and ten messages, successful issue/execute/submit/resume path.

Both are self-contained HTML with inline SVG/CSS, accessible title/description, local narrow-screen scrolling and print scaling. Google Fonts is the only external presentation dependency; local serif/sans/mono fallbacks apply when unavailable. They contain no application implementation or executable analytical code.

Scope reductions: optional native execution, agent internals, account sync, telemetry services and crash/retry branches remain in written documents. No raw-data route crosses into the server. Dashed returns are distinct from blocked ingress, which ends at a stop bar. These two diagrams describe the full target. Phase 1 subsequently validated the separate execution-origin policy in local Chrome; public-host headers and broader devices remain unvalidated.

Validation: skill self_check.py plus structural accessibility/link and manual geometry checks. Repository-only geometry/render linters are absent from this installed skill; both diagrams were rendered and visually reviewed in installed headless Chrome. At 390px the page has no horizontal overflow and each SVG has its own working scroller with 1280px minimum width. Font-family declarations were checked; system fallbacks remain available. No PNG/SVG export files are produced because export was not requested.

Implemented phase diagrams: Phase 1 [architecture](phase-1-architecture.html)/[sequence](phase-1-sequence.html); Phase 2 [architecture](phase-2-architecture.html)/[sequence](phase-2-sequence.html)/[routing and recovery](phase-2-routing.html). Phase 2 adds actual API, ledger, fenced native saver and provider boundaries. All three Phase 2 diagrams pass the skill self-check and Chrome font/bounds/local-scroll checks; visual inspection is recorded in the phase report.
