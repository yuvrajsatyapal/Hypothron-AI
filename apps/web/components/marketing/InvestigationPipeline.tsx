export const stages = [
  {
    title: "Local Dataset + Schema + User Question",
    label: "Local ingestion",
    description:
      "Choose bounded CSV or Parquet inputs. Raw records stay in browser memory by default.",
    detail: "Source bytes · schema · question",
  },
  {
    title: "AI Hypotheses",
    label: "Hypothesis-driven reasoning",
    description:
      "With your consent, AI proposes testable hypotheses from approved metadata and aggregate evidence.",
    detail: "Explicit consent · bounded budget",
  },
  {
    title: "Approved Calculations",
    label: "Inspectable operations",
    description:
      "Review metric semantics and approve calculations. Trusted compilers produce restricted SQL and fixed Python.",
    detail: "Contract · grain · currency · period",
  },
  {
    title: "DuckDB/Pyodide Comparison",
    label: "Independent numerical paths",
    description:
      "Run the approved calculation locally in both engines. Preserve agreement, disagreement and inconclusive results.",
    detail: "Exact monetary values · row counts",
  },
  {
    title: "Evidence Report",
    label: "Reproducible investigation",
    description:
      "Trace claims to evidence. Explicitly save a snapshot to export and replay calculations without new inference.",
    detail: "CLIENT_REPORTED · zero-inference replay",
  },
];
export function InvestigationPipeline() {
  return (
    <section
      id="pipeline"
      aria-label="Investigation pipeline"
      className="relative overflow-hidden bg-navy-night py-24 text-white lg:py-32"
    >
      <div className="mx-auto max-w-[1504px] px-6 lg:px-12">
        <p className="mb-4 font-mono text-xs tracking-widest text-teal-300">
          INPUT-TO-EVIDENCE FLOW
        </p>
        <div className="mb-14 flex flex-wrap items-end justify-between gap-8">
          <h2 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            From a local dataset to
            <br />a verifiable answer.
          </h2>
          <p className="max-w-md text-sm leading-7 text-slate-400">
            A connected investigation, with human approval and numerical
            verification at every meaningful boundary.
          </p>
        </div>
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-0 top-0 hidden h-12 w-full lg:block"
            viewBox="0 0 1000 50"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M95.25 25H904.75" stroke="#1e3156" strokeWidth="2" />
            <path
              data-pipeline-connection
              d="M95.25 25H904.75"
              stroke="#79d4e2"
              strokeWidth="2"
              fill="none"
            />
          </svg>
          <ol className="relative grid gap-4 lg:grid-cols-5">
            {stages.map((stage, i) => (
              <li
                key={stage.title}
                data-pipeline-stage
                className="relative rounded-xl border border-navy-border bg-navy-card px-5 py-6 lg:mt-16"
              >
                <span className="mb-8 flex size-9 lg:absolute lg:-top-[58px] lg:left-1/2 lg:mb-0 lg:-translate-x-1/2 items-center justify-center rounded-lg border border-teal-700 bg-navy-night font-mono text-sm text-teal-200">
                  0{i + 1}
                </span>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-teal-300">
                  {stage.label}
                </p>
                <h3 className="mb-4 min-h-16 text-base font-bold leading-6">
                  {stage.title}
                </h3>
                <p className="text-xs leading-6 text-slate-300">
                  {stage.description}
                </p>
                <p className="mt-5 border-t border-navy-border pt-4 font-mono text-[10px] leading-5 text-slate-400">
                  {stage.detail}
                </p>
                {i < 4 && (
                  <span
                    className="absolute -bottom-4 left-1/2 z-10 text-teal-300 lg:hidden"
                    aria-hidden="true"
                  >
                    ↓
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-8 text-xs text-slate-400">
          Numerical agreement is client-reported. It does not establish
          causality or server attestation.
        </p>
      </div>
    </section>
  );
}
