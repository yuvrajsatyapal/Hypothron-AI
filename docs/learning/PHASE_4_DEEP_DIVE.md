# Phase 4 — Explicit Persistence and Deterministic Replay

This guide teaches the implemented local desktop system. Phase 5 is not implemented. Read the [Phase 3 deep dive](PHASE_3_DEEP_DIVE.md) for numerical semantics and report grounding; this guide concentrates on durability, identity and replay. Executed acceptance results and commit hashes live in the [Phase 4 report](../reports/PHASE_4_REPORT.md).

## Problem and before/after architecture

Before Phase 4, the browser could upload a CSV into memory, approve a metric, execute independent SQL/Pandas calculations and repeat that original calculation during the same page lifetime. FastAPI/LangGraph retained authorized metadata and bounded aggregate evidence for recovery, but those server checkpoints did not contain the original raw data. Reload intentionally discarded raw bytes and credentials. A recoverable server investigation therefore was not a portable, numerically replayable investigation.

Phase 4 introduces explicit Save, local inventory and historical playback, versioned canonical manifests, portable validated ZIP bundles and zero-inference computation replay. It also captures full completed AI investigation evidence, retains approved inputs that the agent did not use, and starts new AI runs linked to an immutable saved parent. Save and import persistence each require their own user action. Merely uploading, calculating, investigating, exporting, viewing a preview or preparing a fresh AI run does not automatically save data.

The three previous phase boundaries remain: Next.js owns local UI/artifacts; FastAPI owns authorization/providers/orchestration; the separate execution origin owns restricted analytical workers. No backend raw upload, new database migration, external storage, encryption service or runtime agent was introduced. PostgreSQL still stores only scoped metadata, contracts, bounded evidence and protocol records.

A crucial distinction: replay reproduces deterministic calculations under supported pinned inputs and runtimes. It does not reproduce the model's reasoning, prove its causal interpretation, attest honest client execution or establish that the business metric is correct.

## Code reading map

| Read in order | New concept / invariant |
|---|---|
| [artifacts.ts](../../apps/web/lib/artifacts.ts) | Canonical representation, manifest validation, immutable snapshot identities and compatibility |
| [storage.ts](../../apps/web/lib/storage.ts) | Lazy Dexie opening, atomic Save/delete, deduplication, bounded replay history |
| [bundles.ts](../../apps/web/lib/bundles.ts) | Strict stored-only ZIP parsing and validation before consent |
| [replay.ts](../../apps/web/lib/replay.ts) | Local-only dependency execution, deterministic comparison and cancellation |
| [LocalHistory.tsx](../../apps/web/components/LocalHistory.tsx) | Save disclosure, inventory, explicit load, import preview/confirmation and recovery |
| [Investigation.tsx](../../apps/web/components/Investigation.tsx) | Capturing accepted calculations, frozen run configuration and separately consented fresh runs |
| [comparison.ts](../../apps/web/lib/comparison.ts) | Structural stochastic-run comparisons with unavailable measurements |
| [ledger.py](../../services/api/src/hypothron/ledger.py) | Owner-scoped observed provider measurements, distinct from inference |

## Technologies, internals and decisions

### IndexedDB and Dexie

IndexedDB is the browser's transactional object store. It persists structured clones of JavaScript values and byte arrays, indexes records by keys, and lets one transaction span several object stores. It is appropriate for explicitly authorized local work that needs more structure and atomicity than localStorage. localStorage is synchronous, string-only and lacks a transaction spanning snapshots and metadata. Server storage would violate the default raw-data boundary. OPFS or service-worker data caches would evade the explicit IndexedDB consent requirement; they were not used.

Dexie wraps native requests and transaction lifetimes in a typed Promise API. Its `version(1).stores` declaration creates `investigations: id`, `snapshots: hash` and `replays: id,investigationId`. `ArtifactDB` installs a `versionchange` handler that closes a connection instead of indefinitely blocking another schema operation. `LocalStore.open` inspects an existing database's version and refuses an unknown schema; it does not downgrade it.

The wrapper is not a magical durable database. IndexedDB can be unavailable, its transaction can abort, and the browser/user can clear or evict the whole origin's storage. A successful transaction is an atomic local commit within supported browser behavior, not a permanent backup guarantee. The code never claims encrypted secure storage. Scripts executing within the application origin can access the records.

### Browser transactions

A browser transaction becomes inactive when its request chain finishes and the browser's event loop advances. Unrelated awaited work such as fetch or WebCrypto can allow auto-commit before intended writes. This is why hashing and artifact validation finish before `db.transaction('rw', ...)`; inside are only Dexie operations associated with that transaction.

Save must choose which shared blobs are missing, check identifier collisions and logical quota, and write all bytes and the manifest in one transaction. Separate transactions could leave orphan bytes or a manifest that points at absent bytes after interruption. Delete likewise removes the investigation, its replay records and last-reference blobs together. The tests inject a native abort after snapshot writes but before investigation insertion, demonstrating rollback in real Chrome. They do not simulate every physical disk failure or browser crash.

### Content addressing and immutability

Each exact CSV byte sequence receives a SHA-256 key. A manifest descriptor contains that hash, byte size and parser designation. Two investigations with the same bytes can share one local blob; deletion scans the remaining manifests before removing an unreferenced blob. Content addressing is chosen over filename identity because filenames can change or collide. It also avoids accidental replacement under the same filename.

`createArtifact` copies raw arrays and builds a detached manifest; `validateArtifact` hashes the actual stored/imported bytes and validates generated source and evidence before returning copied snapshots. Database code does not rely on an object's TypeScript type as proof that a runtime value is valid. Snapshot immutability is enforced by copy and reference discipline at application boundaries; IndexedDB itself does not cryptographically prevent an app-origin script from rewriting a blob.

### Canonical serialization and hashes

`canonical` implements the project's supported JSON representation: sorted object keys, compact separators, finite ECMAScript numbers, exact Unicode scalar strings, and ordered arrays. Negative zero serializes as zero; lone surrogates, unsupported objects/values and nesting beyond 24 fail. Monetary values are integer strings, so JavaScript binary floating-point formatting does not decide financial identity.

For example, `{b:2,a:1}` and `{a:1,b:2}` both become `{"a":1,"b":2}`. Hashing their UTF-8 bytes produces the same digest. Different execution-order arrays remain different, as they should. The builder sorts snapshot descriptors by hash and approved contracts by canonical code-unit order. Unicode normalization is not silently performed: visually similar but byte-distinct names remain distinct supported inputs. This is an explicit representation contract, not a claim that every logically equivalent program is normalized.

`manifestDigest` computes SHA-256 over canonical UTF-8. Snapshot hashes, contract hashes, result digests and the manifest digest protect different boundaries. A hash detects declared content mismatch; an attacker can change a result and recompute the hashes. The forged-agreement Chrome test does exactly that, then proves actual local recomputation reveals the difference. Hashes are integrity identities, never proof of trustworthy calculation.

### Versioning and reproducible computation

The manifest pins version 1, `revenue-compiler-3`, `csv-utf8-v1`, `exact-minor-units-v1`, runtime versions and a digest of the runtime asset lock. The actual DuckDB engine reports `v1.4.3`; the package/asset lock separately pins DuckDB-WASM 1.32.0. Pyodide is 0.29.3, Pandas 2.3.3 and NumPy 2.2.5. Package and engine versions are not interchangeable.

`checkCompatibility` requires the supported compiler, runtime and current asset-lock digest. The executor additionally hashes vendored runtime assets. Stored SQL and Python are inspectable history; `validateExecutionResult` requires them to match trusted compiler output, and the executor receives only approved IR. Unknown versions are refused. No silent migration or fallback calculation exists.

Final Phase 4 manifest v1 supersedes incomplete, unreleased development artifacts produced between T4 task commits, including early v1 records without `approved`. Those records are unsupported; no automatic conversion is implemented. A future supported migration must be explicit, preserve the original and create a new labelled record. This policy does not discard or migrate a Phase 1–3 saved format: those phases had no saved bundles.

## Complete flows and diagrams

### 1. Save

1. Upload and computation stay in memory. `Page` supplies a local calculation input; a completed `Investigation` supplies its accepted multi-job input instead.
2. The UI discloses raw snapshots, question, contracts, compiled source, results and report; consent is unchecked for each new investigation ID.
3. Clicking Save calls `createArtifact(input)`, which detaches bytes, computes identities, recomputes verdicts, binds runtime compatibility and validates the full manifest.
4. `LocalStore.save(artifact,true)` revalidates the artifact and its digest. A false consent argument is rejected before database creation.
5. One transaction checks collision/deduplication/20-record and 64-MiB logical quotas, writes missing blobs and inserts the immutable manifest. Replay bytes also count toward quota.
6. Only transaction completion triggers “Saved atomically.” Failure leaves memory available; recovery guidance distinguishes quota, missing input, collision and unavailable storage.

[Persistence architecture](../diagrams/phase-4-persistence.html) shows application and credential-free executor origins, the default memory state and permitted Save/execution flows. [Save transaction](../diagrams/phase-4-save.html) separates detached hashing from the transaction and explicitly shows rollback. Do not place a provider call inside that transaction.

### 2. Reload and historical playback

`LocalHistory` inventories existing local records through `LocalStore.list`. `Dexie.getDatabaseNames` avoids creating a new database merely to show an empty inventory. Opening an existing consented store for history does not restore unsaved uploaded bytes. Raw snapshot loading happens only after the user selects Load playback.

`load(id)` reads the manifest and referenced snapshots in a read transaction, then validates bytes, source, evidence and digest. It returns `MISSING_INPUT` or an integrity error for missing/changed data. Playback renders explicitly historical CLIENT_REPORTED evidence. It does not invoke an engine or model. After unsaved reload there is neither an upload nor a recovered capability/key.

[Manifest relationships](../diagrams/phase-4-manifest.html) shows the original root, shared blobs, accepted calculation lineage, separate replay records and new fresh manifests. Replay belongs to an investigation ID/digest; fresh `parentId` belongs to the original manifest, not to a replay record.

### 3. Deterministic replay

1. Explicit Replay reloads the saved original through `LocalStore.load` rather than trusting stale UI state.
2. `replayArtifact` validates the manifest/snapshots/digest and compatibility before execution.
3. It visits calculations in their already validated dependency order. Each primary/lookup snapshot is selected by the saved hash.
4. `LocalExecutor.execute` sends `EXECUTE {id,plan,bytes,lookupBytes?,approvedRelationship?}` over a MessageChannel to the exact isolated origin. No credential or backend capability enters the message.
5. The host accepts the parent origin/source, validates IR and bounded input, and starts a fresh isolated worker. Trusted compilers generate read-only DuckDB SQL and fixed Pandas templates. Both engines independently parse original bytes.
6. The returned result is validated against plan/source/runtime; `evidenceVerdict` recomputes numerical and semantic verification.
7. `comparable` selects dataset identity, schema, row counts, both engine scalars, diagnostics and generated source. Canonical exact comparison reports MATCH or MISMATCH. Elapsed time and memory allocations are integrity-protected history but intentionally excluded from deterministic equality.
8. `recordReplay` validates comparison labels against both results and the original manifest, then atomically appends history. The last ten entries per investigation are retained, each at most 256 KiB. A failed history write is reported separately from a completed replay.

[Replay sequence](../diagrams/phase-4-replay.html) shows this local call chain. `replay.ts` has no API, provider adapter or planner dependency. An active test guard throws if API/provider fetch is attempted; browser routes also abort and fail the test. The guard is exercised deliberately before replay, so the test cannot pass merely because a passive observer saw no traffic.

Cancellation checks run before and after each awaited calculation; an AbortSignal listener calls executor cancellation and is removed in `finally`. The host terminates active workers. Completed earlier comparisons can remain in an explicit CANCELLED outcome. A subsequent retry starts new work; original evidence never changes. Executor initialization handles both iframe load before React hydration and Execute before the iframe document is ready. `LocalExecutor.notifyFrameLoaded()` sends a credential-free `PROBE` to exact origin 3001; the host accepts only its exact parent on origin 3000 and replies `HOST_READY`. The browser validates the exact frame source, origin and one-field message before transferring its channel once. An early probe dropped by about:blank is repeated on iframe load. Duplicate readiness messages cannot transfer a second port. Timeout and close remove the bootstrap listener; the existing five-second handshake deadline and host single-connection guard remain. The primary CSV input stays disabled until React hydration, preventing a file-change event from being ignored before its handler exists. The delayed-document Chrome regression waits for that enabled control, then executes before the iframe is released and replays actual engines through this path.

### 4. Export

Explicit Export loads and validates a saved artifact, creates `manifest.json` plus original CSV entries, and downloads a sensitive local copy through a Blob URL. The URL is revoked shortly after use. There is no automatic remote transfer. The bundle excludes session/credential fields and contains no executable instruction file. Deleting browser history cannot revoke filesystem copies.

The [format contract](../INVESTIGATION_BUNDLE_V1.md) is normative. `encodeArchive` writes the stored-only ZIP subset with CRC32 and matching central/local entry metadata. CRC protects container damage; SHA-256 protects declared identities. Neither establishes authorship.

### 5. Import

1. The file's declared size is checked before `arrayBuffer`; the archive is limited to 32 MiB.
2. `importBundle` checks the end directory, entry count, offsets, lengths, exact paths, duplicates and matching local/central metadata before copies.
3. Only STORED method 0 is supported. Compression, encryption, ZIP64, multidisk, descriptors, comments/extra fields and expansion claims are refused before decompression. No decompressor exists, so decompression bombs cannot enter a decompression path.
4. Entries must be exactly one `manifest.json` and one to three `snapshots/<lowercase hash>.csv`, with no directories, traversal, alternate instruction names or trailing content. Snapshots are at most 10 MiB each/30 MiB combined; metadata is at most 1 MiB.
5. The envelope must be byte-for-byte canonical, preventing duplicate keys or alternate whitespace representations from bypassing its identity. Full artifact integrity, IR, dependency, report and compatibility validation follows.
6. A preview remains in memory and historical verification is labelled untrusted CLIENT_REPORTED. Explicit confirmation separately consents to persistent local import.
7. `LocalStore.save(...,true,'imported')` repeats validation and commits atomically. Same ID/digest is idempotent; different digest under the same ID is refused. An identical artifact can restore missing exact blobs, but conflicting bytes are rejected.

[Bundle validation](../diagrams/phase-4-bundles.html) shows export, refusal, preview and the confirmation boundary. Selecting the same file again works because the file input is reset after capturing the File object. Ordinary ZIP tools may emit unsupported features; this deliberate subset trades compression/flexibility for a small bounded parser.

### 6. Delete

Delete removes the selected investigation and its replay records in one transaction. Remaining manifest references determine which blobs are still shared. A blob is deleted only after its last reference disappears. No provider request occurs. This is logical browser deletion, not a physical secure-erase promise. Exported copies are independent.

### 7. Separate fresh AI run

The fresh action revalidates/loads the saved artifact, restores approved inputs to memory and mounts a new form. The key field and provider consent begin empty/unchecked. Merely preparing that form sends no provider request and creates no persistent record.

On Start with fresh consent and BYOK, all approved dataset descriptors are locally recomputed, including unused original inputs. A new server run receives a new UUID and the current budget; metadata/provider orchestration follows Phases 2–3. `runContext` freezes question/provider/model before creation and survives clarification/Resume. Later edits to controls do not rewrite the original run attribution.

Each real calculation is retained before POST/results; only server-accepted IDs enter final capture. This order preserves replayable local evidence when the server accepts a result but its ACK is lost. Resume reads durable accepted state and can complete without rerunning or losing that calculation. The browser regression actively drops that ACK.

At COMPLETE, an owner-scoped GET reads `Ledger.measurements`, then `capture` builds an ArtifactInput without token/key. Unknown usage/timing is null, not invented zero or cost. Completed attempts contribute actual recorded total tokens and provider elapsed milliseconds; ambiguous/reserved/unknown measurements prevent a total. Provider elapsed is request time, not total analytical wall time. `compareInvestigations` requires a distinct new ID and the original parent ID, then compares hypotheses, plans/dependency positions, findings, verdicts and observed tokens/time. Structural differences do not prove equivalent reasoning. Save of the fresh result is still explicit.

[Replay versus fresh reasoning](../diagrams/phase-4-modes.html) separates these paths. Historical saved inputs shown in the main pane remain explicitly historical until a new computation establishes its own evidence. No old bearer capability is restored.

## Algorithms and correctness

### Canonical identity

```text
canonical(value):
  reject unsupported values or excessive depth
  primitive -> supported compact JSON representation
  array -> canonical elements in declared order
  object -> sort keys by code unit; serialize key/value pairs
identity(value) = SHA256(UTF8(canonical(value)))
```

For metadata length M and object key counts k, serialization takes O(M + sum(k log k)); it allocates canonical bytes and detached metadata. Hashing a snapshot of B bytes takes O(B). Import validates bounded inputs before large copies. These are asymptotic explanations, not measured benchmarks.

### Dependency order

```text
accepted = empty set
for calculation in saved order:
  require unique ID
  require every dependency already in accepted
  require plan belongs to approved contracts
  require original hashes/source/result/verdict valid
  accepted.add(ID)
```

This rejects forward dependencies, cycles and duplicate jobs without asking an LLM for order. With at most six calculations, membership checks are bounded; time is O(V + E) apart from hashing/source validation. It never silently sorts a corrupted DAG into a different execution history.

### Atomic references and idempotence

A saved investigation must have every referenced blob at commit. Same ID with a different digest is never an update. Snapshot deduplication only follows exact hash/byte checks. The Save transaction reads current records/blobs/replay sizes before deciding quota, which serializes conflicting writes within the object-store transaction scope. Two tabs are not coordinated by React state; IndexedDB's transaction boundary owns the decision.

The current implementation scans records and bytes rather than storing a mutable reference counter. With at most 20 investigations, three snapshot references each and ten replay records each, this is simpler than counter repair and avoids divergence between count and manifests. It costs O(stored bytes + references) and temporarily reads shared blobs. The logical quota is not a measured peak memory bound.

### Verification and corruption

Stored status is accepted only when the deterministic verifier agrees with the stored typed results/semantics. Replay independently re-establishes current status. A DISPUTED pair stays disputed; matching imported labels never independently prove truth. INCONCLUSIVE reflects unsupported/missing numerical authority; NOT_CHECKED is reserved for observations without a verification attempt, rather than a false green badge. Runtime incompatibility and input corruption are replay errors, not numeric disagreement or a replacement computation.

The comparison excludes volatile timing/memory but includes diagnostics because equal sums with different population/null/join counts can conceal semantic divergence. A manifest digest mismatch fails before execution. A rehashed forged result can pass integrity, but real replay then differs. This separation is central to explaining integrity versus trust.

## Production engineering and limits

Storage eviction can remove the whole database; `MISSING_INPUT` and an absent inventory are honest outcomes. Real Chrome tests clear IndexedDB through the browser protocol to simulate removal. Native quota errors are injected; the bounded logical quota is tested independently. Neither test measures the browser's current physical quota or proves permanent retention. Users can export backups, but those copies contain sensitive raw data.

The app makes no `navigator.storage.persist` guarantee and has no encryption. A compromised application origin can read or rewrite saved information. CSP and separate execution origin remain unchanged; the worker receives neither BYOK nor bearer token. Raw data remains local until the separately consented metadata/provider path, which excludes rows. Known-secret filtering is not a universal detector for every transformed secret. Persisted artifacts should not be treated as sanitized public documents.

Limits remain the scoped desktop engine budgets: 100000 rows/10-MiB execution input/128 columns, conservative expansion checks, 30-second host and 35-second client deadlines. A lookup execution also respects the existing combined execution-input limit. Archives and logical storage have their own larger totals for several serial jobs. Hashing/copying and reading deduplicated blobs consumes memory; quota and chunk limits do not establish a portable hard heap ceiling. No phone/browser support or universal performance benchmark is inferred from layout tests.

Runtime/schema upgrades require deliberate compatibility policy. Existing schema version 1 is inspected, not silently upgraded or downgraded. Future migrations need explicit tests for surviving old records and preserving provenance. Pins alone cannot eliminate every platform-dependent difference, so supported replay also compares outputs and exposes mismatch. Tested environment is ADR-015 Chrome 154/macOS arm64 and fixed local origins.

Observability uses bounded status codes, local outcomes and provider attempt measurements; it does not log datasets, credentials or arbitrary upstream failures. Error UI distinguishes successful computation from failed history persistence. Last-ten replay retention is bounded and visible; original investigation history is immutable. There is no cross-device synchronization, physical secure deletion, encrypted-at-rest claim or server attestation.

## Testing and actual evidence

[Report](../reports/PHASE_4_REPORT.md) records final commands/counts/timings; do not infer them from this guide. Important locations:

- `apps/web/tests/artifacts.test.ts`, `fresh-artifacts.test.ts`: canonical identity, strict fields, hashes, runtime lock, DAG, report grounding and unused approved inputs.
- `apps/web/tests/storage.test.ts`: consent before opening/writing, quota, deletion, idempotence/collision, missing/corrupt blobs and bounded replay records.
- `apps/web/tests/bundles.test.ts`: CRC/path/size/compression/offset/schema/runtime/IR corruption and round trips.
- `apps/web/tests/replay.test.ts`: active fetch refusal, mismatch/disagreement, immutable originals, compatibility, abort/failure/retry.
- `apps/web/tests/execution.test.ts`, `tests/e2e/executor-startup.spec.ts`: wrong-origin/source readiness rejection, once-only channel transfer, bounded timeout/cancellation and actual delayed iframe startup.
- `apps/web/tests/comparison.test.ts`: distinct parent linkage and unavailable measurements.
- `services/api/tests/test_investigations_api.py`: real PostgreSQL owner-scoped measurement totals and unknown billing.
- `tests/e2e/persistence.spec.ts`, `replay-bundles.spec.ts`, `saved-lookup.spec.ts`: actual Chrome IndexedDB and DuckDB/Pyodide, native rollback/quota injection, eviction, lookup replay, corruption, cancellation and import.
- `tests/e2e/fresh-history.spec.ts`, `fresh-recovery.spec.ts`: genuine API/LangGraph/Postgres with mocked external HTTP, completed multi-input capture, new consent/parent, dropped ACK recovery and credential canaries.

Final acceptance: 93 backend tests, 98 frontend/executor unit tests and 32 real Chrome tests (6.1 minutes) pass. TypeScript, Ruff, mypy, formatting, OpenAPI drift, existing migration head, production builds and six diagram checks pass; independent engineering/security and design reviews ACCEPT. The [regression artifact](../reports/PHASE_4_REGRESSION_EVALUATION.json) records ten golden/twelve adverse numerical fixtures with zero false VERIFIED adverse outcomes. Native quota/abort and eviction are injected/simulated, not physical permanence guarantees. No live or paid model requests were made.

Use `pnpm test`, `pnpm typecheck`, `pnpm e2e` and `pnpm build`; Python gates use `.venv/bin/pytest`, Ruff and mypy. Tests need a migrated local PostgreSQL fixture and `DATABASE_URL`; Phase 4 used isolated port 55433 because unrelated software occupied 55432. Never use real provider credentials. `browser_server.py` replaces external HTTP only, retaining real API/graph/database/analytical execution.

Representative RED tests failed because persistence/replay/comparison modules did not exist; approved-unused snapshots failed `UNREFERENCED_SNAPSHOT`; owned measurements lacked an implementation; AI Save captured only the primary local calculation. Browser validation subsequently exposed reload hydration, same-file import, stale run attribution and accepted-result ACK recovery. Green requires the real fixture and regression checks, not simply successful TypeScript compilation.

## Interview preparation

### Two-minute explanation

“We keep uploaded data in browser memory unless the user explicitly saves. Save freezes original bytes, approved metric IR, exact numerical semantics, evidence and runtime versions in a canonical hashed manifest. One IndexedDB transaction commits its references and deduplicated snapshots, or none. A bounded portable ZIP carries the same data; import validates paths, sizes, schemas, hashes and operation allowlists before persistence consent. Replay has no provider or planner dependency. It executes the original approved operations through the isolated DuckDB/Pyodide pipeline, recomputes verification, compares deterministic evidence and appends a separate outcome. Hashes establish identity, not honest computation. A fresh AI run needs new consent/key/budget, receives a new ID with a parent link and can differ in reasoning. Browser storage is unencrypted and evictable, so export is a separate sensitive backup.”

### Ten-minute explanation

Spend two minutes on memory default/consent and the origin boundaries; two on immutable manifest identity and atomic references; two on bundle threat model and compatibility; two on replay sequencing/verification/zero-inference enforcement; one on fresh stochastic-run measurements/recovery; one on tested limits and residual trust. Walk through the six diagrams in that order. Use the forged-agreement test to explain why hashes and two agreeing reported outputs cannot attest a client. Use dropped-ACK recovery to explain local evidence capture versus durable server acceptance.

### Detailed questions and answers

1. **Why store both IR and generated source?** IR is the only executable authority. Source provides inspectable historical compilation and detects source/compiler inconsistency. Re-executing imported source would reopen arbitrary SQL/Python privileges. Trusted compilers regenerate source under exact compatibility checks.
2. **Why not automatically save after upload?** That changes a sensitive ephemeral action into durable retention without informed consent. The UI disclosure and boolean storage boundary are both required; a hidden cache or OPFS fallback would violate the same intent.
3. **Why does Save hash before beginning a transaction?** WebCrypto awaits can escape a browser transaction's active lifetime. Validation outside produces a detached bounded artifact; one request chain inside atomically owns collision, deduplication, quota and writes.
4. **Can two tabs both pass a quota check?** A UI counter cannot prevent that race. The quota read and writes share the relevant IndexedDB read-write transaction scope. Application assumptions still exclude an adversarial same-origin script forging records; logical quotas are not browser physical quotas.
5. **Can hashes prove a VERIFIED result?** No. A malicious artifact can contain two forged equal scalars and recomputed digests. Import revalidates reported status but labels it historical; actual replay independently computes from original bytes and exposes differences. Client-reported agreement remains local provenance.
6. **Why a stored-only ZIP?** It retains a recognizable portable container without a decompression engine or unbounded expansion path. Strict paths/offsets/lengths and small counts make validation reviewable. It sacrifices compression and compatibility with ZIP tools that add unsupported fields.
7. **What happens when a runtime changes?** Exact compiler/version/asset-lock compatibility is required. Refuse unknown runtime instead of reinterpreting the calculation. Future migration should make a new labelled record with original preserved and tested comparisons, not overwrite its provenance.
8. **What is deterministic equality?** Identical dataset identity, schema/population, both typed results, diagnostics and trusted generated sources under saved exact minor-unit semantics. Elapsed time and tracked allocations vary and are excluded. LLM reasoning/text reproduction is outside this contract.
9. **How does lost-result-ACK recovery work?** Capture local compiled results before submitting them; durable server evidence determines which IDs are accepted. If ACK is lost, Resume can read acceptance without destroying the original local result. Never invent a result from the server scalar because it would lack independent full execution evidence.
10. **Why separate fresh AI runs?** Cached model text is not computation replay, and new reasoning may make billed provider requests. Fresh consent and empty BYOK field prevent accidental disclosure/billing; a new ID/parent link and measured comparisons preserve original history. Missing billing measurements remain unknown.
11. **Would encryption solve origin compromise?** At-rest encryption could reduce some offline exposure, but scripts holding a decrypted key during use can still access data. Phase 4 does not introduce encryption or a misleading secure-storage claim. A future design needs key management, recovery and a precise threat model.
12. **How would you scale beyond twenty records?** Measure blob scans and memory first. Consider metadata-only indexes, reference tables and bounded paging, with transactional repair/migration tests. Do not introduce remote infrastructure before requirements and privacy authorization justify it.

## Practical exercises and learning progression

1. Run the artifact fixture; reorder object keys and prove identical bytes/digest. Change one currency/period/hash and explain the changed identity. Add a meaningful negative canonical representation test.
2. In a test-only IndexedDB transaction, abort between snapshot and manifest insertion. Inspect both stores after reload. Explain why several independent writes cannot offer this invariant.
3. Alter an archive's path, method or size field and predict which parser boundary rejects it before running `bundles.test.ts`. Do not add a permissive decompression fallback.
4. Forge both historical scalars and recompute digests in the Chrome fixture. Explain why import/playback can only validate integrity while real replay returns a mismatch.
5. Cancel between serial jobs, then retry. Verify retained outcomes and immutable original digest. Describe the difference between calculation failure and history quota failure.
6. Drop a results ACK, resume the original server run and explicitly Save. Confirm accepted calculations retain their generated source and original provider/question.
7. Restore a saved parent for fresh AI investigation with mocked HTTP; confirm no automatic provider call before new consent, new run ID/parent, unknown tokens and preserved original record.

Must know before Phase 5: consent boundaries; canonical identity versus trust; immutable snapshots and exact IR semantics; transaction lifetime/atomicity; runtime refusal; active zero-inference guards; history/provenance separation. Production priority: real browser storage failure/eviction, bounded input/allocation, malicious archive handling, owner-scoped observations, interrupted request recovery and honest user-visible errors. Advanced follow-ups: explicit schema migrations, runtime reproducibility across platforms, reference indexing at larger scale and a separate encryption threat model. Phase 5 should evaluate and release the implemented local target; this phase does not authorize deployment or extend analytical scope.
