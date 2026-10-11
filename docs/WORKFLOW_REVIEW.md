# Engineering Workflow Review

Reviewed 2026-10-11 against public QueryCure main, shallow read-only checkout. Sources: [AGENTS.md](https://github.com/yuvrajsatyapal/QueryCure/blob/main/AGENTS.md), [current phase](https://github.com/yuvrajsatyapal/QueryCure/blob/main/docs/planning/CURRENT_PHASE.md), [phase template](https://github.com/yuvrajsatyapal/QueryCure/blob/main/docs/planning/PHASE_TEMPLATE.md), [learning](https://github.com/yuvrajsatyapal/QueryCure/blob/main/docs/engineering/LEARNING.md), [coding standards](https://github.com/yuvrajsatyapal/QueryCure/blob/main/docs/engineering/CODING_STANDARDS.md).

| Useful practice | Hypothron gap | Applied improvement |
|---|---|---|
| Start each session from live phase status | Roadmap described future work only | CURRENT_PHASE.md with gate status and next action |
| Tasks mapped to verifiable deliverables | No granular completion ledger | TASKS.md IDs, explicit evidence in reports |
| Planned/implemented file map | Module boundaries lacked live existence status | FILE_MAP.md updated as implementation lands |
| Central coding and test conventions | AGENTS carried too much procedural guidance | CODING_STANDARDS.md and references |
| Reports include executed commands, acceptance and failures | No phase report template | PHASE_REPORT_TEMPLATE.md and docs/reports/ |
| Learning tied to actual modules and exercises | Concept list had no implementation audit trail | SYSTEM_DESIGN_GUIDE phase study links and explanation contract |

Retain one Codex-first AGENTS.md; a duplicate CLAUDE.md would add maintenance without benefit. Existing EVALUATION.md, risk register, security and protocol documents already cover their areas, so no duplicate testing/security files were added. No QueryCure code, queue/worker topology, target/sandbox DB assumptions, no-FK conventions, key encryption, EXPLAIN controls, or commit/push policy is adopted.

Consistency findings: prior “no code authorized” status is obsolete; user now authorizes implementation. Public deployment criteria still require separate authorization. Roadmap honest-client false-verification criterion is clarified to match EVALUATION.md; forged paired browser outputs remain CLIENT_REPORTED. CSV example caps and opt-in saving stay unchanged. Accepted ADRs are design decisions; outstanding risks remain gates until measured.
