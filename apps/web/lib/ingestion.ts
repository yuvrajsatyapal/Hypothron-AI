import { contentHash } from "./execution";
import type { LocalExecutor } from "./execution";
import type { SourceInput } from "./artifacts";
export interface LocalInput {
  bytes: Uint8Array;
  hash: string;
  source?: SourceInput;
}
export async function readLocalInput(
  file: File,
  executor: Pick<LocalExecutor, "ingest">,
  signal?: AbortSignal,
): Promise<LocalInput> {
  signal?.throwIfAborted();
  if (!file.size || file.size > 10 * 1024 * 1024)
    throw new Error("INPUT_LIMIT");
  if (!/\.(csv|parquet)$/i.test(file.name))
    throw new Error("UNSUPPORTED_FORMAT");
  const original = new Uint8Array(await file.arrayBuffer());
  signal?.throwIfAborted();
  if (/\.parquet$/i.test(file.name)) {
    const { bytes, ...source } = await executor.ingest(original);
    signal?.throwIfAborted();
    return {
      bytes,
      hash: source.datasetHash,
      source: { ...source, bytes: original },
    };
  }
  const hash = await contentHash(original);
  signal?.throwIfAborted();
  return { bytes: original, hash };
}
/** Counts original logical sources (a lookup consumes a slot); copied originals also count toward byte caps. */
export function validateInputSet(
  inputs: { bytes: Uint8Array; hash: string; source?: SourceInput }[],
): void {
  if (!inputs.length || inputs.length > 3) throw new Error("DATASET_LIMIT");
  const derived = new Set<string>(),
    originals = new Set<string>();
  let size = 0;
  for (const input of inputs) {
    if (
      derived.has(input.hash) ||
      originals.has(input.source?.sourceHash ?? input.hash)
    )
      throw new Error("DUPLICATE_DATASET");
    derived.add(input.hash);
    originals.add(input.source?.sourceHash ?? input.hash);
    if (
      input.bytes.length > 10 * 1024 * 1024 ||
      (input.source?.bytes.length ?? 0) > 10 * 1024 * 1024
    )
      throw new Error("INPUT_LIMIT");
    size += input.bytes.length + (input.source?.bytes.length ?? 0);
  }
  if (size > 30 * 1024 * 1024) throw new Error("INPUT_LIMIT");
}
