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
