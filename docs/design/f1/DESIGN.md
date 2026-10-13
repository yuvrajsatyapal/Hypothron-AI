# F1 — The Evidence Observatory

> **REJECTED / SUPERSEDED — 13 October 2026:** The user rejected F1's visual direction. This document is retained as historical context, not approval or instructions for a new design. Prototype code, fonts, fixture, validator and screenshots were removed; see the [reset record](../F1_RESET_REPORT.md) and [current master-plan decision](../FRONTEND_EXPERIENCE_MASTER_PLAN.md). Old plain-CSS/token/milestone instructions below no longer govern future work.

**Direction accepted to begin F1:** 13 October 2026. [Scope and plan](SCOPE_AND_PLAN.md) define acceptance; `prototype.html` (removed) is a static design artifact. Open through a local static server for fonts and browser QA.

Idea: a question becomes an approved calculation and an inspectable report. Metaphor: an observatory follows evidence without manufacturing certainty. Signature: two local calculation tracks meet at evidence E1. Emotion: deliberate, curious, readable. Motion verb: settle; F1 itself remains static. Screenshot: asymmetrical landing typography beside the paired-track SVG, then a calm report with exact values and adjacent provenance.

## Tokens and composition

`tokens.css` (removed) implements the master plan palette exactly, with semantic names for light and dark themes, Manrope/IBM Plex Mono, 4px spacing rhythm, 8/12/16px radius hierarchy (--radius-swatch: 4px decorative swatches; --radius-status: 999px pills reserved for compact statuses), 100/160/220ms interface timing and reduced-motion zero durations. One set of variables owns all screen styling. Marketing is always dark; workspace theme is switchable and session-only. No persistent theme writes.

Landing: large left-aligned typographic statement, bounded SVG evidence topology, three ordered story chapters, wide report frame, replay closing. Setup: dataset/metric panel beside explicit optional AI consent. Progress: authoritative-stage composition with no fabricated percent/ETA. Report: exact total and finding alongside exact comparison table, inspectable evidence and separate provenance. History: explicit synthetic inventory, distinct replay/fresh modes and storage limits. System: shared surfaces, controls and status vocabulary. Narrow layouts become one column; navigation wraps; only the exact table may scroll locally if needed.

Source values are in `synthetic-revenue.csv` (removed): 300.00 + 250.00 + 400.00 + 200.00 + 100.00 = USD 1,250.00, five unique records inside [2026-10-01,2026-11-01). These are hand-derived design values, not newly executed engine evidence. All report/state/AI/history content is explicitly synthetic. No fake runtime hash, job identity, measured budget, confidence score or attestation is shown.

## Interaction contract

Screen navigation uses semantic links plus a labeled preview selector. Screen changes focus the heading. Theme/state selectors use native controls. Details disclose metric, source, provenance and audit. Consent checkboxes only enable preview navigation. Application actions such as Save/replay/export/cancel are visibly disabled and named as prototype-only. The state selector exercises empty/loading/error/disputed/inconclusive; unpublished states withhold the ready report. With JavaScript unavailable, all screen compositions remain in document order. No modal, dragging, carousel, scroll pin, persistent store, fetch, worker or provider call is present.

## Asset provenance and future integration

Self-hosted TTFs are copied from the Google Fonts [Manrope](https://github.com/google/fonts/tree/main/ofl/manrope) and [IBM Plex Mono](https://github.com/google/fonts/tree/main/ofl/ibmplexmono) repositories; OFL notices are retained in assets. SHA256/size records are in `assets/manifest.json` (removed). F1 loads real fonts locally without a runtime Google Fonts request. F2 should subset/package WOFF2 using Next's local-font integration and measure fallback shifts; these prototype TTFs are not a production font-bundle decision.

The static SVG is original authored geometry, with accessible prose equivalents. No image/3D/animation dependency was introduced. F1 preserves the plain CSS approach. Tailwind evaluation happens after F1 acceptance; future utilities must reference these semantic tokens rather than replace them with default palette values. This artifact is not imported into apps/web or the executor.
