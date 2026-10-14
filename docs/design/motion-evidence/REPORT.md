# Interactivity verification — 2026-10-14

Current Stitch appearance is preserved: same fonts, teal/violet/navy palette, split hero, product sections and workspace. Meetstream was inspected as a workflow interaction reference. Stitch project15958353651669293938 and latest landing/workspace screens were identified through the connector; no design was regenerated.

## What changed

The five-card timeline is now a reusable React investigation graph. Dataset, schema and question converge on hypotheses; approved calculations split into DuckDB/Pyodide and join at comparison and evidence. ResizeObserver measures curved SVG endpoints. One component-owned scrub timeline controls connection drawing, traveling signals, card progression and report reveal; upward scroll reverses it. Desktop pinning is conditional on measured viewport fit. Mobile stacks connected inputs and engine paths. Synthetic previews remain explicitly labeled and never execute workspace actions.

Hero entrance, fine-pointer parallax and a separate floating layer add depth; chart bars and result cards reveal progressively. Existing hypothesis/verification/evidence showcases draw connections and reveal content. Mobile section navigation and native calculation/provenance disclosures work with keyboard and touch. Generic WebGL particles are no longer mounted; meaningful spatial effects use SVG/CSS without a continuously rendering canvas. Motion imports stay out of `/app`.

GSAP contexts/matchMedia revert on route unmount or reduced-motion changes. Pointer, visibility and resize listeners and observers clean up. Floating motion pauses out of view or while the document is hidden. Static SSR cards and connectors/arrows remain readable without JavaScript. No backend/database or analytical behavior changes.

## Actual evidence

- `pnpm test`:113 tests/19 files pass, including real Pyodide arithmetic tests.
- `pnpm typecheck`: strict web/executor TypeScript passes.
- `pnpm format:check`: passes; extra motion test Prettier check also passes.
- Final `pnpm build`: production Next.js/executor build passes; landing111kB and workspace165kB first-load JavaScript.
- Final supported-origin production browser motion/navigation checks:19/19 pass in14.9s. Includes upward reversal, traveling-signal graph, parallax, route lifecycle, desktop/tablet/mobile, touch navigation, native details, no-JS fallback, no implicit IndexedDB and clean console.
- Independent read-only reviewer: ACCEPT after actual shell-fit pin condition and resize/header observations were confirmed. No remaining important lifecycle or accessibility finding.
- Supported-origin production workspace checks:20/20 pass in2.4min (foundation18, API investigation1, animation isolation1). Real DuckDB/Pyodide exact3033-cent agreement, replay, cancellation, denied egress/capabilities, negative/empty/contradictory evidence and conditional API/LangGraph/PostgreSQL flow pass. History/Parquet/bundle checks:10/10 pass in1.8min (persistence3, Parquet4, bundles/replay3), including explicit Save/reload/delete, quota/rollback/eviction, genuine Parquet conversion, pinned extension egress, export/import confirmation/idempotence, zero-inference replay, cancellation/retry, forged agreement and snapshot corruption. Total final checks in this verification pass:49 browser tests.

Earlier attempts ran while another session rebuilt shared production assets. Stale chunk failures and a local-network restriction in a temporary proxy harness are discarded as acceptance evidence. The final checks use the restored production origin3000, executor3001 and existing guarded test API8000. External provider HTTP is mocked; real graph/DB/local numerical engines execute. No real key or live inference is used.

## Before and after

[Before hero](before-hero.png) · [After hero](after-hero.png)

[Before timeline](before-pipeline.png) · [After connected pipeline](after-pipeline.png)

[Mobile375](after-pipeline-375.png) · [Tablet768](after-pipeline-768.png)

These are actual local Chrome captures, not design renders. Responsive emulation does not certify physical mobile or all browsers. No frame-rate benchmark or public production-readiness claim follows from the checks. No deployment, push or PR was performed. Unrelated pre-existing edits and environment example remain excluded from this verification task.

Tested implementation commit: `5700e02df2c701f6f197710a14af8c244760c43c` on existing main. The implementation session committed its source and primary report while this independent verification pass was running. This pass adds six browser acceptance cases and before/after captures without overwriting those source changes. No standalone JavaScript/TypeScript linter is configured; format/type/build gates are reported explicitly.
