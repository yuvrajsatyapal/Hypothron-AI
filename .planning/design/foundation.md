# Foundation Workspace Design

Phase 1 screen, provisional UI system. Analytical workflow first: persistent header, narrow dataset/control rail and wide evidence pane. On narrow screens controls precede evidence in a single column. No marketing hero, glow, gradients or decorative agent cards.

Tokens: paper #f5f5f5, surface #ffffff, ink #2d3142, muted #4f5d75, accent #bf4520, link #2e5aa8, border #bfc0c0. System sans for human labels, system mono for code, serif page heading. Spacing 4/8/12/16/24/32; radius 6; no shadows. Contrast focus outlines and text status accompany color. These temporary tokens are explicit, not a claim of a finalized brand.

Components: labeled file input (CSV initially), dataset summary table, metric column/date/period/null controls, Execute / Cancel / Replay buttons, visible runtime loading/error text, paired engine values, verification status+provenance, details disclosure for compiled source. Empty state explains local memory and why Save is absent until Phase 4. No disabled fake feature pages.

Failure states: malformed/oversized file, unsupported operation, unavailable runtime, timeout, cancelled job, mismatch and inconclusive input. Keep original snapshot in memory; never replace failure with canned data. Keyboard focus remains on initiating control; completion uses aria-live; code wraps or scrolls locally. Dataset previews remain local text.

Design gate: tokens/layout/accessibility checked against implementation and reviewed before Phase 1 completion; responsive tests at 375, 390, 768 and 1440 pixels. Interactive borders use muted #4f5d75 for non-text contrast; border #bfc0c0 is decorative only. Evidence displays the executed contract separately from editable inputs; replay explicitly uses the original contract.
