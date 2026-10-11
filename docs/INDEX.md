# Documentation Index

The root documents define the product and baseline architecture. These supporting contracts elaborate behavior without duplicating application implementation.

| Document | Use |
|---|---|
| [Original specification](SOURCE_SPECIFICATION.md) | Preserved user brief; later explicit constraints and recorded resolutions refine it |
| [Execution protocol](EXECUTION_PROTOCOL.md) | Operation/job/result contracts, API sketches, budgets, recovery |
| [Verification and replay](VERIFICATION_AND_REPLAY.md) | Numerical policy, trust guarantees, bundle format and replay modes |
| [Risks and resolutions](RISKS_AND_RESOLUTIONS.md) | Conflicts resolved, remaining release gates and accepted limits |
| [Evaluation](EVALUATION.md) | Tests, golden fixtures, metrics/denominators and baseline comparison |
| [Deployment](DEPLOYMENT.md) | Provisional free-tier topology and mandatory live-host probes |
| [Validation](VALIDATION.md) | Documentation/link/diagram checks and their limits |
| [System-design guide](SYSTEM_DESIGN_GUIDE.md) | Interview reasoning and phase learning goals |
| [System architecture diagram](diagrams/system-architecture.html) | Browser/server/provider trust boundaries |
| [Execution sequence diagram](diagrams/execution-sequence.html) | Issue, interrupt, local computation, POST result and resume |
| [Diagram notes](diagrams/README.md) | Visual scope, styling and validation |

Current implementation evidence: [Phase 1 report](reports/PHASE_1_REPORT.md) and [desktop measurement records](reports/PHASE_1_BROWSER_MEASUREMENT.json). Phases 1–2 are implemented for the scoped local desktop target; Phases 3–5 remain planned. Tracking lives in [CURRENT_PHASE](../CURRENT_PHASE.md), [TASKS](../TASKS.md), [FILE_MAP](../FILE_MAP.md) and [coding standards](../CODING_STANDARDS.md). The [workflow review](WORKFLOW_REVIEW.md) records adopted QueryCure process practices. Target protocol/replay schemas must be reconciled with actual implementations per phase; the implemented API has an exported OpenAPI contract, while full replay-bundle/generated TypeScript bindings remain later work.

Implementation teaching: [Phase 1 deep dive](learning/PHASE_1_DEEP_DIVE.md), [implemented architecture](diagrams/phase-1-architecture.html), [implemented sequence](diagrams/phase-1-sequence.html). These differ from the full target diagrams above.

Phase 2 evidence: [report](reports/PHASE_2_REPORT.md), [deep dive](learning/PHASE_2_DEEP_DIVE.md), [components/trust boundaries](diagrams/phase-2-architecture.html), [sequence](diagrams/phase-2-sequence.html) and [routing/recovery](diagrams/phase-2-routing.html).
