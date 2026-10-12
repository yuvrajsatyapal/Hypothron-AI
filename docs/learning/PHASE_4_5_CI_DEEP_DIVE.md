# Phase 4.5: reproducible engineering gates

Read [the operational CI guide](../CI_CD.md), [completion evidence](../reports/PHASE_4_5_CI_REPORT.md), [workflow](../../.github/workflows/ci.yml) and [CI architecture diagram](../diagrams/phase-4-5-ci.html) together. This chapter teaches the decisions behind the actual implementation. Phases1–4 established local desktop behavior; Phase4.5 automates regression gates under a separately identified Linux target. Phase5 has not started. Earlier analytical/storage internals belong in the [Phase3](PHASE_3_DEEP_DIVE.md) and [Phase4](PHASE_4_DEEP_DIVE.md) guides.

## Why CI matters here

Continuous integration repeatedly integrates changes with an executable specification: dependencies install, code checks, migrations execute, and tests assert behavior in a clean environment. A successful run is evidence about a particular revision, environment and fixture set. It is not a declaration that all product requirements are satisfied.

Without CI, this project depended on manually remembered steps, a warm macOS runtime cache, installed Chrome and reused local servers. A stale worker bundle or an unrelated service could make a test exercise different code than intended. A developer could run TypeScript but forget genuine PostgreSQL recovery or zero-inference replay. Clean CI forces the repository to describe its own prerequisites.

CI/CD is an umbrella, not a requirement to deploy. Continuous delivery prepares validated changes for a deliberate release; continuous deployment automatically releases each qualifying change. Hypothron currently implements CI only. There is no deployment job, publishing token, production database or environment approval path. Separating validation authority from deployment authority preserves the user's explicit authorization boundary.

## GitHub Actions execution model

A workflow is a YAML event handler under `.github/workflows/`. `ci.yml` receives push-main, PR-main and manual events. A pull-request run validates the merge ref by default: this catches integration conflicts that checking only the feature head would miss. `pull_request_target` would run in a more trusted context and is deliberately absent because the repository executes contributor-controlled scripts.

A job is an isolated runner allocation; steps within a job share files, environment and service containers. Different jobs do not share a filesystem or localhost. `needs` constructs a directed acyclic graph, not a sequence of shell functions. Here static/backend/frontend use Ubuntu24.04 x64 and run independently; browser uses Ubuntu24.04 arm64 and starts only after all pass. [Standard ARM runners are available for public/private repositories](https://github.blog/changelog/2026-01-29-arm64-standard-runners-are-now-available-in-private-repositories/) without selecting a larger paid runner. A job failure leaves a named gate failure; dependent integration does not obscure an earlier lint failure.

A hosted runner is a short-lived VM with an evolving image. Ubuntu24.04 pins the OS family, not every apt library. The local reproduction uses an immutable Playwright Ubuntu Noble container with the browser job architecture and locked application toolchains; it is still not a native GitHub runner. Scheduling, Actions cache restores, merge-ref creation and service health orchestration are hosted behaviors that local validation cannot prove.

Steps use `bash` with strict shell failure handling. Shared scripts add `set -euo pipefail`, so a failed installation, missing variable or pipeline member stops the gate. Explicit frozen installation precedes application validation. `timeout-minutes` bounds whole jobs; per-test and startup deadlines bound narrower operations. These are complementary controls: a suite with many bounded tests can still exceed its total job budget.

## Dependency graph and efficiency

The diagram's three fast gates own distinct evidence:

1. Static catches workflow syntax, shell mistakes, Python defects and schema export drift.
2. Backend tests deterministic orchestration and real persistence in a disposable PostgreSQL.
3. Frontend tests numerical/runtime and browser-domain code, then builds production bundles.
4. Browser integrates the production app, real engines, fixture API/graph and a separate clean database.

A browser job depending only on frontend would waste minutes if backend already failed. Putting everything into one job would delay cheap static feedback and entangle failures. Duplicating a verified runtime bootstrap in frontend/browser is warranted because the Pyodide unit tests need assets and jobs are isolated. Downloading one huge generated artifact could reduce bandwidth but would add upload/download time, retention and artifact-integrity concerns. The chosen pipeline installs browser dependencies once, in the browser job, and avoids that artifact boundary.

Expected resource costs are structural, not benchmark claims: three parallel runner allocations plus one browser allocation, two clean DB services and two runtime bootstraps. One browser worker avoids concurrent Pyodide heaps and database races. Local x64 emulation passed the direct engine test but exceeded the unchanged35s UI deadline; native Linuxarm64 is the separately tested browser target. Fast x64 gates still provide cross-architecture install/build evidence. No deadline or assertion was relaxed. Zero retries expose unstable assertions instead of counting a lucky rerun as success. Concurrency cancellation discards obsolete branch/PR runs; it does not cancel another PR's evidence.

## Reproducibility is layered

The repository specifies Node22.22.3, pnpm10.33.0, Python3.12.15 and uv0.13.0. These versions are compatible with the existing locks; this phase does not upgrade analytical semantics. The Python minor matters because production uses Python3.12 syntax and compiled dependencies. The Node major matters for native esbuild/SWC modules and Pyodide's Node loader.

A dependency range in package.json is an allowed future selection. The lockfile records today's exact graph, resolved packages and integrity hashes. Frozen installation refuses disagreement between requested dependencies and the committed graph. uv similarly uses `uv.lock` plus the declared Python requirement; its project environment includes dev tools for CI. A lockfile does not freeze compiler CPU architecture, OS libraries, remote package availability or upstream registries forever.

Full action commit SHAs freeze reviewed automation code. Comments name the release for maintenance, but the executable reference is the SHA. PostgreSQL is pinned by content digest, not a mutable17 tag. actionlint is fetched from its official release with an independently recorded SHA256; extraction happens only after digest verification. Local reproduction uses pinned image/Node/uv hashes. These controls reduce substitution risk, but a malicious reviewed version remains malicious and package availability remains an external dependency.

Runtime assets add another graph: Pyodide's package lock enumerates Pandas, NumPy and dependent wheels; bootstrap checks each wheel and then compares all mirrored runtime files against `runtime-manifest.json`. WASM/JS bytes must also match, not only Python wheels. Executor build rechecks this manifest. Intentional changes require `--update-manifest` and review/replay compatibility tests; verification and generation are separate operations.

The immutable-manifest regression test first failed because `verifyManifest` did not exist. After implementation, altered and missing asset maps fail with `RUNTIME_MANIFEST_DRIFT`, while an identical manifest passes without mutation. Existing source-byte tamper tests independently fail `verifyAssets`. This Red→Green sequence protects a behavior, rather than just asserting that workflow text contains a preferred word.

## Service containers and migrations

A service container supplies a genuine dependency alongside a runner process. PostgreSQL17 lives for one job and is discarded afterward; no development Compose volume is mounted. Known public test credentials are safe precisely because the target is disposable and has no production authority. The database URL is explicit and validated before destructive migration commands.

`database.py` parses the URL and requires the exact test role/database/password, localhost literal, psycopg scheme and no query/fragment. It connects with a deadline, verifies server major17 and retries readiness. Sanitized failure codes avoid leaking a real URL if a future change misconfigures the target. PostgreSQL's service health check tells Actions when to start steps; the application readiness probe later proves the actual migrated schema is usable.

Alembic owns a versioned sequence of schema transitions. `backend.sh` executes upgrade-head → downgrade-base → upgrade-head against a fresh service before pytest. The reverse path is deliberately tested because reversible migrations can otherwise contain latent errors. It must never run against a development/production connection. Migration0002 invokes native LangGraph saver setup outside its application DDL transaction to support saver-owned concurrent indexes, then creates business tables. Downgrade drops both business and native saver state.

`check-migrations.py` loads Alembic's `ScriptDirectory`, requires one head and checks the DB revision, expected tables, column set and nullability. It does not assert full SQL type/index equivalence. An ordinary unfiltered autogeneration check sees native saver tables outside SQLAlchemy metadata and may propose deleting them; pretending that output is trustworthy would be dangerous. Model/type/index drift can be strengthened with an explicit ownership-aware comparison later. Current migration execution and real protocol tests remain mandatory.

Real DB tests cover session ownership, immutable attempts/jobs/results, unknown billing, fencing, crash reconciliation, retention and duplicate submissions. InMemorySaver routing tests remain useful but cannot replace these. Tests creating unique owners can share one disposable DB in a serial suite; parallelizing them later requires audited isolation assumptions.

## Real browser integration in a clean runner

Browser tests exercise facts that unit mocks cannot: actual worker startup, structured clone/MessageChannel, CSP, WASM compilation, Pyodide/Pandas behavior, IndexedDB transactions and reload, file input handling, runtime-compatible replay and production hydration. A browser launch alone proves none of these.

CI selects Playwright's lockfile-pinned Chromium instead of the macOS path. `install --with-deps chromium` installs browser binaries and Ubuntu libraries together. `HYPOTHRON_CI=1` selects production Next startup, no server reuse, one worker, zero retries and `forbidOnly`. Exact fixed127.0.0.1 origins retain the security contract; moving arbitrary ports would alter frame/worker trust rules and require separate tests.

`check-ports.mjs` binds each required port briefly and refuses conflicts before Playwright starts anything. That is an early diagnostic, not an atomic reservation across startup. `reuseExistingServer=false` gives a second safeguard if a process wins the intervening race. In hosted runners other project services are absent; the Docker reproduction shares only its own DB network namespace and publishes no host ports.

Playwright's three webServer entries start fixture API8000, executor3001 and Next3000. API `/v1/ready` must return healthy with migrated DB; the investigation test independently requires the test fixture marker. The fixture calls real `create_app` with deterministic `httpx.MockTransport`: native graph, ledger, SQLAlchemy and provider adapter serialization still execute. Mocking is located at the external wire boundary, not at the graph or database.

Full suite coverage includes 10 golden questions and12 adverse analytical fixtures, privacy/egress, invalid operations, consent/no-save, corruption, replay/cancellation, fresh histories and lost ACK recovery. CI evaluation output uses ignored `test-results/` and labels its target Linux, so it never overwrites the historical Chrome/macOS report or implies the earlier acceptance environment passed CI.

## Mocking and active network refusal

Missing provider keys is an inadequate guard. A developer may accidentally commit a dummy-looking valid key, a provider might allow anonymous calls, or a new adapter could read environment credentials. Mocking alone is also insufficient: a forgotten transport injection can construct a real client.

The test-only `sitecustomize.py` loads before Python imports through PYTHONPATH. It permits loopback IP/localhost and Unix sockets, refuses external resolution/connect/connect_ex/UDP sendto and writes only a fixed violation code. Guards do not log hostnames, prompts or credentials. An EXIT audit makes a swallowed `PermissionError` fail the overall gate. Activation refuses to discard an existing audit, preventing an earlier failure from being erased by a subsequent suite. A boot assertion detects absent guard loading.

Subprocess probes prove external DNS, directIP and UDP refusal, real loopback success and closed behavior without an audit path. Browser context routing aborts provider requests while an independent request listener records attempted calls. Auditing independently of fulfillment matters: page routes have priority over context routes, so a later mock could otherwise hide an attempted provider request. `tests/ci/provider-guard.spec.ts` intentionally fulfills a synthetic provider request and must still fail the automatic fixture. The probe wrapper accepts only that failure message/status, so startup failure is not mistaken for successful enforcement.

These are accidental-I/O defenses, not hostile-code isolation. Contributor code can unpatch Python functions; native libraries can avoid Python sockets; Playwright routing does not police every browser-internal/native-worker connection. Workers have their own tested CSP, service workers are blocked and no provider/production keys are supplied. A stronger runner firewall would need a measured design for package downloads, browser background requests, DNS, loopback services and privileged access. Claiming total egress isolation here would overstate the implementation.

## CI attack surface and authority

The threat is not only malicious application input. A contributor can alter test scripts, package lifecycle hooks or workflow commands. `pull_request_target` with checkout of contributor code and trusted credentials would turn that into secret theft or repository writes. Ordinary PR runners, read-only contents and no production secrets narrow the consequence. `persist-credentials=false` avoids leaving checkout's token in Git configuration for later scripts.

Caches cross executions, so cache only content-addressed package downloads. Never cache database volumes, browser profiles, raw datasets, request captures or mutable environment directories. A cache is a speed hint, not validation authority: restore is followed by frozen installation and integrity verification. The first main-push hosted run now confirms its read-only token permissions and cold-cache lifecycle; fork PR cache/permission behavior remains untested.

**Hosted lesson: cache publication is opportunistic.** [Run38290929211](https://github.com/yuvrajsatyapal/Hypothron-AI/actions/runs/38290929211) exposed a non-blocking uv cache reservation collision: static and backend finished with the same x64 lock-derived key, and only one could reserve the cache. Both installed frozen dependencies and passed all checks before saving. A shared cache key can avoid duplicate storage while causing harmless parallel writers to race; unique per-job keys avoid that warning but duplicate content and reduce cross-job reuse. Treat a cache-save warning separately from failed installation, hash verification or tests. The acceptance record retains the warning; it does not convert it into a false security failure or remove validation to silence it. This single cold-cache push does not establish future cache-hit or fork-PR behavior.

Failure artifacts can be more dangerous than ordinary logs. A Playwright trace may contain synthetic BYOK values, session capabilities, prompts and raw fixture rows. This implementation disables traces/screenshots/video and uploads no artifacts. It keeps console gate results and transient test-output files, with historical evaluation reports preserved. Repository/account log retention remains external configuration; the workflow does not invent a retention guarantee. Future sanitized artifacts need an explicit field/path review and bounded retention.

Job cancellation and timeouts bound infrastructure use but do not establish memory ceilings or provider cancellation guarantees. Discarded service containers ensure test DB retention ends with the runner. No such claim extends to production backups or cloud metadata.

## Actual file flow to read and reproduce

1. Read `ci.yml`: identify events, permissions, SHA references, services, env and `needs`. Draw which steps share a machine.
2. Read `static.sh` and `install-actionlint.sh`: trace untrusted archive → SHA verification → extraction → lint; explain strict Mypy config and shellcheck.
3. Read `database.py`, `backend.sh`, `check-migrations.py`: trace URL policy → readiness → migration cycle → pytest → schema inspection. Identify every destructive operation and its preceding guard.
4. Read bootstrap and `verifyManifest`/`verifyAssets`: enumerate bytes authorized by the runtime lock. Try corrupting one generated asset in an isolated copy and observe refusal.
5. Read `playwright.config.ts`, `browser.sh`, `fixtures.ts` and `browser_server.py`: trace version/build/startup/ports → real app/worker → mocked wire → audit. Explain why the production server must not replace this fixture.
6. Read `validate-linux.sh`: source-copy filter → disposable DB → network namespace → locked tools/dependencies → same gates → cleanup. It never touches user servers or mounts the user's Git directory.

Run the exact commands in the operational guide; counts/timings and environment limitations are in the completion report. The report is the evidence source. Hosted success must be recorded only after authorized push and actual GitHub run.

## Detailed interview questions

**What does this CI prove?** It proves named static, numerical, persistence and real-browser fixture gates on the recorded revision/environment. It does not prove deployment behavior, live LLM compatibility, mobile support or malicious-client numerical honesty. CLIENT_REPORTED remains client-reported even when both engines agree.

**Why four jobs instead of one?** Independent fast gates improve feedback and attribution; expensive browser integration waits on all. Each job's disposable machine avoids service/port/caching contamination. The trade-off is repeated checkout/setup and runtime bootstrap, accepted to preserve isolation and simpler provenance.

**Why test migration downgrade?** An upgrade can succeed while rollback fails or leaves native metadata behind. Up/down/up detects reversible-path defects before schema changes reach a release. The test database policy precedes destructive operations; production rollback requires separate operational approval and data-loss analysis.

**Why isn't a lockfile enough?** It fixes package selections/hashes, not runner OS libraries, browser architecture, package availability, runtime asset mirrors or malicious upstream versions. Tool/action/image pins plus runtime manifest checks address different layers. The action runtime can differ from app Node: final pins use Node24 automation while the tested application remains Node22.22.3. Retired automation runtimes require reviewed pin maintenance even if app dependencies stay unchanged. Frozen install catches drift rather than silently repairing it.

**How do you prevent accidental paid inference?** Real adapter HTTP is injected with MockTransport; no real keys exist; Python sockets refuse non-loopback and caught attempts fail via audit; browser provider requests are aborted/audited; negative probes prove activation. I explicitly disclose native/hostile-code bypass limits instead of claiming a complete firewall.

**Why use actual Chromium rather than jsdom?** Worker/CSP/WASM/Pyodide/IndexedDB and production hydration are runtime behaviors absent from DOM emulation. Unit tests remain faster for pure contracts/zip/storage algorithms, but cannot substitute for those engine integrations.

**Why not reuse local Chrome154 results?** OS, architecture, browser distribution and native dependencies are different. The Linux arm64 target needs its own locked browser run and measured support status. Local container validation still does not prove Actions orchestration or hosted quotas.

**How do you investigate CI failure without traces?** First identify the named gate and sanitized error; reproduce with locked tools and isolated synthetic fixtures. Inspect transient local output within a trusted environment. If a trace becomes necessary, review/redact fields and retention deliberately before upload rather than automatically retaining capability-bearing artifacts.

**How would you speed it up?** Measure cold/warm install and engine timing first. Cache verified package downloads, cancel obsolete runs and gate the expensive suite. Only introduce generated build/asset sharing after comparing transfer cost and designing compatibility/integrity checks. Do not remove genuine integration or add retries to conceal failures.

**Why are permissions specified at workflow level?** An explicit read-only baseline applies to all current/future jobs. Checkout credentials are not persisted. Adding a write/deploy permission would be visible in review and require separate authorization; test pipelines should not carry production authority by default.

**What remains before public release?** Hosted-run evidence and separately authorized real-origin TLS/CSP/worker/SSE/retention checks, broader evaluation and resource probes, live-provider compatibility if approved, and an explicit deployment design. Passing compilation and CI is necessary evidence, not a release certificate.

## Learning checklist and exercises

Must know before Phase5:

- Explain workflow/job/step/service runner isolation and the actual DAG without looking at YAML.
- Run frozen pnpm/uv installs; explain lock drift versus asset tamper and intentional regeneration.
- Trace real database readiness, migration cycle, native saver schema and test ownership.
- Trace a browser investigation from production UI through real graph/DB to mocked provider wire; distinguish it from saved zero-inference replay.
- Reproduce each network guard negative probe and explain caught-violation auditing.
- Explain normal PR versus trusted trigger authority, SHA pins, checkout credentials and cache/artifact risks.
- State Linux/container/macOS/hosted evidence boundaries accurately.

Production engineering next: measure hosted timings/resources; tighten ownership-aware schema comparison; audit log retention and dependency update policy; design actual-host origin/egress/worker/SSE tests; evaluate package/download outage behavior and graceful cancellation. All hosted/deployment actions require separate authorization.

Advanced exercises: design a nonprivileged network namespace that allows only the three localhost services after setup; model cache poisoning and integrity failures; compare a pinned generated-asset artifact against independent bootstrap; analyze migration rollback after partial native saver setup; plan nonflaky fixture isolation before raising browser concurrency.

Two-minute explanation: “We added four locked, read-only CI gates. Static, database and frontend checks run in parallel; full real-browser integration runs afterward with a new PostgreSQL and test-only mocked-provider API. Runtime assets must match the committed manifest, active guards refuse accidental inference, and no sensitive traces or deployment secrets are uploaded. We distinguish local Linux evidence from macOS acceptance and actual GitHub execution.”

Ten-minute explanation: start with the clean-environment problem and authority boundary, walk the job DAG and layered locks, follow migrations and native saver ownership, trace browser startup/real engines, demonstrate guard failure auditing, then discuss resource/cache/artifact trade-offs and unverified hosted/release guarantees. Use concrete files and report evidence, not broad claims of production readiness.
