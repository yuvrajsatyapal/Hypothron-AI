# Investigation bundle version 1

Phase4 local desktop format. The executable authority remains `revenue_sum` IR1/2 validated by the existing compiler; imported source never executes. No encryption, signatures, remote sync or trusted author/attestation claim.

## Container

`.zip` with ZIP STORED method0 only, version-needed20, flags0, no comments/extra fields/data descriptors/ZIP64/encryption/multi-disk. Entries are contiguous, disjoint and match their central-directory names/offsets/sizes/CRC32. Entire archive≤32MiB; 2–4 entries. Exact paths: `manifest.json` once and 1–3 `snapshots/<64 lowercase hex SHA256>.csv`. No directories, other paths or instruction files. Snapshot≤10MiB; combined raw≤30MiB; metadata≤1MiB. Compressed entries are rejected before decompression; no decompression library is present. Bounds are checked before copying entries. This is a deliberate portable subset; ordinary ZIP utilities may emit unsupported features and will be refused.

`manifest.json` contains canonical `{digest,manifest}`. Digest is SHA256 of canonical manifest UTF8, not the envelope. File bytes must match canonical serialization exactly; alternate whitespace, duplicate object keys and trailing metadata fail. CRC detects container damage; cryptographic hashes detect declared content mismatch. An attacker can recompute both; no authenticity or honest-computation guarantee follows.

## Canonical model

`artifacts.ts` owns the strict schema. Keys are lexicographically sorted UTF16 code units, JSON compact, finite ECMAScript number serialization including negative-zero→0, Unicode scalar strings preserved exactly without normalization; lone surrogates/unsupported objects/depth>24 fail. Exact monetary values are integer strings, timestamps explicit UTC. Evidence/dependency arrays record execution order; snapshot descriptors are produced sorted by hash. Only supported representations are compared: Unicode normalization and reordered execution plans are not silently considered equivalent. Per-contract hash uses sorted compact JSON compatible with backend ASCII contract fields.

The immutable manifest binds investigation ID/question/UTC creation/parent, snapshot hashes/length/CSV parser, metric IR, calculation IDs/hypothesis IDs/dependencies, inspectable generated SQL/Python, accepted engine results/result digests, exact numerical tolerance, verification and CLIENT_REPORTED provenance, report and optional measured AI context. Compiler ID plus runtime versions and runtime-lock digest must match current supported assets. Result timing/allocations are integrity-protected measurements but excluded from numerical comparison.

## Validation and compatibility

`importBundle` checks structure/paths/sizes/CRC, canonical envelope, strict manifest/IR/source/result/DAG/report fields, source SHA256 and evidence/manifest digests, then current compiler/runtime-lock compatibility. Validation stays in memory. The UI requires explicit persistence confirmation. `LocalStore.save` repeats artifact validation and uses one transaction for all snapshots and metadata. Re-import of same ID/digest is idempotent; changed content under an existing ID is a collision, never overwrite. Missing exact snapshot bytes can be restored atomically from an identical artifact, while conflicting bytes are rejected.

Unknown manifest/storage/parser/tolerance/operation versions fail closed. Runtime/compiler incompatibility refuses replay/import. No current migration is implemented: an explicitly authorized future migration must produce a new labelled record, preserve original and rerun comparisons. Stored SQL/Python must equal trusted current compiler output, and only IR is passed to executor.

## Modes and retention

Playback renders historical evidence without execution. Replay validates and executes original approved operations serially with local engines, independently recomputes status, compares dataset/schema/rows/scalars/diagnostics/source under exact tolerance, and appends a bounded local replay record. No provider/API planning dependency exists. Last ten replay records retained per saved investigation; original is immutable. Delete removes its replay records and last-reference snapshot blobs in one transaction. Exported filesystem copies are independent and cannot be revoked.

Fresh AI re-investigation is separate new consent/key/budget over approved local inputs. Results are linked to parent and never overwrite it. Browser storage is accessible to app-origin scripts, subject to quota/eviction/crashes, and is not encrypted secure storage. Logical quota64MiB/20investigations differs from browser physical allocation. Storage failures never imply Save succeeded.
