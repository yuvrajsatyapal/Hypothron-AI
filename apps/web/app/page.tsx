import Link from "next/link";
import { Brand } from "../components/Brand";
import { SyntheticEvidence } from "../components/marketing/SyntheticEvidence";
import { InvestigationPipeline } from "../components/marketing/InvestigationPipeline";
import { LandingMotion } from "../components/marketing/LandingMotion";
export const metadata = {
  title: "Hypothron AI — Hypothesis-driven data investigation",
  description:
    "Investigate local datasets with approved calculations, independent numerical verification and reproducible replay.",
};
const primary =
  "marketing-cta inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-teal px-6 text-sm font-semibold text-white transition-colors hover:bg-[#066570]";
const secondary =
  "marketing-cta inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-white px-6 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-dim";
const points = [
  "Hypothesis-driven investigation",
  "Independent local calculations",
  "Reproducible evidence and replay",
];
export default function Landing() {
  return (
    <div id="landing" className="text-on-surface antialiased">
      <a
        href="#content"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded bg-white p-3 focus:translate-y-0"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-4 px-6 lg:px-12">
          <Brand />
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-6 text-xs font-semibold text-on-surface-muted xl:flex [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center"
          >
            <a
              href="#content"
              className="rounded-lg bg-brand-teal-light px-3 py-2 text-brand-teal"
            >
              Platform
            </a>
            <a href="#pipeline">Investigation Engine</a>
            <a href="#privacy">Privacy & Local Compute</a>
            <a href="#deep-dives">Evidence & Replay</a>
          </nav>
          <Link
            href="/app"
            className="marketing-cta inline-flex min-h-11 items-center rounded-lg bg-brand-teal px-3 text-xs font-semibold text-white sm:px-5"
          >
            Start an Investigation{" "}
            <span className="ml-2 hidden sm:inline" aria-hidden="true">
              ↗
            </span>
          </Link>
        </div>
        <details
          data-section-nav
          className="border-t border-border-subtle px-6 xl:hidden"
        >
          <summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold text-on-surface-muted">
            Explore the platform{" "}
            <span aria-hidden="true" className="ml-auto">
              ⌄
            </span>
          </summary>
          <nav
            aria-label="Mobile section navigation"
            className="grid gap-1 pb-3 text-xs [&_a]:flex [&_a]:min-h-11 [&_a]:items-center"
          >
            <a href="#pipeline">Investigation Engine</a>
            <a href="#deep-dives">Evidence &amp; Replay</a>
            <a href="#privacy">Privacy &amp; Local Compute</a>
          </nav>
        </details>
      </header>
      <main id="content">
        <section className="relative overflow-hidden border-b border-border-subtle bg-gradient-to-b from-surface to-[#eef3f9] py-16 lg:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] opacity-35 [background-size:32px_32px]"
          />
          <div className="relative mx-auto grid max-w-[1600px] items-center gap-12 px-6 lg:grid-cols-12 lg:gap-14 lg:px-12">
            <div className="lg:col-span-5">
              <p
                data-reveal
                className="mb-6 inline-flex flex-wrap items-center gap-2 rounded-full border border-border-subtle bg-white px-3 py-2 text-[10px] text-on-surface-muted"
              >
                <span className="size-1.5 rounded-full bg-brand-teal" />
                <span className="font-mono font-semibold tracking-wider text-brand-teal">
                  HYPOTHESIS-DRIVEN AI
                </span>
                <span aria-hidden="true">|</span> Browser-local computation
              </p>
              <h1
                data-reveal
                className="mb-6 text-4xl leading-[1.08] font-extrabold tracking-[-.03em] sm:text-5xl lg:text-[54px]"
              >
                Turn complex data into{" "}
                <span className="bg-gradient-to-r from-brand-teal to-brand-violet bg-clip-text text-transparent">
                  numerically verified answers
                </span>
                .
              </h1>
              <p
                data-reveal
                className="mb-8 max-w-xl text-base leading-8 text-on-surface-muted lg:text-lg"
              >
                Hypothron AI investigates testable hypotheses, compares approved
                calculations across DuckDB and Pyodide, and connects every
                supported finding to reproducible evidence.
              </p>
              <div
                data-reveal
                className="mb-8 flex items-center gap-3 rounded-xl border border-border-subtle bg-white p-4 shadow-subtle-lift"
              >
                <span
                  className="rounded-lg bg-brand-teal-light p-2 text-brand-teal"
                  aria-hidden="true"
                >
                  ◇
                </span>
                <p className="font-mono text-xs leading-6">
                  <span className="text-on-surface-muted">investigate(</span>
                  “What is total revenue for Q3?”
                  <span className="text-on-surface-muted">)</span>
                </p>
              </div>
              <div data-reveal className="flex flex-wrap gap-3">
                <Link href="/app" className={primary}>
                  Start an Investigation <span aria-hidden="true">↗</span>
                </Link>
                <a href="#demo" className={secondary}>
                  <span className="text-brand-teal" aria-hidden="true">
                    ▷
                  </span>{" "}
                  Explore the Example
                </a>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-3 border-t border-border-subtle pt-6">
                {["Local first", "Dual engines", "Replayable"].map((v, i) => (
                  <div key={v}>
                    <p className="text-sm font-bold sm:text-base">{v}</p>
                    <p className="mt-2 font-mono text-[9px] leading-4 text-on-surface-muted">
                      {
                        [
                          "Raw data in memory",
                          "SQL + Python",
                          "Approved snapshots",
                        ][i]
                      }
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div
              data-reveal
              id="demo"
              className="hero-preview relative mx-auto w-full max-w-[680px] lg:col-span-7 lg:pl-8"
            >
              <div
                aria-hidden="true"
                className="absolute -inset-8 rounded-full bg-brand-teal-light opacity-40"
              />
              <div data-preview-parallax className="hero-depth">
                <div data-preview-float className="relative lg:rotate-1">
                  <SyntheticEvidence />
                </div>
              </div>
            </div>
          </div>
        </section>
        <InvestigationPipeline />
        <section
          id="deep-dives"
          className="mx-auto max-w-[1504px] px-6 py-24 lg:px-12 lg:py-32"
        >
          <div className="mb-20 text-center">
            <p className="mb-4 font-mono text-xs uppercase tracking-wider text-brand-teal">
              Rigorous analytical depth
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Reason clearly. Calculate independently.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-on-surface-muted">
              Three foundations for investigations you can inspect and
              reproduce.
            </p>
          </div>
          <div
            data-showcase
            className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20"
          >
            <div>
              <p className="mb-4 font-mono text-xs text-brand-teal">
                DEEP DIVE 01 · HYPOTHESES
              </p>
              <h3 className="mb-5 text-3xl font-bold tracking-tight">
                An investigation starts
                <br />
                with a testable question.
              </h3>
              <p className="mb-6 text-sm leading-7 text-on-surface-muted">
                AI proposes hypotheses and bounded operations. You approve the
                metric contract before local computation. The investigation
                keeps its assumptions and evidence visible.
              </p>
              <ul className="space-y-3 text-sm">
                {[
                  "Review dataset and metric semantics",
                  "Approve supported calculations",
                  "Keep unresolved questions visible",
                ].map((v) => (
                  <li key={v} className="flex gap-3">
                    <span className="text-brand-teal" aria-hidden="true">
                      ✓
                    </span>
                    {v}
                  </li>
                ))}
              </ul>
              <p className="mt-6 font-mono text-[10px] text-on-surface-muted">
                Correlation and decomposition do not establish causality.
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-white p-6 shadow-subtle-lift">
              <div className="mb-6 flex items-center justify-between border-b border-border-subtle pb-4">
                <h4 className="text-sm font-bold">Candidate hypothesis</h4>
                <span className="font-mono text-[10px] text-on-surface-muted">
                  ILLUSTRATION
                </span>
              </div>
              <div className="rounded-lg bg-navy-night p-5 text-white">
                <p className="mb-3 font-mono text-xs text-teal-200">
                  H1 · REVENUE TOTAL
                </p>
                <p className="text-sm leading-6">
                  The Q3 total can be computed under an approved period and
                  currency contract.
                </p>
              </div>
              <svg
                viewBox="0 0 420 64"
                className="h-16 w-full"
                aria-hidden="true"
              >
                <path
                  data-showcase-line
                  d="M210 0 C210 24 80 24 80 64 M210 0 C210 24 340 24 340 64"
                  fill="none"
                  stroke="#7565d9"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />
              </svg>
              <details className="mb-4 text-xs text-on-surface-muted">
                <summary className="flex min-h-11 cursor-pointer items-center">
                  Inspect the approval boundary
                </summary>
                <p className="leading-6">
                  The workspace approves dataset identity, period, grain,
                  currency and null policy before computation. This illustration
                  does not approve or execute a real calculation.
                </p>
              </details>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-border-subtle bg-brand-teal-light p-4 text-xs">
                  <strong>Approve semantics</strong>
                  <p className="mt-2 leading-5 text-on-surface-muted">
                    USD · UTC · revenue_sum
                  </p>
                </div>
                <div className="rounded-lg border border-border-subtle bg-brand-violet-light p-4 text-xs">
                  <strong>Inspect evidence</strong>
                  <p className="mt-2 leading-5 text-on-surface-muted">
                    Independent totals and counts
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div
            data-showcase
            className="mt-24 grid items-center gap-12 lg:grid-cols-2 lg:gap-20"
          >
            <div className="rounded-xl bg-navy-night p-6 text-white lg:order-first">
              <div className="mb-6 flex justify-between border-b border-navy-border pb-4">
                <h4 className="text-sm font-semibold">
                  Independent execution paths
                </h4>
                <span className="font-mono text-[10px] text-teal-200">
                  LOCAL
                </span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="mb-3 font-mono text-xs text-teal-200">
                    DuckDB-WASM · SQL
                  </p>
                  <pre className="overflow-x-auto rounded-lg bg-navy-card p-4 font-mono text-xs leading-6">
                    {
                      "SELECT SUM(amount)\nFROM approved_rows;\n\n-- Exact minor units"
                    }
                  </pre>
                </div>
                <div>
                  <p className="mb-3 font-mono text-xs text-violet-300">
                    Pyodide · Python
                  </p>
                  <pre className="overflow-x-auto rounded-lg bg-navy-card p-4 font-mono text-xs leading-6">
                    {
                      "# Fixed trusted template\n# Independent computation\n# Approved metric only"
                    }
                  </pre>
                </div>
              </div>
              <details className="mt-4 text-xs text-slate-300">
                <summary className="flex min-h-11 cursor-pointer items-center">
                  What happens when results disagree?
                </summary>
                <p className="leading-6">
                  The workspace preserves both results and labels the evidence
                  DISPUTED. Missing or incompatible results remain INCONCLUSIVE.
                </p>
              </details>
              <p className="mt-6 border-t border-navy-border pt-5 text-xs leading-6 text-slate-300">
                Compare contract, source identity, exact values and row counts.
                Disagreement remains visible.
              </p>
            </div>
            <div>
              <p className="mb-4 font-mono text-xs text-violet-ink">
                DEEP DIVE 02 · NUMERICAL VERIFICATION
              </p>
              <h3 className="mb-5 text-3xl font-bold tracking-tight">
                Two engines.
                <br />
                One approved contract.
              </h3>
              <p className="text-sm leading-7 text-on-surface-muted">
                Separate SQL and Python calculations help detect implementation
                errors. Exact monetary values and counts must agree under the
                same dataset and metric semantics.
              </p>
              <p className="mt-6 rounded-lg border-l-2 border-brand-violet bg-brand-violet-light p-4 text-xs leading-6">
                VERIFIED + CLIENT_REPORTED means local agreement. It is not
                trusted server attestation, and shared Parquet decoding is not
                an independent verification path.
              </p>
            </div>
          </div>
          <div
            data-showcase
            className="mt-24 grid items-center gap-12 lg:grid-cols-2 lg:gap-20"
          >
            <div>
              <p className="mb-4 font-mono text-xs text-brand-teal">
                DEEP DIVE 03 · EVIDENCE & REPLAY
              </p>
              <h3 className="mb-5 text-3xl font-bold tracking-tight">
                An answer with a trail
                <br />
                you can follow.
              </h3>
              <p className="text-sm leading-7 text-on-surface-muted">
                Reports bind supported claims to dataset identity, metric
                versions and accepted evidence. Explicit Save retains the
                snapshot required for deterministic local replay.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Inspect compiled SQL and Python",
                  "Export approved snapshots and runtime identity",
                  "Replay calculations with zero LLM requests",
                ].map((v) => (
                  <li key={v} className="flex gap-3">
                    <span className="text-brand-teal" aria-hidden="true">
                      ✓
                    </span>
                    {v}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border-subtle bg-white shadow-subtle-lift">
              <div className="border-b border-border-subtle p-5 text-sm font-bold">
                Investigation bundle{" "}
                <span className="float-right font-mono text-[10px] font-normal text-on-surface-muted">
                  EXPLICIT SAVE
                </span>
              </div>
              <div className="space-y-4 p-6">
                {[
                  "Original dataset snapshot",
                  "Approved metric contract",
                  "Paired numerical evidence",
                  "Pinned runtime & compiler identity",
                ].map((v, i) => (
                  <div
                    key={v}
                    data-bundle-item
                    className="flex items-center gap-4 rounded-lg border border-border-subtle p-4"
                  >
                    <span className="font-mono text-xs text-brand-teal">
                      0{i + 1}
                    </span>
                    <span className="text-xs font-semibold">{v}</span>
                  </div>
                ))}
                <p className="text-xs leading-6 text-on-surface-muted">
                  A hash identifies bytes; it does not prove execution. Exported
                  bundles contain sensitive data and are not automatically
                  encrypted.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section
          id="privacy"
          className="border-y border-border-subtle bg-[#f3f6fb] py-24 lg:py-32"
        >
          <div className="mx-auto max-w-[1408px] px-6 lg:px-12">
            <div className="mb-14 text-center">
              <p className="mb-4 font-mono text-xs text-brand-teal">
                PRIVACY-FIRST LOCAL COMPUTE
              </p>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                Client isolation meets
                <br />
                consent-controlled reasoning.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-on-surface-muted">
                Raw datasets stay local by default. AI reasoning uses only
                explicitly approved metadata and bounded aggregate evidence.
              </p>
            </div>
            <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
              <div className="rounded-xl border border-border-subtle bg-white p-6">
                <span className="mb-6 inline-block rounded bg-brand-teal-light px-3 py-1 font-mono text-[10px] text-brand-teal">
                  BROWSER MEMORY
                </span>
                <h3 className="mb-2 text-xl font-bold">
                  Client Browser Sandbox
                </h3>
                <p className="mb-6 text-xs text-on-surface-muted">
                  Local processing · explicit Save only
                </p>
                {[
                  "Raw CSV / Parquet snapshots",
                  "DuckDB & Pyodide calculations",
                  "Local saved history and replay",
                ].map((v) => (
                  <p
                    key={v}
                    className="border-t border-border-subtle py-4 text-sm"
                  >
                    {v}
                  </p>
                ))}
              </div>
              <div className="text-center font-mono text-[10px] leading-6 text-brand-teal">
                <span className="text-2xl" aria-hidden="true">
                  ⇄
                </span>
                <br />
                Consent
                <br />
                boundary
              </div>
              <div className="rounded-xl border border-border-subtle bg-white p-6">
                <span className="mb-6 inline-block rounded bg-brand-violet-light px-3 py-1 font-mono text-[10px] text-violet-ink">
                  APPROVED CONTEXT
                </span>
                <h3 className="mb-2 text-xl font-bold">
                  AI Hypothesis Service
                </h3>
                <p className="mb-6 text-xs text-on-surface-muted">
                  Provider consent · bounded calls
                </p>
                {[
                  "Approved schema and metric metadata",
                  "Bounded approved aggregate evidence",
                  "Structured hypotheses and plans",
                ].map((v) => (
                  <p
                    key={v}
                    className="border-t border-border-subtle py-4 text-sm"
                  >
                    {v}
                  </p>
                ))}
              </div>
            </div>
            <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-6 text-on-surface-muted">
              Metadata and aggregates can be sensitive. Provider retention
              depends on the selected provider. Keys remain ephemeral; nothing
              is automatically saved. Deterministic replay makes no new
              inference requests.
            </p>
          </div>
        </section>
        <section className="bg-white px-6 py-24 text-center lg:py-28">
          <span
            className="mb-5 inline-flex size-12 items-center justify-center rounded-xl bg-brand-teal-light text-2xl text-brand-teal"
            aria-hidden="true"
          >
            ◇
          </span>
          <h2 className="mx-auto mb-5 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Ready to investigate
            <br />
            with evidence?
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-sm leading-7 text-on-surface-muted">
            Bring a local dataset. Define the calculation. Inspect what the
            evidence supports.
          </p>
          <Link href="/app" className={primary}>
            Start an Investigation <span aria-hidden="true">↗</span>
          </Link>
          <ul className="mt-10 flex flex-wrap justify-center gap-6 text-xs text-on-surface-muted">
            {points.map((p) => (
              <li key={p}>
                <span className="mr-2 text-brand-teal" aria-hidden="true">
                  ✓
                </span>
                {p}
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="border-t border-border-subtle px-6 py-12 lg:px-12">
        <div className="mx-auto flex max-w-[1504px] flex-wrap justify-between gap-8">
          <div>
            <Brand />
            <p className="mt-4 max-w-md text-xs leading-6 text-on-surface-muted">
              Hypothesis-driven data investigation, deterministic numerical
              verification and reproducible replay.
            </p>
          </div>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap gap-8 text-xs text-on-surface-muted [&_a]:flex [&_a]:min-h-11 [&_a]:items-center"
          >
            <a href="#pipeline">Investigation Engine</a>
            <a href="#deep-dives">Evidence & Replay</a>
            <a href="#privacy">Privacy & Local Compute</a>
            <Link href="/app">Open Workspace</Link>
          </nav>
        </div>
        <p className="mx-auto mt-10 max-w-[1504px] border-t border-border-subtle pt-6 font-mono text-[10px] text-on-surface-muted">
          © 2026 Hypothron AI · Arctic Intelligence
        </p>
      </footer>
      <LandingMotion />
    </div>
  );
}
