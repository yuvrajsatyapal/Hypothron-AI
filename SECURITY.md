# Hypothron AI — Security and Privacy Design

Status: required controls, not an implemented security certification. A public release must satisfy the gates below. Security contact is not configured yet; do not send credentials or private datasets through public issues.

## Threat model

Protect datasets, questions, aggregate evidence, provider credentials, session capabilities, persisted artifacts and compute budgets. Adversaries include malicious dataset content, prompt injection, malicious model output, modified browsers, hostile imported bundles, compromised runtime assets and unauthorized API clients. Browser owners can forge local results; the public design does not solve remote execution attestation.

| Threat | Required enforcement | Residual risk |
|---|---|---|
| Generated code steals keys/data | Allowlisted operation IR, trusted templates, credential-free execution origin, egress CSP | Same-origin app XSS can still reach keys held in app memory |
| Forged browser numerical results | Job ledger/schema/provenance checks; local independent recomputation | Client can forge both outputs; no server truth claim |
| Dataset/model prompt injection | Data treated as content, typed output validation, deterministic permissions, consent | Bad hypotheses and prose remain possible; evaluate them |
| Session/tenant escape | Opaque capability, owner checks on every endpoint, negative tests | Capability theft grants its bounded session access |
| Browser resource exhaustion | Size/expansion/job limits, timeout, worker termination | No portable hard worker-memory cap; tab crash remains possible |
| Leaked aggregates/checkpoints | Egress preview, bounded aggregates, redacted state/logs and retention | Inference from aggregate or schema is possible |
| Imported bundle attack | Size/schema/version checks, archive expansion limits, regenerated allowlisted code | Hashes do not establish a trustworthy author |
| Malicious runtime dependency | Lockfiles, mirrored/pinned assets, reviewed upgrades, dependency scanning | Supply-chain compromise cannot be eliminated |

## BYOK lifecycle

Keys are entered into an in-memory app field, sent over HTTPS directly to FastAPI in an authorized request body or protected header, and used by a request-scoped provider client. Do not put keys in URLs, cookies, local/sessionStorage, Dexie, PostgreSQL, LangGraph configuration, prompts or exported bundles. Prefer per-call/segment submission with no server credential cache. Require re-entry after reload/restart; do not silently lose a run or persist a key to enable recovery.

Keep the key only while the user authorizes the active session; clear app references on disconnect/lock and server references on request completion/cancellation. Python/JavaScript cannot guarantee physical memory zeroization. Mask the UI and disable request-body logging at app, proxy, tracing and error-reporting layers. Avoid serializing provider client objects. Provider error payloads must be sanitized before display/logging; test with canary keys.

Provider IDs map to fixed HTTPS upstreams. Reject user-supplied base URLs, redirect targets and model-supplied headers. OpenRouter routing options must be disclosed; it may involve a downstream provider. Users authorize provider/model selection, aggregate disclosure and maximum budgets; price estimates are not billing caps. Unknown pricing is labeled unknown and does not qualify for a hard dollar budget. Never fall back from free to paid automatically.

## Restricted execution design

The public executor accepts **typed analytical operations only**. Trusted compilers produce SQL and fixed Python templates. No eval/exec of LLM-authored source, arbitrary imports, AST-only Python “sandbox,” subprocess, package installation, UDFs, filesystem discovery or network tools. Imported saved code is an inspectable artifact, never an execution authority.

Allow analytical joins, filtering, grouping, reductions and a small supported statistics set. Deny DuckDB ATTACH, COPY to external destinations, extension install/load, HTTP/file readers, arbitrary pragmas/configuration and dynamic function invocation. Reading local selected bytes uses registered logical dataset IDs. A SELECT statement can still invoke unsafe table functions; read-only syntax alone is insufficient. Compile from an allowlist and inspect resulting AST/function names. DuckDB recommends treating untrusted SQL as a resource/security risk: [security guidance](https://duckdb.org/docs/current/operations_manual/securing_duckdb/overview).

Host the execution document on a separate static origin with no app cookies, auth routes or secrets. It creates dedicated workers for pinned runtimes. The app verifies the host origin/source during a bootstrap handshake, transfers a dedicated MessageChannel and validates typed messages, run nonce, job ID and expected size. Do not use wildcard postMessage for routine communication. Apply an iframe sandbox with only capabilities proven necessary; if same-origin capability is needed inside the execution origin for workers, document why that distinct origin remains credential-free. No popups, top navigation, forms or downloads from execution code.

Workers have no direct DOM access but are not a complete security sandbox. Pyodide provides Python/JavaScript interoperability; [worker documentation](https://pyodide.org/en/stable/usage/webworker.html) supports off-main-thread execution, not credential isolation. Never send a key, app session token or unrestricted host callback to a worker.

Apply CSP to the execution document **and worker script responses**. Planned policy denies outbound connections, permits only pinned script/WASM assets and approved bootstrap resource fetches, and disables frames/navigation beyond required host behavior. WASM-specific CSP allowances belong only on the execution origin. Runtime package bootstrap may require network access to a fixed asset origin: no arbitrary code runs then, and public operations cannot trigger new imports or URLs. Mirror dependencies on a credential-free asset origin if needed. Test that a static asset allowance does not become an upload/logging exfiltration channel. A separate origin or monkey-patched fetch alone does not prevent dataset exfiltration.

The exact CSP/iframe/package-loading combination is a Phase 1 spike and public-release blocker. If compatible runtimes cannot operate under these restrictions, narrow supported analytical operations/runtimes or keep public execution disabled until resolved. Do not relax into arbitrary generated execution to make a demo work.

Set wall-time limits, output caps and terminate/recreate workers on cancellation. Bound decoded data, joins and group cardinality; restrict Cartesian joins. Record resource failures as failures or INCONCLUSIVE evidence, never zeros. A public user may inspect operation source but cannot edit and execute arbitrary code through the platform.

## XSS and rendered content

React-escape all dataset values, file names and model text. Disable raw HTML in Markdown; sanitize any necessary rich rendering with a maintained allowlist sanitizer. Never use dangerouslySetInnerHTML for model/dataset content. Reject javascript/data URLs and unapproved link schemes; use safe external-link attributes. Chart specs are typed data referencing known fields, never executable callbacks or arbitrary SVG/HTML. Tooltip values are text.

Application CSP uses restricted script sources/nonces as appropriate to Next.js and no general unsafe-eval. Treat artifact import as hostile even if exported by Hypothron. Prevent CSV spreadsheet formula execution in exports with a documented safe-export mode; preserve raw source snapshots separately so sanitization does not change replay inputs. Reject path traversal, archive bombs and deeply nested metadata.

## Data transmission and retention

“Local dataset processing” does not mean “no data leaves the browser.” User questions, column names, metric definitions and approved aggregates may be sensitive. Before inference, show categories and a bounded preview of outgoing context. No row samples by default. Expanded disclosure needs explicit per-run consent, is outside the initial default flow and must be recorded. Do not automatically send identifiers/high-cardinality categories as aggregates. No claim of anonymization or differential privacy.

| Data | Default storage and lifetime | Deletion / limitation |
|---|---|---|
| Raw snapshots and previews, unsaved | Browser memory only; until close/reload/reset | Release buffers and workers; browser/OS memory recovery is outside guarantees |
| Saved snapshots/bundles | Dexie only after explicit Save; until user deletes/site eviction | Delete records and orphan blobs transactionally; export is an independent copy |
| BYOK keys | Browser active-session memory and API request memory only | Clear references on disconnect/completion; no physical zeroization claim |
| Checkpoints, approved aggregates, questions | PostgreSQL transient run state; expire 24h after last activity with 7-day absolute maximum | Logical access ends at expiry; scheduled/lazy purge target within next 24h |
| Demo session capability records | Expire after 24h inactivity; renew only within policy | Expired resources inaccessible; underlying rows follow purge |
| Redacted operational logs | 7 days target; metadata/errors only | No request bodies, raw rows, keys or full prompts; verify host log settings |
| Exported bundles | User filesystem/share destinations | App cannot revoke external copies |
| Provider inputs | External selected provider policies | Display current provider policy links; app cannot promise deletion there |
| DB backups/host copies | Hosting-provider policy, to be documented before release | Logical deletion does not instantly erase backups; show actual maximum retention |

Transient server persistence is separately disclosed before starting an investigation; it does not imply consent to local Save or cloud artifact sync. User deletion immediately tombstones resources, invalidates run/session access and queues purge. A sleeping host may delay physical purge: enforce expiry on every read, purge on startup/access, and use provider scheduling if available. Do not advertise a physical-deletion SLA until measured. Backend checkpoints cannot recover lost unsaved dataset bytes.

## API and operational controls

Use unguessable server-issued demo capabilities with expiry and HttpOnly Secure session cookies where workable. Prefer explicit trusted-origin requests; enforce CSRF tokens/origin checks for cookie-authenticated mutations. CORS is not authorization. Avoid URL tokens for SSE; use authenticated fetch streaming when headers are required. Cross-site cookie restrictions across hosting domains must be tested; a short-lived in-memory bearer design is an alternative ADR, never a query token workaround.

All run/job/event endpoints enforce ownership, expiry, payload caps and rate limits. Reserve deployment concurrency and budget increments atomically in PostgreSQL. Enforce a global ceiling even across many anonymous sessions; add challenge-based abuse prevention only if measurements require it. Use fixed database roles, migrations and secret environment variables; never expose database URLs as NEXT_PUBLIC values.

Security gates: canary secret scan of logs/checkpoints/exports; cross-owner replay/submit rejection; forbidden operation and outbound network tests in real browsers; XSS fixtures; resource/cancellation tests; bundle import attacks; deletion/expiry tests. Incident response: disable affected capabilities, revoke session access, notify affected users using established channels, rotate deployment credentials, preserve only redacted evidence, and record the issue without private data. Provider keys are user-owned and require user rotation after a confirmed exposure.

## Current Phase 1 implementation evidence

The local static host performs dataset-free fixed-asset bootstrap. Hashes are checked for embedded JS at build time and for binary/package buffers before readiness; only then does the app transfer a dataset. Worker responses apply `connect-src 'none'` and `script-src 'wasm-unsafe-eval'` without a script origin allowance. Trusted JS is bundled, and runtime fetch resolves preloaded buffers. Native XHR/fetch/script-import negatives pass in actual local Chrome; this is CSP isolation, not a claim that monkey-patching fetch is sufficient. The main compute worker is allowed the fixed DuckDB child URL; the child denies further workers. Child-worker native XHR and wrong-origin/sibling-source bootstrap rejection now pass; deployment origin/header tests remain pending. See ADR-013 and the Phase 1 report.

The 10 MiB source cap, conservative 128 MiB expansion estimate, bounded rows/columns, measured dataframe/tracked-SQL allocation checks and 30 s host / 35 s bridge deadlines are implemented. Whole-browser sampled RSS is separately measured and substantially larger than dataset allocations; neither measure proves a hard heap bound. Mobile hardware and large-input resource gates remain open. The API's currently implemented metadata endpoints accept at most 16 KiB including chunked bodies; later protocol endpoints need their own approved bounded contracts.

BYOK, investigation/checkpoint retention, job authorization, Dexie, import/export, XSS report rendering and hosted abuse controls remain unimplemented. Existing session tokens expire at creation +24h without renewal (ADR-014); the target inactivity renewal and full run-retention policy above is not yet implemented. The local compose database uses development-only credentials, not a hosted role/security design. Passing this foundation's tests is not production readiness.

Localhost ports separate origins but **do not isolate cookies by port**. This foundation uses bearer capabilities and no app cookies; the execution server neither authenticates from nor logs cookies. Hosted execution needs a distinct credential-free hostname and explicit cookie/origin probes before release. Do not convert local bearer transport to cookies without revisiting this boundary.


## Tested provider prework boundary

`services/api/src/hypothron/providers/http.py` is an unexposed transport library, not an inference route. Its 26 mock-HTTP regressions exercise official fixed HTTPS hosts, header-only request-scoped keys, no redirects/environment proxies/retries, strict structured replies and sanitized errors. It rejects full-key substrings in outbound decoded body fields before attempt reservation, and checks decoded response keys/nested values plus validated output before returning. This catches Unicode-escaped credential echoes; it does not claim general secret discovery or that an external provider deletes the received header.

Requests ask for identity encoding. Unexpected content encodings are rejected before body consumption; live raw streaming is capped at 64 KiB with 8 KiB chunks, structured reply text at 32 KiB, and transport lifetime at 20 seconds. Tests reproduced an escaped-key bypass and a gzip expansion bypass before the fixes. Timeout/transport ambiguity reports billing unknown with no retry. The required reservation callback is caller-supplied; durable atomic reservation and pricing/capability consent are not implemented. No key-bearing UI/API flow, live provider request or persisted credential store exists.

## Implemented Phase2 boundaries

Consent gates metadata creation and provider work. Creation has an owner/input-scoped idempotent UUID and zero inference; separate advance receives the key. Bearer capabilities stay in app memory and never cross into the executor. API models reject raw rows/extra source fields; known keys are excluded from request/model/provider/request-ID metadata and decoded provider output. Role adapters/graphs are recreated per segment with tracing disabled. Native saver operations are run-scoped/fenced; completed inspection separately authenticates owner/expiry and cannot invoke inference.

Business and native checkpoint commits reconcile; reserved inference without a cached reply is BILLING_UNKNOWN with no automatic retry. Terminal mutations are rejected except an identical accepted-result ACK. Cancellation generations prevent an old response modifying a newer run/key. Browser requests/interaction and database/segment/cleanup deadlines are explicit in ADR-016. Expiry denies access; local lazy cleanup removes native payloads before cascades. Global rate/concurrency admission, upstream policy verification, scheduled hosted purge/backups and deployed origin/proxy behavior remain release requirements. Free-text report grounding remains Phase3. No stronger trust, retention or physical-memory erasure guarantee is inferred.

## Phase 4 implemented local persistence boundary

The Phase1/2 historical limitations above are superseded by the current phase reports. Explicit Save or confirmed Import is the only path creating persisted raw snapshots/artifacts. Upload, calculation, provider investigation, fresh preparation and import preview remain memory-only. Existing inventory reads open previously consented history; raw saved bytes require explicit Load. Unsaved uploads and all keys/capabilities disappear on reload. Manifest/bundle schemas have no credential/capability fields; unknown fields are rejected and capture copies a strict allowlisted structure.

IndexedDB is unencrypted local storage accessible to scripts executing in this application origin. It is not encrypted secure storage, guaranteed retention or a secure-erase mechanism. Physical quota/eviction/crash behavior remains browser-dependent. Exported bundles are sensitive independent copies, never revoked by browser Delete. No remote storage or automatic provider disclosure was added.

Import is untrusted: stored-only ZIP, fixed hash-addressed CSV paths, bounded count/bytes/metadata/depth, consistent disjoint offsets/sizes/CRC, and strict manifest/hash/schema/IR/compiler/runtime-lock validation. Compressed/encrypted/ZIP64/descriptor/extra/comment/trailing entries fail before any decompression; arbitrary SQL/Python/JS/instructions never execute. Persistent confirmation repeats validation and saves atomically. No automatic compatibility migration exists.

Replay uses only current allowlisted IR and original saved bytes on the credential-free execution origin. Active browser/unit guards throw on provider/API requests during replay. Original evidence remains immutable; imported verification is historical CLIENT_REPORTED, while recomputation re-establishes a local verdict with the same provenance. Hashes and compiler source cannot attest honest execution. Fresh AI is a new consent/key/budget/run, never a replay fallback. Frozen run configuration and pre-submission local result retention preserve accurate attribution and lost-ACK recovery. See Phase4 report for actual tested scope; no hosted or broader-device security guarantee is implied.

## Phase5 review additions

Parquet is a new untrusted native/WASM parsing surface. Footer1MiB, metadata expansion estimate128MiB,100000rows/128columns,10MiB source+derived and existing calculation/run limits bound supported inputs; unsupported floats/nested/binary/timestamps, ambiguous names, empty strings and controls refuse. Original and derived hashes remain separate. This is shared decoding and independent arithmetic, not independently verified parsing. Native nested-worker extension XHR serves only an exact pinned in-memory asset; changed URLs/methods fall through to independently tested native CSP denial. Parsing can allocate before estimates, so hard heap isolation and hostile parser safety remain limited.

Privacy-safe diagnostics accept fixed events, numeric bounds, enums and SHA256 UUID correlation only. No API keys, request bodies, dataset values, prompts, headers, full paths/URLs or exception text enter these events. Unexpected ordinary node exceptions are sanitized before LangGraph error writes persist; canary tests inspect actual PostgreSQL checkpoint blobs. HTTP exceptions, including failed fallback writes after a response starts, terminate without chaining private exceptions to Uvicorn. Purge errors are also constant. Cancellation propagates. Supported launcher disables access logs/proxy headers; upstream proxies must independently redact URLs and payloads before public deployment.

Local session admission caps20actual-peer POSTs/minute with1024bounded peers; forwarded-header spoofing cannot alter peer identity in the supported no-proxy-headers launcher. This process-local resettable cap, per-driver concurrency and anonymous sessions are not complete public account/rate infrastructure. Lifespan purge removes expired business metadata and native checkpoints in bounded transactions, but outages, host sleep, backups and sweep backlog prevent an immediate physical-deletion guarantee. No raw dataset retention or secret stores were added. IndexedDB remains opt-in, unencrypted, script-accessible and evictable.

Independent code/security reviews accepted the scoped data, evaluation and operations changes after reproduced ingestion race, misleading CSP probes, exception logging and checkpoint error leakage were fixed. Full regression evidence and residual public-origin/device/provider/backup limitations belong to PHASE_5_REPORT. No security certification or client attestation claim is made.


## Account/provider/cloud extension (2026-10-15)

[ADR-024](DECISIONS.md#adr-024--account-ownership-approved-model-revisions-and-consented-cloud-bundles) authorizes the new account and explicitly consented cloud boundaries. Password hashes use salted scrypt; non-queuing hash admission prevents unbounded thread work and holds admission until canceled hash threads actually finish. Account bearer tokens expire after 24 hours, are hashed in PostgreSQL and are revocable independently of stable account ownership. Frontend storage remains memory-only for tokens; reload requires login. Signup email is not verified by the password flow, password recovery is not implemented, and Google never implicitly links by matching email. Google flow cookies are HttpOnly, host-only, SameSite=Lax, path=/v1/auth and Secure on HTTPS; cookie isolation by localhost port is impossible. Production requires a distinct credential-free executor hostname and actual-origin OAuth/CSRF/CORS tests.

OAuth token/JWKS requests use fixed destinations, no environment proxies or redirects, a total deadline, identity-only raw streaming and strict size/key limits. Definitive model/rate rejection pauses rather than retries; model approval binds owner/current revision/selection and preserves total budgets. Ambiguous billing reservations remain blocked. Catalogue presence and zero advertised price ceilings are not proof of model access or provider accounting.

Account Save copies bounded sanitized metadata/reports/evidence only. Raw cloud bundles require separate consent and bounded authenticated upload; they are never sent to providers. Enabled storage requires explicit endpoint/credentials, private-bucket public-access-block checks and SSE AES256. PENDING intents are durable and quota-counted before PUT; uncertain operations cannot be publicly deleted based on time. Before reconciling a PENDING object, an operator must stop all API upload workers, establish that no outstanding PUT can complete, inspect the expected private object and its exact size/hash, then mark the intent READY or delete the object and remove/mark the failed intent. If completion remains ambiguous, keep the reservation. This maintenance procedure has not been proven against a real store; keep cloud disabled pending that validation. Object-store version/lifecycle and backups may retain copies after application deletion and require a separate retention policy.

The current controls are single-process bounds, not distributed abuse guarantees. Real TLS-origin login, live free-model investigations, private bucket lifecycle, worker egress and hosted recovery remain release gates; see docs/reports/SAAS_IMPLEMENTATION_REPORT.md. Earlier historical sections describing absence of these modules are superseded only for the implemented local extension.

Operator Google OAuth and private-store credentials are backend-only configuration in private secret/env files and process memory; this is distinct from transient user BYOK inference keys. No operator credentials are stored in checkpoints, account history, client bundles, browser configuration or images. The explicitly requested local provider-key preparation file remains ignored and does not activate shared inference.
