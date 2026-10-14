"use client";

import { useEffect, useId, useRef, useState } from "react";

const edges = [
  ["dataset", "hypotheses", 0],
  ["schema", "hypotheses", 0],
  ["question", "hypotheses", 0],
  ["hypotheses", "approved", 1],
  ["approved", "duckdb", 2],
  ["approved", "pyodide", 2],
  ["duckdb", "comparison", 3],
  ["pyodide", "comparison", 3],
  ["comparison", "report", 4],
] as const;
const phases = [
  "Local inputs",
  "AI hypotheses",
  "Approved calculations",
  "Independent execution",
  "Paired comparison",
  "Evidence report",
];

type Geometry = {
  width: number;
  height: number;
  paths: string[];
  measured: boolean;
  viewportHeight: number;
  headerHeight: number;
};

export function InvestigationPipeline() {
  const root = useRef<HTMLElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<Geometry>({
    width: 1200,
    height: 520,
    // SSR connections preserve the workflow before layout measurement or JS.
    measured: false,
    viewportHeight: 0,
    headerHeight: 0,
    paths: [
      "M192,80 C225,80 220,260 240,260",
      "M192,260 C220,260 220,260 240,260",
      "M192,440 C225,440 220,260 240,260",
      "M432,260 C450,260 460,260 480,260",
      "M672,260 C700,260 700,145 720,145",
      "M672,260 C700,260 700,375 720,375",
      "M912,145 C935,145 935,150 960,150",
      "M912,375 C935,375 935,150 960,150",
      "M1056,240 C1056,260 1056,260 1056,280",
    ],
  });
  const gradient = useId().replace(/:/g, "");

  useEffect(() => {
    const element = board.current;
    if (!element) return;
    function measure() {
      if (!element) return;
      const wide = matchMedia("(min-width: 1100px)").matches;
      function bounds(id: string) {
        const node = element!.querySelector<HTMLElement>(
          `[data-node="${id}"]`,
        )!;
        let x = 0,
          y = 0;
        let cursor: HTMLElement | null = node;
        // Layout offsets deliberately exclude animated transforms.
        while (cursor && cursor !== element) {
          x += cursor.offsetLeft;
          y += cursor.offsetTop;
          cursor = cursor.offsetParent as HTMLElement | null;
        }
        return { x, y, w: node.offsetWidth, h: node.offsetHeight };
      }
      const paths = edges.map(([from, to]) => {
        const a = bounds(from),
          b = bounds(to);
        const vertical = !wide || from === "comparison";
        if (vertical) {
          const x1 = a.x + a.w / 2,
            y1 = a.y + a.h;
          const x2 = b.x + b.w / 2,
            y2 = b.y;
          const bend = Math.max(20, (y2 - y1) / 2);
          return `M${x1},${y1} C${x1},${y1 + bend} ${x2},${y2 - bend} ${x2},${y2}`;
        }
        const x1 = a.x + a.w,
          y1 = a.y + a.h / 2;
        const x2 = b.x,
          y2 = b.y + b.h / 2;
        const bend = (x2 - x1) / 2;
        return `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`;
      });
      setGeometry((previous) => {
        const next = {
          width: element.offsetWidth,
          height: element.offsetHeight,
          paths,
          measured: true,
          viewportHeight: innerHeight,
          headerHeight:
            document.querySelector("#landing > header")?.getBoundingClientRect()
              .height ?? 64,
        };
        return JSON.stringify(previous) === JSON.stringify(next)
          ? previous
          : next;
      });
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const header = document.querySelector("#landing > header");
    if (header) observer.observe(header);
    element
      .querySelectorAll("[data-node]")
      .forEach((node) => observer.observe(node));
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!element || !geometry.measured) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (disposed) return;
        gsap.registerPlugin(ScrollTrigger);
        const media = gsap.matchMedia();
        media.add(
          {
            motion: "(prefers-reduced-motion: no-preference)",
            wide: "(min-width: 1100px) and (min-height: 820px)",
          },
          (context) => {
            if (!context.conditions?.motion) return;
            const shell =
              element.querySelector<HTMLElement>(".pipeline-shell")!;
            const headerHeight =
              document
                .querySelector("#landing > header")
                ?.getBoundingClientRect().height ?? 64;
            const wide =
              Boolean(context.conditions.wide) &&
              shell.offsetHeight + headerHeight + 16 <= innerHeight;
            const cards = element.querySelectorAll<HTMLElement>("[data-node]");
            const paths =
              element.querySelectorAll<SVGPathElement>("[data-flow-edge]");
            const signals =
              element.querySelectorAll<SVGCircleElement>("[data-flow-signal]");
            const progress = element.querySelector<HTMLElement>(
              "[data-flow-progress]",
            );
            const status =
              element.querySelector<HTMLElement>("[data-flow-status]");
            const ctx = gsap.context(() => {
              gsap.set(cards, { opacity: 0.85, y: 12 });
              gsap.set(paths, {
                strokeDasharray: 1000,
                strokeDashoffset: 1000,
              });
              gsap.set(signals, { opacity: 0 });
              const timeline = gsap.timeline({
                defaults: { ease: "none" },
                scrollTrigger: {
                  id: "hypothron-investigation-flow",
                  trigger: element,
                  start: wide ? `top ${headerHeight}px` : "top 65%",
                  end: wide ? "+=1500" : "bottom 20%",
                  pin: wide ? shell : false,
                  scrub: 0.45,
                  invalidateOnRefresh: true,
                  onUpdate: (self) => {
                    element.dataset.progress = self.progress.toFixed(3);
                    if (progress) gsap.set(progress, { scaleX: self.progress });
                    if (status)
                      status.textContent =
                        phases[Math.min(5, Math.floor(self.progress * 6))];
                  },
                },
              });
              timeline.to(
                '[data-node="dataset"], [data-node="schema"], [data-node="question"]',
                { opacity: 1, y: 0, stagger: 0.08, duration: 0.5 },
                0,
              );
              const groups = [
                "hypotheses",
                "approved",
                "duckdb",
                "pyodide",
                "comparison",
                "report",
              ];
              groups.forEach((id, index) => {
                const at = [0.8, 1.8, 2.8, 2.8, 3.8, 4.8][index];
                timeline.to(
                  `[data-node="${id}"]`,
                  { opacity: 1, y: 0, duration: 0.65 },
                  at,
                );
              });
              paths.forEach((path, i) => {
                const at = edges[i][2] + 0.25;
                timeline.to(path, { strokeDashoffset: 0, duration: 0.8 }, at);
                const position = { fraction: 0 };
                const signal = signals[i];
                const length = path.getTotalLength();
                const move = () => {
                  const point = path.getPointAtLength(
                    length * position.fraction,
                  );
                  signal.setAttribute("cx", String(point.x));
                  signal.setAttribute("cy", String(point.y));
                };
                move();
                timeline.to(signal, { opacity: 1, duration: 0.08 }, at);
                timeline.to(
                  position,
                  { fraction: 1, duration: 0.8, onUpdate: move },
                  at,
                );
                timeline.to(signal, { opacity: 0, duration: 0.12 }, at + 0.8);
              });
              timeline.fromTo(
                "[data-report-value]",
                { opacity: 0.85 },
                { opacity: 1, duration: 0.5 },
                5,
              );
            }, element);
            element.dataset.motionReady = "true";
            return () => {
              ctx.revert();
              delete element.dataset.motionReady;
              delete element.dataset.progress;
              if (progress) progress.style.removeProperty("transform");
              if (status) status.textContent = "Evidence report";
            };
          },
        );
        cleanup = () => media.revert();
      })
      .catch(() => {
        /* SSR graph stays readable when motion is unavailable. */
      });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [geometry]);

  return (
    <section
      ref={root}
      id="pipeline"
      aria-label="Investigation pipeline"
      className="bg-navy-night text-white"
    >
      <div className="pipeline-shell mx-auto max-w-[1504px] px-6 py-16 lg:px-12">
        <div className="pipeline-heading">
          <div>
            <p className="mb-4 font-mono text-xs tracking-widest text-teal-300">
              INPUT-TO-EVIDENCE FLOW
            </p>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              From a local dataset to
              <br />a verifiable answer.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-7 text-slate-400">
            Follow the investigation. Scroll to connect the inputs, compare
            independent calculations and reveal the evidence.
          </p>
        </div>
        <div className="pipeline-caption">
          <span className="font-mono text-[10px] text-teal-200">
            SYNTHETIC WALKTHROUGH · NO LIVE INFERENCE
          </span>
          <span data-flow-status className="text-xs text-slate-300">
            Evidence report
          </span>
        </div>
        <div className="pipeline-meter" aria-hidden="true">
          <div data-flow-progress />
        </div>
        <div ref={board} className="pipeline-board">
          <svg
            className={`pipeline-wires ${geometry.measured ? "" : "pipeline-fallback"}`}
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id={gradient}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="0"
                x2={geometry.width}
                y2={geometry.height}
              >
                <stop stopColor="#79d4e2" />
                <stop offset="1" stopColor="#7565d9" />
              </linearGradient>
            </defs>
            {geometry.paths.map((d, i) => (
              <g key={`${edges[i][0]}-${edges[i][1]}`}>
                <path d={d} className="flow-track" />
                <path
                  d={d}
                  data-flow-edge
                  data-pipeline-connection
                  pathLength="1000"
                  className="flow-line"
                  stroke={`url(#${gradient})`}
                />
                <circle
                  data-flow-signal
                  r="4"
                  fill={
                    edges[i][0] === "pyodide" || edges[i][1] === "pyodide"
                      ? "#b8adff"
                      : "#79d4e2"
                  }
                  opacity="0"
                />
              </g>
            ))}
          </svg>
          <div className="pipeline-inputs">
            <h3 className="sr-only">Local Dataset + Schema + User Question</h3>
            <div className="flow-card flow-input" data-node="dataset">
              <p className="flow-eyebrow">01 / LOCAL DATASET</p>
              <h4>revenue_example.csv</h4>
              <div className="flow-data">
                <span>Jul</span>
                <span>$120.00</span>
                <span>Aug</span>
                <span>$85.50</span>
                <span>Sep</span>
                <span>$44.50</span>
              </div>
              <span className="flow-chip">3 rows · browser memory</span>
            </div>
            <div className="flow-card flow-input" data-node="schema">
              <p className="flow-eyebrow">SCHEMA / METRIC CONTRACT</p>
              <h4>Defined before calculation</h4>
              <p className="flow-code">
                date → UTC
                <br />
                revenue → USD cents
              </p>
              <span className="flow-chip">Q3 2025 · revenue_sum</span>
            </div>
            <div className="flow-card flow-input" data-node="question">
              <p className="flow-eyebrow">USER QUESTION</p>
              <h4>“What is total revenue for Q3?”</h4>
              <p>One question. Explicit semantics.</p>
            </div>
          </div>
          <div
            className="flow-card flow-hypotheses"
            data-node="hypotheses"
            data-pipeline-stage
          >
            <p className="flow-eyebrow">02 / INVESTIGATION ENGINE</p>
            <h3>AI Hypotheses</h3>
            <div className="flow-inner">
              <span className="flow-chip">H1 · TESTABLE</span>
              <p>
                The Q3 total can be computed from the approved period and
                currency.
              </p>
            </div>
            <p>
              Consent-controlled reasoning.
              <br />
              Bounded operations and budget.
            </p>
          </div>
          <div
            className="flow-card flow-approved"
            data-node="approved"
            data-pipeline-stage
          >
            <p className="flow-eyebrow">03 / HUMAN APPROVAL</p>
            <h3>Approved Calculations</h3>
            <div className="flow-inner">
              <p className="flow-code">
                SUM(revenue_minor_units)
                <br />
                WHERE approved_q3_period
              </p>
            </div>
            <span className="flow-chip">✓ Inspectable contract</span>
            <details>
              <summary>Inspect calculation boundary</summary>
              <p>
                Restricted read-only SQL and fixed trusted Python templates. No
                arbitrary model-generated code.
              </p>
            </details>
          </div>
          <div className="pipeline-engines">
            <div className="flow-card flow-engine" data-node="duckdb">
              <p className="flow-eyebrow">04 / SQL PATH</p>
              <h4>DuckDB-WASM</h4>
              <p className="flow-code">12000 + 8550 + 4450</p>
              <strong className="flow-value">
                25000 <small>cents</small>
              </strong>
              <span className="flow-chip">3 included rows</span>
            </div>
            <div
              className="flow-card flow-engine flow-python"
              data-node="pyodide"
            >
              <p className="flow-eyebrow">04 / PYTHON PATH</p>
              <h4>Pyodide</h4>
              <p className="flow-code">Independent fixed template</p>
              <strong className="flow-value">
                25000 <small>cents</small>
              </strong>
              <span className="flow-chip">3 included rows</span>
            </div>
          </div>
          <div className="pipeline-output">
            <div
              className="flow-card flow-comparison"
              data-node="comparison"
              data-pipeline-stage
            >
              <p className="flow-eyebrow">05 / EXACT COMPARISON</p>
              <h3>DuckDB/Pyodide Comparison</h3>
              <p className="flow-code">
                25000 = 25000
                <br />3 rows = 3 rows
              </p>
              <span className="flow-chip">✓ Illustrative agreement</span>
            </div>
            <div
              className="flow-card flow-report"
              data-node="report"
              data-pipeline-stage
            >
              <p className="flow-eyebrow">06 / REPRODUCIBLE OUTPUT</p>
              <h3>Evidence Report</h3>
              <strong className="flow-value" data-report-value>
                $250.00 <small>USD</small>
              </strong>
              <p>Q3 total · H1 · paired evidence</p>
              <details>
                <summary>Inspect report provenance</summary>
                <p>CLIENT_REPORTED · illustrative agreement</p>
                <p>
                  Save explicitly to retain snapshots. Deterministic replay uses
                  zero LLM requests.
                </p>
              </details>
            </div>
          </div>
        </div>
        <p className="mt-6 text-xs leading-6 text-slate-400">
          Hand-derived synthetic illustration. Numerical agreement is
          client-reported; it does not establish causality or server
          attestation.{" "}
          <a href="/app" className="text-teal-200 underline underline-offset-4">
            Run your own investigation ↗
          </a>
        </p>
      </div>
    </section>
  );
}
