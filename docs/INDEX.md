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

Current implementation evidence: [Phase 1 report](reports/PHASE_1_REPORT.md) and [desktop measurement records](reports/PHASE_1_BROWSER_MEASUREMENT.json). Phases1–4 implementation is documented for the scoped local desktop target; Phase5 remains outside scope. Tracking lives in [CURRENT_PHASE](../CURRENT_PHASE.md), [TASKS](../TASKS.md), [FILE_MAP](../FILE_MAP.md) and [coding standards](../CODING_STANDARDS.md). The [workflow review](WORKFLOW_REVIEW.md) records adopted QueryCure process practices. Target protocol/replay schemas must be reconciled with actual implementations per phase; the implemented API has an exported OpenAPI contract, while replay bundles now use a documented strict frontend schema; generated shared TypeScript bindings remain later work.

Implementation teaching: [Phase 1 deep dive](learning/PHASE_1_DEEP_DIVE.md), [implemented architecture](diagrams/phase-1-architecture.html), [implemented sequence](diagrams/phase-1-sequence.html). These differ from the full target diagrams above.

Phase 2 evidence: [report](reports/PHASE_2_REPORT.md), [deep dive](learning/PHASE_2_DEEP_DIVE.md), [components/trust boundaries](diagrams/phase-2-architecture.html), [sequence](diagrams/phase-2-sequence.html) and [routing/recovery](diagrams/phase-2-routing.html).

Phase4: [report](reports/PHASE_4_REPORT.md), [comprehensive deep dive](learning/PHASE_4_DEEP_DIVE.md), [bundle v1 contract](INVESTIGATION_BUNDLE_V1.md), [persistence/trust](diagrams/phase-4-persistence.html), [Save transaction](diagrams/phase-4-save.html), [manifest model](diagrams/phase-4-manifest.html), [replay sequence](diagrams/phase-4-replay.html), [import/export failure paths](diagrams/phase-4-bundles.html), [fresh AI versus replay](diagrams/phase-4-modes.html). Phase3: [report](reports/PHASE_3_REPORT.md), [deep dive](learning/PHASE_3_DEEP_DIVE.md).

[Phase4 numerical regression observations](reports/PHASE_4_REGRESSION_EVALUATION.json) preserve the final measured fixture run separately from historical Phase3 results.
