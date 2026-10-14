# Stitch frontend redesign

Authorized 2026-10-14. Visual source: Stitch project 15958353651669293938, current visible landing 0ed1ba43add749a5b5a55021a3bf0acc and workspace 796d1d8227d44d7d9ca3f6d047394c96. Downloaded original HTML under docs/design/stitch/reference. Existing dirty tree is the baseline; preserve unrelated edits.

Scope: restore `/` as an accurate marketing landing; preserve `/app` and all working ingestion, approval, independent execution, provider consent, evidence, history, export/import, replay and cancellation behavior. Install Tailwind4/PostCSS, GSAP/ScrollTrigger and Three.js with a lockfile. No backend/schema/protocol changes.

Acceptance: Stitch layout/palette/type hierarchy translated to reusable React; connected five-stage scroll pipeline in required order; SVG connections; bounded optional WebGL with fallback/disposal; reduced-motion complete static content; 375/768/1280/1440 no horizontal overflow; accessible links/forms/focus; no automatic persistence; synthetic landing examples labeled and exact arithmetic hand-derived. Unsupported causal/cloud/statistical/attestation claims removed. App values always derive from actual state. Unit/type/build/browser regressions pass. No push/deployment.
