# SaaS implementation — 2026-10-15

Status: local feature implementation and regression gates pass; external production sign-off remains blocked by the live-service and final-image checks below. **Not a public production-readiness acceptance.** No deployment, push, paid inference, live Google login or external object upload occurred.

## Scope and preserved behavior

The user approved free-model selection first, durable approval-gated fallback second, and the missing account/persistence/operations work in one run. Existing Next.js/FastAPI/LangGraph/PostgreSQL and real browser numerical computation are reused. Gemini, exact verification, bounded jobs, raw-data-local defaults and zero-inference replay remain the intended compatibility boundary. Existing unrelated UI/animation edits were preserved. Existing main only.

## Implemented changes

- OpenRouter catalogue discovery with bounded parsing, short in-memory cache, refresh coalescing/backoff, zero advertised text prices, required schema parameters and capacity/expiry checks. Auto resolves to a concrete preview; manual selection is server-validated. The genuine public catalogue GET returned eligible models without keys or inference. Listing is not account access, endpoint availability or quality proof.
- Dispatch requires strict supported parameters, one concrete model, disabled upstream fallback and zero prompt/completion/request price ceilings. Model mismatch responses are refused. Definitive rate/model rejection pauses; an explicit owner-scoped approval records model revision/history and resumes the same PostgreSQL-backed LangGraph thread. Consumed budgets stay consumed; ambiguous billing reservations cannot be retried through approval.
- Password signup/login, salted scrypt hashes, independently revocable opaque 24-hour bearer capabilities and stable account ownership. Tokens stay in frontend memory; reload requires login. Existing anonymous local mode remains. Google code/PKCE/state/nonce/signature/audience/verified-email validation, path-bound flow cookie and single-use completion exchange are implemented; no implicit email account linking. Password hashing and OAuth transport have bounded admission/payload/time policies.
- Explicit account Save retains sanitized metadata/report/evidence/protocol state in PostgreSQL independently of expiring active runs. History retrieval, logout/login continuity and owner-scoped deletion are implemented. Raw snapshots are absent from metadata history.
- Optional private cloud bundles require separate explicit consent, account ownership, bounded uploads, quota reservations, private-bucket checks and SSE AES256. Cloud is disabled unless configured. Durable PENDING intents reserve quota before an external write. Pending work cannot be publicly deleted based on elapsed time; interrupted intents require stopped-worker reconciliation. This prevents deleting an intent while an uncertain external PUT can still complete. S3-compatible services lacking the required privacy/encryption APIs fail closed.
- Existing workspace controls gained account login/history, discovered model choices and explicit fallback approval. Switched local artifacts use manifest v3 with original/current model lineage; legacy v1/v2 remain accepted. Raw datasets still require explicit local Save or separately consented cloud bundle upload.
- Hardened API/web/executor images, production Compose, exact configurable origins, safe dotenv launcher, private backup and disposable restore scripts, deployment validation and CI static-gate integration. Production executor remains credential-free and on a distinct hostname. No infrastructure was provisioned.

## Evidence recorded so far

| Check | Actual observation |
|---|---|
| Backend final full suite | 169 passed in 10.50s against disposable PostgreSQL 17.11 at loopback 55433 |
| Provider/catalogue/graph/ledger/recovery subset | 98 passed against real PostgreSQL; includes approval race and billing-unknown rejection |
| Frontend/executor units | 119 passed across 21 files, including real Pyodide/Pandas; this working-tree run also includes the two preserved pre-existing trace tests |
| Production host build / TypeScript | Final build and strict TypeScript passed after account-history guard and accessible model-label fix |
| Account signup/session/logout on actual app | 1 integration test passed |
| Auth/history regression | Included in final 169-test suite, including raw OAuth encoding and upload/hash admission refinements |
| Final independent security tests | Raw compressed OAuth rejection, hash admission/cancellation, upload admission and private/encrypted SDK protocol checks passed; external HTTP/store doubles are explicit |
| Containers | API, web and executor image builds plus nonroot/read-only service smokes passed; final web public-font COPY correction was not re-imaged before disk pressure stopped builds |
| Backup restore | Actual custom-format dump restored in network-isolated PostgreSQL: schema 0006_cloud_intents, 15 public tables |
| Production-browser workflows | 41 distinct cases passed across focused runs. First group: 7 passed/1 model-label failure. Broad group: 29 passed/2 failures (Gemini form recovery and cleared provider error). Those regressions were reproduced and fixed; final group: 6 passed in 3.2min including account privacy, Gemini recovery, approved model switch/v3 Save, both golden suites and performance. |

Two independent security review rounds found unbounded auth work, OAuth decompression, cloud admission/orphan/delete races and stale account UI writes. Fixes were added. Final scoped independent security review ACCEPT; reviewer separately ran 4 targeted tests successfully. Tests with mocked external provider/OAuth/S3 boundaries are not reported as live service validation.

## Remaining blockers and limitations

1. **Live inference approval.** Automatic approval review rejected the prepared one-request OpenRouter smoke because it sends the configured key for external inference, and zero-price settings do not independently guarantee billing. No request, retry or workaround occurred. Explicit approval is required before invoking the prepared smoke. Catalogue discovery is genuine but is not account access or complete investigation acceptance; even a successful connection probe would not establish model quality.
2. **Live Google and account lifecycle.** The signed-token/PKCE/state tests are not a real Google browser consent/callback flow. Actual-origin cookie behavior needs testing with the configured client. Password email verification/recovery and automatic linking are not implemented; Google refuses implicit linking by email.
3. **Real private storage.** No external S3 upload/download/delete or pending-intent reconciliation was performed. Keep cloud disabled until private-bucket policy, encryption, lifecycle/backup retention and stopped-worker reconciliation are proven. SDK tests are explicit doubles. Compatible services must support the required public-access-block and SSE AES256 APIs; unsupported services fail closed.
4. **Final release images.** API/web/executor image builds and read-only nonroot smokes passed during implementation. A final web public-font COPY correction and later source fixes were not re-imaged after repeated host disk exhaustion stopped builds. Rebuild from final source with adequate disk space before release; do not promote prior local images as this final source revision.
5. **Actual deployment gates.** The configured user database was not migrated or used for tests. Actual-host HTTPS, worker egress/CSP, CORS/cookie boundaries, reverse-proxy/SSE/cold starts, distributed abuse controls, backup encryption/off-site scheduling and hosted recovery/CI remain unverified. No deployment, push, resource purchase or paid inference was authorized or performed.

## Operation and configuration

See [deployment instructions](../SAAS_DEPLOYMENT.md), [approved design](../superpowers/specs/2026-10-14-openrouter-free-models-design.md), [implementation plan](../superpowers/plans/2026-10-14-saas-implementation.md), and [environment template](../../.env.example). Real `.env` values were never printed or committed. Only optional model-policy defaults were appended to the private file; existing values were preserved. `OPENROUTER_API_KEY` in that preparation file does not activate shared server-funded inference; the application retains request-scoped BYOK.

Local tested task commits: `5606ecb` (backend/accounts/provider), `2018b77` (frontend/account/model integration), `255de50` (containers/origins/backup tooling). Final evidence documentation is a subsequent commit. Selective staging excluded the pre-existing trace/notebook/header/CSS/landing/report edits, including changes overlapping the investigation component; private-value scans passed. No history was amended and nothing was pushed.


## Final local verification detail

- Final backend: `pytest services/api/tests -q` — 169 passed in10.50s against isolated PostgreSQL17.11. Ruff/format51Pythonfiles, strictmypy26sourcefiles and generated OpenAPI drift checks pass.
- Final web/executor:119unit tests pass, strictTypeScript and productionNext/executor build pass. Global Prettier identified one task-owned release-probe wrapping issue; fixed and full format check then passed. Its four HTTP-boundary tests also pass.
- Deployment policy tests4pass; ShellCheck for CI/deployment/launcher scripts, Actionlint, pinned runtime verification and four active Python network-guard probes pass. The guard's initial sandbox loopback denial passed when rerun with explicit local-socket permission. No hosted CI was triggered.
- Fresh, separate migration database: upgradehead → downgradebase → upgradehead passes; inspection confirms one head and exact application/native-saver column/nullability coverage. The configured user database was neither migrated nor used for tests.
- Real engines: Phase3golden/adverse22/22 pass and Phase5golden/adverse32/32 pass with0falseVERIFIEDadverse findings. These deterministic fixtures do not establish live model accuracy. [Phase3 observations](SAAS_PHASE_3_REGRESSION.json), [Phase5 observations](SAAS_PHASE_5_EVALUATION.json), [performance observations](SAAS_PHASE_5_PERFORMANCE.json), [viewport checks](SAAS_RESPONSIVE_REGRESSION.json).
- The10,000-row observation recorded import/hash388ms, executionUI4477ms, replay4368ms and322806-byte bundle. Tracked allocations exclude runtime overhead and are not peak-heap bounds. Historical Phase5files were preserved byte-for-byte around these test writes; new observations have task-owned names.
- Current main retains unrelated user edits. Docker's disposable local fixture remains available; API/web/executor test processes exited. User `.env` is ignored,0600 and contains only the existing values plus optional discovery-policy defaults. No external credentials appear in commits.
