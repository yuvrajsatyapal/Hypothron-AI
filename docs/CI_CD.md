# Continuous integration

Phase 4.5 adds validation only. No deployment, publishing, release, provider key or production database is configured. Hosted acceptance was independently verified on2026-10-13 for [run38290929211](https://github.com/yuvrajsatyapal/Hypothron-AI/actions/runs/38290929211), tested commit `8bd118c5b6c6c297ea385b3cd7e0355ab3ed470e` on main; local and hosted evidence are recorded separately in [the report](reports/PHASE_4_5_CI_REPORT.md). Phase5 remains unstarted.

## Workflow architecture

[ci.yml](../.github/workflows/ci.yml) runs on pushes to main, pull requests targeting main and manual dispatch. Normal `pull_request` tests the GitHub merge ref. It never uses `pull_request_target`. New runs cancel older runs for the same branch/PR. There are no path filters or optional gates that let relevant changes silently escape validation.

[Architecture diagram](diagrams/phase-4-5-ci.html) shows dependencies and the separate disposable browser database. Static/backend/frontend use Ubuntu24.04 x64; browser uses the standard `ubuntu-24.04-arm` runner. Jobs run in separate virtual machines: their localhost ports and service volumes do not overlap.

| Job | Commands / responsibility | Timeout |
|---|---|---|
| static | `scripts/ci/static.sh`: actionlint+shellcheck, Ruff lint/format, strict mypy, OpenAPI drift, active network-guard subprocess tests | 10 min |
| backend | `scripts/ci/backend.sh`: isolated PostgreSQL readiness, migrations up/down/up, full pytest, sole head/schema inspection, network audit | 15 min |
| frontend | `scripts/ci/frontend.sh`: asset bootstrap/hash verification, full Vitest, strict app/executor TypeScript, formatting, executor+Next production build, generated-contract/lock drift | 15 min |
| browser | Needs all three above; own PostgreSQL, locked Chromium/library installation, production build, fresh test-only API/executor/Next services, full real Playwright suite | 30 min |

The first three jobs run independently. Browser waits so costly integration does not run when inexpensive gates already fail. Backend is not repeated in browser: it migrates a different clean database and tests integrated behavior. The frontend job needs runtime bootstrap because unit tests execute real Pyodide/Pandas. Browser also bootstraps once in its own fresh workspace. Sharing a large generated asset/build artifact would add another trust and compatibility boundary; the two independent verified bootstraps are intentional. Only browser installs Chromium.

The local x64 emulation attempt passed fast gates but exceeded an unchanged35s UI execution deadline. The browser target therefore uses native Linuxarm64; this is a documented runner choice, not a deadline increase or skipped test. The first hosted run confirms this browser runner assignment: native Linuxarm64/Chromium156.0.8078.4, all32tests passing in7.8min (browser job9m8s). Static/backend/frontend x64 jobs succeeded in21s/28s/58s. These are one-run observations, not performance guarantees or account quota measurements.

## Locked tooling and assets

Node22.22.3 comes from [.nvmrc](../.nvmrc), pnpm10.33.0 matches `packageManager`, Python3.12.15 matches `services/api/.python-version`; uv0.13.0 is explicit in setup-uv. `pnpm install --frozen-lockfile` and `uv sync --project services/api --frozen` install committed resolutions without updating the locks. The uv command includes development dependencies. All external actions use full verified commit SHAs, not mutable version tags. Tool version comments aid intentional upgrades. checkout7.0.1, setup-node7.1.0, setup-uv10.3.0 and pnpm/action-setup6.1.0 declare Node24 for the action runtime; this is distinct from application Node22.22.3. Their official release metadata/inputs were checked. [GitHub retired the Node20 action runtime](https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/), so older Node20 action pins were replaced before completion.

Playwright1.64.0, Chromium revision and web/Python packages derive from the committed locks. `pnpm exec playwright install --with-deps chromium` installs that library's browser and required Ubuntu libraries; a preinstalled runner Chrome is never silently selected. This is an independent native Linux arm64 browser CI target, not a reclassification of the Chrome154/macOSarm64 ADR015 acceptance record. Browser version/OS/architecture are logged before tests. Hosted runner OS patch levels and apt repositories still evolve; an Ubuntu label is not a bit-reproducible VM.

[scripts/bootstrap-assets.mjs](../scripts/bootstrap-assets.mjs) mirrors package-provided WASM/JS and the Pyodide0.29.3 Pandas wheel closure from jsDelivr. Wheel digests are checked against Pyodide's package lock; every resulting asset and runtime version is compared against [the committed manifest](../packages/contracts/runtime-manifest.json). Default bootstrap never rewrites this manifest. Changed/missing/extra/different assets fail. A reviewed runtime upgrade can explicitly use `--update-manifest`, followed by compatibility testing; CI never passes that flag. Download requests have a 60s deadline. Runtime assets remain ignored generated files. Executor build verifies hashes again before bundling.

## Disposable PostgreSQL and migrations

Backend and browser jobs each own a digest-pinned PostgreSQL17 Alpine service, no volume cache and port5432 mapped only inside their dedicated runner VM. The public test-only role/password/database are `hypothron_ci` / `ci-disposable-only` / `hypothron_ci`. They are fixtures, not GitHub secrets. DATABASE_URL is explicit. GitHub's `pg_isready` service health check precedes steps; [database.py](../scripts/ci/database.py) independently rejects every non-loopback/non-test database URL, checks server major17 and retries connection up to60 times with2s connect timeouts. It never prints the URL or raw connection errors.

Backend upgrades to head, downgrades to base and upgrades again before tests. These destructive migration checks run only after the test-target guard and only on the disposable service. [check-migrations.py](../scripts/ci/check-migrations.py) asserts one head, applied revision, expected application/native saver tables and column/nullability consistency. This is executable migration validation, not a claim of exhaustive autogeneration/type/index equivalence. Native saver setup owns its internal migrations, so an unfiltered Alembic autogeneration check would incorrectly propose dropping those tables. The full pytest suite then exercises real PostgreSQL ownership, fencing, recovery, retention, idempotency and negative cases; absent DB is a hard failure.

## Browser service lifecycle and external HTTP

[playwright.config.ts](../playwright.config.ts) activates CI behavior only with `HYPOTHRON_CI=1`. It uses locked bundled Chromium, one worker, zero retries and `forbidOnly`; starts Next production server on127.0.0.1:3000, credential-free executor on3001 and `services/api/tests/browser_server.py` on8000. The fixture passes `httpx.MockTransport` into the real app; planner/analyst/report HTTP is deterministic synthetic traffic through genuine adapter/graph/database code. Production `hypothron.api` is not the browser server entry point. `/v1/ready` requires migrated DB readiness; the existing investigation test additionally checks the fixture marker.

[check-ports.mjs](../scripts/ci/check-ports.mjs) rejects occupied ports before startup. `reuseExistingServer` is false in CI, so accidental existing servers cannot satisfy readiness. Exact origins preserve the real worker handshake/CSP tests. The complete suite runs DuckDB-WASM, Pyodide/Pandas, IndexedDB, bundle/replay and mocked-inference investigations. Playwright owns spawned services and terminates them after the run; GitHub destroys the service container with the job. No host service is stopped by scripts.

[scripts/ci/python/sitecustomize.py](../scripts/ci/python/sitecustomize.py) is loaded via PYTHONPATH before backend/fixture imports. It refuses non-loopback socket resolution/connect/connect_ex/sendto and appends only `CI_NETWORK_DENIED` to a job-local audit. Caught provider exceptions still leave evidence that fails the gate's EXIT audit. A boot assertion proves guard activation. Static probes verify external-host/direct-IP/UDP refusal and genuine loopback networking. Browser's [automatic fixture](../tests/e2e/fixtures.ts) refuses provider-domain requests and audits context requests even when a higher-priority route mocks them. An intentional failing test in `tests/ci/` proves this control; [probe-browser-guard.mjs](../scripts/ci/probe-browser-guard.mjs) succeeds only on the expected assertion failure. It never makes external HTTP because its page route fulfills synthetic content.

These controls prevent accidental application inference, not malicious repository-code bypass. Python native extensions can bypass patched Python sockets; browser subprocess/background/worker networking is not a blanket OS firewall. Independent compute-origin CSP tests remain required. Service workers are blocked. No CI provider keys or production secrets exist. Package/action/runtime installation legitimately needs network before validation. Do not describe this as total runner network isolation.

## Permissions, caches and diagnostics

Workflow permissions are only `contents: read`; checkout sets `persist-credentials: false`. No secrets expression, environment deployment, OIDC, privileged container or repository write exists. Fork PRs execute ordinary untrusted test code in disposable runners without production authority. Full SHA action pins and the actionlint1.7.12 archive SHA256 reduce mutable supply-chain inputs. They do not guarantee upstream code is harmless; reviewed updates and GitHub security patches are still necessary.

setup-node caches the pnpm content-addressed package store, keyed by runner/lock. setup-uv caches package downloads using the uv lock. Frozen installs and digest checks run after every restore. The first hosted run had cold caches and a non-blocking backend uv cache-save collision with static; both jobs passed. Cache reservation races affect reuse efficiency, never whether mandatory checks run. Warm-cache behavior remains unmeasured. No node_modules, .venv, browser profiles, runtime assets, datasets, database volumes or test-result caches are configured. This trades some bandwidth for fewer stale/native-runtime failure modes.

No artifacts are uploaded. Screenshots/video/traces are explicitly off because browser traces can include ephemeral synthetic keys, capabilities and dataset bodies. List output and sanitized gate errors identify failures. Linux evaluation output stays in ignored `test-results/`, preserving historical macOS report files. GitHub console logs are still retained according to repository/account settings; configure those externally before storing sensitive runs. Test fixtures are synthetic only. Keep new tests free of real secrets and avoid printing request bodies, headers or full environment dumps. Inspect transient local test files only within trusted environments.

## Reproduction

For a clean Linux workspace with isolated test DB:

```bash
pnpm install --frozen-lockfile
uv sync --project services/api --frozen
bash scripts/ci/static.sh
DATABASE_URL=postgresql+psycopg://hypothron_ci:ci-disposable-only@127.0.0.1:5432/hypothron_ci bash scripts/ci/backend.sh
bash scripts/ci/frontend.sh
pnpm exec playwright install --with-deps chromium
DATABASE_URL=postgresql+psycopg://hypothron_ci:ci-disposable-only@127.0.0.1:5432/hypothron_ci bash scripts/ci/browser.sh
```

Each gate is intended for a fresh job environment. If a guard audit exists, activation refuses to erase it; investigate the failure first. Local backend/browser runs need a fresh test-target database, never the development Compose volume. `static.sh` requires shellcheck and Python3 for verified actionlint installation. Production build must precede browser startup.

The isolated reproduction helper `bash scripts/ci/validate-linux.sh` requires tracked CI task files, Docker and network, creates two disposable containers without publishing any host ports, and copies only tracked source while excluding every `.env*` file and generated/ignored data. It uses the digest-pinned official Playwright Noble arm64 image, installs checksum-pinned Node/uv and locked dependencies, then runs the same gate scripts. Between backend and browser it validates the disposable target and downgrades to an empty schema; the browser gate upgrades again, matching the separate fresh service boundary in hosted jobs. It does not mount or edit the actual .git directory. Its temporary Git snapshot only enables drift checks inside the container. It removes only its own containers and temporary archive. Native Linuxarm64 execution on an arm64 Mac avoids cross-architecture emulation but remains a container under Docker Desktop, not a GitHub VM. On x64 Docker hosts the helper needs arm64 emulation and may exceed unchanged engine deadlines. The helper needs extra disk/network bandwidth for the image and Chromium downloads. It never pauses unrelated servers.

## Troubleshooting and cost

- **Workflow rejected:** run actionlint, verify full action SHAs and supported inputs. Shellcheck catches quoting/exit traps before runtime. Do not fix by suppressing arbitrary lint rules.
- **Database unavailable:** verify service health, explicit test URL and major version; reject real DB targets. Migration failure is a separate gate from numerical testing.
- **Manifest mismatch:** inspect lock/version/hash drift. Restore legitimate assets or intentionally review an upgrade; do not regenerate merely to hide tampering.
- **Browser cannot launch:** use locked `pnpm exec playwright`, install libraries and examine logged Chromium revision. Do not use a random installed Chrome or remove security assertions.
- **Port occupied:** use an isolated VM/container. Do not kill unrelated local processes. Server readiness failures should reveal which of3000/3001/8000 is unavailable.
- **CI_NETWORK_DENIED:** review mock injection and guard paths; the audit contains no destinations. A caught transport error can still fail the overall gate.
- **Slow engine startup/OOM:** inspect runner memory and one-worker behavior; preserve real engines and assertions. Prefer reducing unnecessary work over retries hiding a deterministic regression.

Four standard Linux jobs consume additive runner minutes. The browser ARM target is a standard hosted runner, not a paid larger-runner selection; [GitHub documents public/private ARM support and allowance eligibility](https://github.blog/changelog/2026-01-29-arm64-standard-runners-are-now-available-in-private-repositories/). Timeouts bound an ordinary run to at most70 job-minutes before overhead, not a measured typical charge. Browser waits on the parallel fast gates; cancellation saves redundant runs. Public/private repo allowance, free quotas and runner prices are account-dependent; no paid runner or billing change is configured. Asset/browser installs dominate cold bandwidth. Actual local timings and emulation limits belong in the report, not a fabricated hosted estimate.

CI proves the recorded synthetic regression gates for its measured environment. It does not prove public hosted origins, provider compatibility, mobile support, cloud retention, production secrecy, causal analytics or adversarial client attestation. Successful local commands and schema linting alone do not establish a successful GitHub Actions run. The recorded main-push run now provides independent hosted evidence at its tested SHA; PR/manual dispatch, concurrent cancellation and future runner revisions remain outside that one-run observation.

Primary references checked for this implementation: [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) for triggers/jobs/permissions; [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use) for CI authority and immutable actions; [Playwright CI](https://playwright.dev/docs/ci) for locked real browsers/Linux dependencies; [uv locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/) for frozen project installation. Repository code and the report own claims about actual Hypothron behavior.
