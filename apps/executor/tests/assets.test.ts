import { test, expect, vi } from "vitest";
import { installAssetReader } from "../src/assets";
test("memory asset resolver permits fixed GET only, including Request objects", async () => {
  const original = globalThis.fetch;
  vi.stubGlobal("location", new URL("http://127.0.0.1:3001/worker.js"));
  try {
    installAssetReader({ "runtime.wasm": new Uint8Array([1, 2]).buffer });
    await expect(
      fetch(
        new Request("http://127.0.0.1:3001/assets/runtime.wasm", {
          method: "POST",
          body: "canary",
        }),
      ),
    ).rejects.toThrow("NETWORK_DENIED");
    await expect(fetch("/assets/runtime.wasm?canary=1")).rejects.toThrow(
      "NETWORK_DENIED",
    );
    await expect(
      fetch("https://example.com/assets/runtime.wasm"),
    ).rejects.toThrow("NETWORK_DENIED");
    expect(
      new Uint8Array(await (await fetch("/assets/runtime.wasm")).arrayBuffer()),
    ).toEqual(new Uint8Array([1, 2]));
  } finally {
    globalThis.fetch = original;
    vi.unstubAllGlobals();
  }
});
