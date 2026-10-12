import { test, expect } from "vitest";
import {
  canonical,
  createArtifact,
  validateArtifact,
  manifestDigest,
} from "../lib/artifacts";
import { fixture } from "./artifactFixture";
test("canonical bytes ignore object insertion order and normalize negative zero", () => {
  expect(canonical({ b: 2, a: -0 })).toBe('{"a":0,"b":2}');
  expect(canonical({ a: 0, b: 2 })).toBe(canonical({ b: 2, a: 0 }));
});
test("canonical rejects unsupported numbers/prototypes/depth", () => {
  expect(() => canonical({ x: Infinity })).toThrow();
  expect(() => canonical(new Date())).toThrow();
  let x: unknown = null;
  for (let i = 0; i < 40; i++) x = [x];
  expect(() => canonical(x)).toThrow();
});
test("artifact exact bytes/digest/strict source and evidence bindings", async () => {
  const a = await createArtifact(await fixture());
  expect((await validateArtifact(a.manifest, a.snapshots)).digest).toBe(
    a.digest,
  );
  const bad = structuredClone(a);
  bad.snapshots[0].bytes[0] ^= 1;
  await expect(validateArtifact(bad.manifest, bad.snapshots)).rejects.toThrow(
    "SNAPSHOT",
  );
  bad.snapshots = a.snapshots;
  bad.manifest.calculations[0].result.sql.minorUnits = "1000";
  await expect(validateArtifact(bad.manifest, bad.snapshots)).rejects.toThrow(
    "EVIDENCE",
  );
});
test("unknown schema/operation/secret fields and forward dependencies refused", async () => {
  const a = await createArtifact(await fixture());
  for (const change of [
    (m: Record<string, unknown>) => (m.version = 99),
    (m: Record<string, unknown>) => (m.key = "canary"),
    (m: Record<string, unknown>) =>
      ((m.calculations as { plan: { kind: string } }[])[0].plan.kind =
        "execute_python"),
    (m: Record<string, unknown>) =>
      ((m.calculations as { dependsOn: string[] }[])[0].dependsOn = ["later"]),
  ]) {
    const m = structuredClone(a.manifest);
    change(m as unknown as Record<string, unknown>);
    await expect(validateArtifact(m, a.snapshots)).rejects.toThrow();
  }
});
test("canonical manifest digest is stable under object key order", async () => {
  const a = await createArtifact(await fixture());
  const reordered = Object.fromEntries(Object.entries(a.manifest).reverse());
  expect(await manifestDigest(reordered)).toBe(a.digest);
});

test("a real structured report binds the immutable metric hash", async () => {
  const f = await fixture(),
    c = f.calculations[0],
    contractHash = await manifestDigest(c.plan);
  const report = {
    version: 1 as const,
    conclusion:
      "Observed computations are client-reported; evidence states are shown below. Arithmetic agreement does not establish causality.",
    citations: [c.id],
    source: "deterministic_fallback" as const,
    rejection: null,
    findings: [
      {
        id: "finding-1",
        evidenceId: c.id,
        datasetHash: c.plan.datasetHash,
        contractHash,
        metricVersion: 1,
        currency: "USD" as const,
        verification: "VERIFIED",
        provenance: "CLIENT_REPORTED" as const,
        assessment: "SUPPORTED" as const,
        relation: "observed" as const,
        sql: c.result.sql,
        python: c.result.python,
        dependsOn: [],
      },
    ],
    claims: [],
    charts: [
      {
        kind: "engine_comparison" as const,
        evidenceId: c.id,
        currency: "USD" as const,
        sqlMinorUnits: "1010",
        pythonMinorUnits: "1010",
      },
    ],
  };
  expect((await createArtifact({ ...f, report })).manifest.report).toEqual(
    report,
  );
});

test("unavailable runtime is explicit and unknown storage schema is not interpreted", async () => {
  const a = await createArtifact(await fixture());
  a.manifest.runtimeLockDigest = "0".repeat(64);
  const { checkCompatibility } = await import("../lib/artifacts");
  await expect(checkCompatibility(a.manifest)).rejects.toThrow(
    "INCOMPATIBLE_RUNTIME",
  );
});
