# Stitch UI implementation — 2026-10-14

Source: Stitch project 15958353651669293938, landing screen 0ed1ba43add749a5b5a55021a3bf0acc, studio 796d1d8227d44d7d9ca3f6d047394c96 and Three.js fabf2951f1604efb8b6060a2fe8665ef. The user requests direct implementation of these references without a documentation workflow.

Scope: finish the existing landing and analytical workspace with the reference's connected ambient network, layered notebook preview, navigation/search, contextual telemetry drawer, dense notebook surfaces, floating action dock and responsive layouts. Preserve real execution, consent, save and replay behavior. Sample causal conclusions, warehouse integrations, arbitrary notebook execution and audit certification in Stitch are not available capabilities; show actual runtime/evidence state instead.

Acceptance: all navigation and controls operate; command search is keyboard accessible; drawer traps focus and closes with Escape; actual runtime telemetry reflects the current result; sample table sorts and exports exactly its synthetic rows; no implicit persistence; animations stop for reduced motion and hidden/offscreen surfaces; mobile has no document overflow; workspace never loads Three.js/GSAP. Validate existing calculation/replay and landing tests plus focused new interaction tests, TypeScript and production build.

Plan: add failing browser interaction tests; implement shared native-dialog workspace controls with actual telemetry; restore connected Three.js hero and interactive sample notebook; style all supported workflow surfaces using Stitch tokens; run browser validation and inspect screenshots; commit only task-owned files.
