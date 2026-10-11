# Phase N — Name

Date and status: in progress / gate blocked / complete. Link CURRENT_PHASE.md and relevant TASKS.md IDs. “Complete” requires every roadmap criterion; record independent safe work separately when a gate blocks advancement.

## Implemented behavior and code map

Describe user-observable behavior, owning paths and component interactions. Link actual code, not nonexistent planned paths.

## Decisions and alternatives

For each material choice: requirement → alternatives → chosen algorithm/architecture → trade-off → ADR. Distinguish adopted decisions from unvalidated assumptions.

## Acceptance evidence

| Roadmap gate | Pass / fail / not run | Test or measured artifact | Limitation |
|---|---|---|---|

## Validation

| Command and environment | Actual result | Scope / skipped checks |
|---|---|---|

Record representative Red and Green results and discovered regressions. No assumed timings, generic “all tests pass” without commands/counts, or mocked runtime presented as real.

## Mandatory learning and diagram gate

Create docs/learning/PHASE_N_DEEP_DIVE.md from actual code/tests. Cover: before/after problem and phase dependencies; technology internals/selection/production trade-offs; numbered execution flows with actual function names, inputs/outputs, authentication/validation/state/transaction boundaries; diagram-design component/sequence/data/trust/recovery diagrams where they clarify implemented behavior; algorithm examples/complexity/invariants; concurrency/resources/idempotency/security/reliability; actual test commands/counts and unverified guarantees; detailed interview answers, follow-ups, exercises and 2-/10-minute explanations; prioritized must-know/production/advanced checklists. Link earlier deep dives rather than repeating fundamentals. Update whenever significant code changes. A phase cannot complete without its deep dive, linked diagrams and diagram validation. Do not create imaginary later-phase implementation documents.

## Learning guide

Read these implementation files in order. For each: concept new relative to TypeScript full-stack experience, algorithm/invariant, flow/failure example, why alternatives differ, small study exercise and interview explanation. Cross-reference docs/SYSTEM_DESIGN_GUIDE.md; avoid explaining elementary syntax.

## Security and reliability

Implemented boundaries, negative tests, residual risk and trust/provenance limits. A passing client test is not server attestation.

## Resume / remaining work

Record tested-task local commit hashes on main without amending them.

Exact next task, required commands/services, known failures and architectural risks. Update CURRENT_PHASE.md, TASKS.md and FILE_MAP.md consistently. Continue automatically when gates pass; no phase approval prompt needed.
