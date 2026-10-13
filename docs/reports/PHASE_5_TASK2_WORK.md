# Phase5 Task2 — offline equal-budget evaluation

Status: PASS. Harness, fresh comparison and independent review complete; local milestone commit is recorded in the Phase5 report. Historical task observations below are superseded by the final acceptance entry. Existing main; no worker commit, external inference, network provider request, deployment or publication.

Scope is `.planning/specs/phase-5.md` / `.planning/plans/phase-5.md` Task2. Root owns the twenty hand-derived golden/twelve adverse fixture file and genuine browser measurement runner. This worker owns `services/api/src/hypothron/evaluation.py`, `services/api/tests/test_evaluation.py`, `docs/EVALUATION.md`, this report and the generated baseline report.

The single policy combines approved-contract selection and grounded reporting in one strict decision loop. The multi policy executes the genuine durable LangGraph driver with `RequestRoleProvider`, PostgreSQL ledger and fenced checkpoints. Both use mocked Gemini HTTP, model `gemini-test`, temperature0,12 attempted-call/1024 per-call output-token/6 job ceilings and the shared verification/reporting validators. The comparator reads observed plans/SQL/Pandas/diagnostics, validates their source identities and hand-derived ground truth, and never substitutes calculated or fabricated engine answers. Tokens/cost remain unavailable; orchestration latency excludes reused browser compute and is not a controlled performance benchmark. Twelve compiler/runtime rejection fixtures are separate from twenty eligible orchestration runs.

Validation so far:

- RED: `pytest -q services/api/tests/test_evaluation.py` failed collection because the new harness module did not exist.
- GREEN: initial five scoped tests pass, including a genuine PostgreSQL/driver/wire comparison. Seven scoped tests now cover approved input binding, malformed replies, attempted-call/job ceilings, duplicate/missing measurement populations, disagreement and unsupported causal/citation proposals.
- `ruff check services/api/src services/api/tests`: pass.
- `mypy --config-file services/api/pyproject.toml services/api/src`: pass,21 source files at this snapshot.
- `ruff format --check` on both task Python files: pass.
- `python scripts/export-api-contracts.py --check`: pass; harness adds no API surface.
- Full backend interim run:115 pass/1 fail,116 total. The failure was the independently owned new release-policy exception-sanitization canary; parent reports it subsequently fixed with16 focused operations tests. Full backend rerun will follow the browser measurement to avoid shared test-DB interference.

First PostgreSQL attempt failed while the isolated container was stopped; readiness/session checks and scoped retry passed after the parent restarted it. No policy or fixture was weakened.

Fresh engine report generated2026-10-13T12:12:17.601Z passes20golden/12adverse. Source SHA256 `1ffe9d0f15d4730276a3f2505d125366647d2ee1f248c595fef4151d2f4bcc02`; fixture SHA256 `4134cef5b0b33ca168e759131ac064606edaec51a209539b3bf38fda271c732a`. The comparator invocation documented in `docs/EVALUATION.md` completed at2026-10-13T12:13:26.262287+00:00 and generated `docs/reports/PHASE_5_BASELINE.json`.

Both policies:20/20 correct expected completion, evidence and status;20/20 independently checked findings;18VERIFIED/twoINCONCLUSIVE;0/18 false VERIFIED;18 validated total claims. Calls40 single/80 multi. Twenty-sample median orchestration latency2.318ms single/205.770ms multi, with p95 unavailable and no controlled performance claim. Tokens/cost unavailable. All engine/runtime/allocation values in the comparison are copied from the referenced measured source.

Final backend rerun after the operations canary fix: `source /tmp/hypothron-phase5-env.sh && services/api/.venv/bin/pytest -q services/api/tests` —116 passed in3.82s, including seven baseline tests. Scoped Ruff, strict mypy21files and OpenAPI drift check pass. A subsequent global Ruff check found new operations-owned import/broad-exception diagnostics in release_policy/retention; parent notified for the owning worker to resolve before phase gates. No task-owned lint failures.

Equal scripted correctness cannot establish multi-agent superiority, live-provider quality or public-release readiness. Regenerate the baseline if the root replaces its source browser report, so source digest and measurements continue to refer to the same run.


Final acceptance: full backend118passed4.14s with genuine disposable PostgreSQL17 migrations/schema and active network guard; frontend/executor113units/19files; all39production Chromium tests passed7.4min. Fresh browser20golden/12adverse and prior10golden/12adverse remain separately recorded, without rewriting historical Phase3 artifacts. The regenerated baseline was executed under the active CI network guard against the disposable CI DB. Both policies retain20/20 correctness/completion/coverage,18VERIFIED/twoINCONCLUSIVE,0/18falseVERIFIED and40/80calls. Latest20-sample orchestration medians2.894ms/248.578ms; no controlled/live-model superiority claim. Independent implementation reviews ACCEPT. Canonical final artifacts and limitations are linked in [Phase5 report](PHASE_5_REPORT.md).
