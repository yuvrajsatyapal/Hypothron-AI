"use client";
import { useState } from "react";
const rows = [
  ["01", "2025-07-12", "120.00"],
  ["02", "2025-08-08", "85.50"],
  ["03", "2025-09-19", "44.50"],
];
export function SyntheticEvidence({ compact = false }: { compact?: boolean }) {
  const [view, setView] = useState<"evidence" | "data">("evidence");
  const [sort, setSort] = useState<"asc" | "desc" | null>(null);
  const sorted = [...rows].sort((a, b) =>
    sort
      ? (Number(a[2]) - Number(b[2])) * (sort === "asc" ? 1 : -1)
      : Number(a[0]) - Number(b[0]),
  );
  function exportCSV() {
    const url = URL.createObjectURL(
      new Blob(
        [
          "row,date_utc,revenue_usd\n" +
            rows.map((row) => row.join(",")).join("\n") +
            "\n",
        ],
        { type: "text/csv" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "revenue_example.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div
      className="rounded-xl border border-border-subtle bg-white shadow-glass-elevated"
      aria-label="Synthetic revenue example"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-5 py-4">
        <span className="font-mono text-xs text-on-surface">
          revenue_example.csv
        </span>
        <span className="rounded bg-brand-teal-light px-2 py-1 font-mono text-[10px] text-brand-teal">
          3 SYNTHETIC ROWS
        </span>
      </div>
      {!compact && (
        <div
          className="example-tabs"
          role="group"
          aria-label="Example notebook view"
        >
          <button
            aria-pressed={view === "evidence"}
            onClick={() => setView("evidence")}
          >
            Numerical evidence
          </button>
          <button
            aria-pressed={view === "data"}
            onClick={() => setView("data")}
          >
            Source data
          </button>
          <button
            className="example-export"
            onClick={exportCSV}
            aria-label="Export example CSV"
          >
            <span aria-hidden="true">↓</span> CSV
          </button>
        </div>
      )}
      {view === "data" && !compact && (
        <div className="example-source">
          <p>Illustrative synthetic example · three rows · USD</p>
          <table>
            <caption className="sr-only">Synthetic source data</caption>
            <thead>
              <tr>
                <th>Row</th>
                <th>Date (UTC)</th>
                <th
                  aria-sort={
                    sort === "asc"
                      ? "ascending"
                      : sort === "desc"
                        ? "descending"
                        : "none"
                  }
                >
                  <button
                    onClick={() => setSort(sort === "asc" ? "desc" : "asc")}
                    aria-label="Sort by USD"
                  >
                    USD{" "}
                    <span aria-hidden="true">{sort === "asc" ? "↑" : "↓"}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row[0]}>
                  {row.map((value, i) => (
                    <td key={i}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Source values used by the illustration. Sorting changes their
            display order only.
          </p>
        </div>
      )}
      <div className="p-5" hidden={view !== "evidence"}>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-on-surface-muted">
          Illustrative synthetic example
        </p>
        <div className="mb-5 rounded-lg border border-border-subtle bg-surface p-4">
          <p className="mb-2 font-mono text-[10px] text-brand-teal">
            HYPOTHESIS · H1
          </p>
          <p className="text-sm font-semibold">What is total revenue for Q3?</p>
          <p className="mt-2 text-xs leading-relaxed text-on-surface-muted">
            Approved contract: USD · UTC · July–September 2025
          </p>
        </div>
        <div className={compact ? "" : "example-computation"}>
          <div className="overflow-hidden rounded-lg bg-navy-night text-slate-200">
            <div className="border-b border-navy-border px-4 py-2.5 font-mono text-[10px] text-teal-200">
              INSPECTABLE CALCULATION · READ-ONLY SQL
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-6">
              <code>
                <span className="text-violet-300">SELECT</span>
                {" SUM(revenue_minor_units)\n"}
                <span className="text-violet-300">FROM</span>
                {" approved_q3_rows;\n"}
                <span className="text-slate-400">
                  -- 12000 + 8550 + 4450 = 25000
                </span>
              </code>
            </pre>
          </div>
          {!compact && (
            <div className="mt-5">
              <div className="mb-3 flex justify-between text-xs">
                <span className="font-semibold">Revenue by synthetic row</span>
                <span className="font-mono text-on-surface-muted">USD</span>
              </div>
              <svg
                data-example-chart
                className="h-28 w-full"
                viewBox="0 0 400 120"
                role="img"
                aria-label="Revenue: row one 120 dollars, row two 85 dollars 50 cents, row three 44 dollars 50 cents"
              >
                <path
                  d="M20 10v90h360M20 55h360"
                  stroke="#e3e9f2"
                  fill="none"
                />
                <rect
                  x="65"
                  y="20"
                  width="65"
                  height="80"
                  rx="3"
                  fill="#087f8c"
                />
                <rect
                  x="170"
                  y="43"
                  width="65"
                  height="57"
                  rx="3"
                  fill="#7565d9"
                />
                <rect
                  x="275"
                  y="70"
                  width="65"
                  height="30"
                  rx="3"
                  fill="#79d4e2"
                />
                <g fontSize="10" fill="#66758c">
                  <text x="83" y="115">
                    01
                  </text>
                  <text x="188" y="115">
                    02
                  </text>
                  <text x="293" y="115">
                    03
                  </text>
                </g>
              </svg>
              <details className="mt-2 text-xs text-on-surface-muted">
                <summary className="flex min-h-11 cursor-pointer items-center py-2">
                  View exact example values
                </summary>
                <table className="w-full text-left">
                  <caption className="sr-only">Synthetic source data</caption>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Date (UTC)</th>
                      <th>USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row[0]}>
                        {row.map((v, i) => (
                          <td key={i} className="py-2 font-mono">
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          )}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div
            data-example-result
            className="rounded-lg bg-brand-teal-light p-3"
          >
            <p className="font-mono text-[10px] text-brand-teal">
              DUCKDB EXAMPLE
            </p>
            <p className="mt-1 font-mono text-lg font-semibold">$250.00</p>
          </div>
          <div
            data-example-result
            className="rounded-lg bg-brand-violet-light p-3"
          >
            <p className="font-mono text-[10px] text-violet-ink">
              PYODIDE EXAMPLE
            </p>
            <p className="mt-1 font-mono text-lg font-semibold">$250.00</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-on-surface-muted">
          Hand-derived illustration. Open the workspace to run real
          calculations; this preview is not an executed investigation.
        </p>
      </div>
    </div>
  );
}
