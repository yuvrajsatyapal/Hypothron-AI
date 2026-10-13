import { test, expect } from "vitest";
import { validateInputSet } from "../lib/ingestion";
const input = (hash: string) => ({ hash, bytes: new Uint8Array([1]) });
test("three sources include lookup and reject duplicated versions", () => {
  expect(() =>
    validateInputSet([input("primary"), input("lookup"), input("independent")]),
  ).not.toThrow();
  expect(() =>
    validateInputSet([input("a"), input("b"), input("c"), input("d")]),
  ).toThrow("DATASET_LIMIT");
  expect(() => validateInputSet([input("a"), input("a")])).toThrow(
    "DUPLICATE_DATASET",
  );
});

test("cancelled file read cannot enqueue Parquet after returning bytes", async () => {
  const { readLocalInput } = await import("../lib/ingestion");
  let complete!: (value: ArrayBuffer) => void;
  let calls = 0;
  const file = {
    name: "delayed.parquet",
    size: 13,
    arrayBuffer: () =>
      new Promise<ArrayBuffer>((resolve) => (complete = resolve)),
  } as File;
  const controller = new AbortController();
  const read = readLocalInput(
    file,
    {
      ingest: async () => {
        calls++;
        throw new Error("ENQUEUED");
      },
    },
    controller.signal,
  );
  const assertion = expect(read).rejects.toThrow("cancelled");
  controller.abort(new Error("cancelled"));
  complete(new ArrayBuffer(13));
  await assertion;
  expect(calls).toBe(0);
});
