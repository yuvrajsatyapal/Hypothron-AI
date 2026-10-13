import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import {
  parquetEnvelope,
  supportedSchema,
  validateIngestion,
} from "../src/ingestion";

test("Parquet footer boundaries reject malformed and excessive metadata", () => {
  const bytes = new Uint8Array(
    readFileSync("tests/fixtures/phase5-revenue.parquet"),
  );
  expect(() => parquetEnvelope(bytes)).not.toThrow();
  for (const size of [0, bytes.length, 1024 * 1024 + 1]) {
    const corrupt = bytes.slice();
    new DataView(corrupt.buffer).setUint32(corrupt.length - 8, size, true);
    expect(() => parquetEnvelope(corrupt)).toThrow("INVALID_PARQUET");
  }
  expect(() => parquetEnvelope(new Uint8Array(10 * 1024 * 1024 + 1))).toThrow(
    "INPUT_LIMIT",
  );
});
test("Parquet schemas refuse ambiguous names and lossy scalar coercion", () => {
  expect(() =>
    supportedSchema([
      { name: "id", type: "BIGINT" },
      { name: "amount", type: "DECIMAL(10,2)" },
    ]),
  ).not.toThrow();
  expect(() =>
    supportedSchema([
      { name: "id", type: "BIGINT" },
      { name: "ID", type: "BIGINT" },
    ]),
  ).toThrow("INVALID_COLUMN");
  for (const type of ["DOUBLE", "TIMESTAMP", "BLOB", "INTEGER[]"]) {
    expect(() => supportedSchema([{ name: "value", type }])).toThrow(
      "UNSUPPORTED_PARQUET_TYPE",
    );
  }
});
test("ingestion replies require pinned identity and bounded row counts", () => {
  const result = {
    bytes: new TextEncoder().encode("id,revenue\n1,1.20\n"),
    sourceHash: "a".repeat(64),
    datasetHash: "b".repeat(64),
    normalization: "parquet-csv-v1",
    decoder: "duckdb-v1.4.3",
    rows: 1,
    schema: [
      { name: "id", type: "BIGINT" },
      { name: "revenue", type: "DECIMAL(10,2)" },
    ],
  };
  expect(validateIngestion(result)).toEqual(result);
  for (const change of [
    { rows: 100001 },
    { decoder: "latest" },
    { normalization: "unversioned" },
    { raw: "private" },
  ])
    expect(() => validateIngestion({ ...result, ...change })).toThrow(
      "INVALID_RESULT",
    );
});
