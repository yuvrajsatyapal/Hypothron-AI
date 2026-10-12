# Phase 4.5 CI implementation plan

For agentic workers: execute sequentially with Red→Green→Refactor; independent reviewer at final Gate3.5. User authorization overrides routine confirmations/branch/PR defaults.
Goal: reliable locked CI, isolated Linux evidence and honest completion on main; stop beforePhase5.
Architecture: independent static/backend/frontend jobs; browser depends on successful fast gates, owns disposable PostgreSQL and one runtime bootstrap/browser installation. Shared shell scripts reproduce gates. Test-only socket/browser guards own outbound refusal; production provider code remains unchanged.
Stack: Ubuntu24.04 x64 fast gates / native arm64 browser gate, Node22.22.3, pnpm10.33.0, Python3.12.15, uv0.13.0, Playwright1.64.0, PostgreSQL17, actionlint1.7.12.

## T4.5.1 Test harness integrity
Files: scripts/bootstrap-assets.mjs, scripts/tests/assets.test.ts, scripts/ci/python/sitecustomize.py and its tests, playwright.config.ts, tests/e2e/fixtures.ts and imports.
- [x] RED immutable manifest tamper/missing/different source rejection; outbound socket refusal with caught-violation audit.
- [x] Bootstrap verifies committed expected manifest by default; explicit update only for intentional runtime changes. Guard permits loopback/Unix only; audit contains fixed code, never destination/key.
- [x] Explicit CI Chromium/production startup, no server reuse, retries0/workers1/no screenshots or traces. Auto browser provider guard and readiness/port preflight.
- [x] Unit/type/format/guard regression validation and local task commit.

## T4.5.2 Workflows and Linux validation
Files: .github/workflows/ci.yml, scripts/ci/*.sh, .nvmrc, workflow test/policy checks as needed.
- [x] Pin official actions to verified commits, setup versions, service image digest and actionlint archive checksum. Cache only verified package stores; no asset/browser/database caches.
- [x] Four bounded jobs; frozen dependency install; full static/backend/unit/build/browser gates and migration upgrade/check/downgrade/upgrade on fresh DB.
- [x] Run actionlint including shellcheck; locked install and complete suites in isolated native Linux arm64 container (x64 emulation separately recorded as failed). Report real browser version/arch; guard negative probes. Correct failures without weaker assertions.
- [x] Local commit after gates validated. Hosted execution explicitly unverified.

## T4.5.3 Documentation and final review
Files: docs/CI_CD.md, learning/PHASE_4_5_CI_DEEP_DIVE.md, reports/PHASE_4_5_CI_REPORT.md, diagrams/phase-4-5-ci.html, CURRENT_PHASE.md, TASKS.md, FILE_MAP.md, ARCHITECTURE.md, DECISIONS.md, SYSTEM_DESIGN_GUIDE.md, ROADMAP.md.
- [ ] Explain actual code flow, trust boundaries, commands, learning/interview/trade-offs and remaining hosted/runtime limits.
- [ ] Diagram skill self-check plus browser geometry/scroll validation; local doc links.
- [ ] Independent engineering/security Gate3.5 review, fix and rerun affected gates; record task hashes and local conventional commit. Stop beforePhase5.
