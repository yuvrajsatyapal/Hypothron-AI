/** Resolve immutable preloaded assets in memory; CSP remains the network barrier. */
export function installAssetReader(assets: Record<string, ArrayBuffer>): void {
  globalThis.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const method =
      init?.method ?? (input instanceof Request ? input.method : "GET");
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      location.href,
    );
    const name = url.pathname.startsWith("/assets/")
      ? url.pathname.slice(8)
      : "";
    if (
      url.origin !== location.origin ||
      url.search ||
      url.hash ||
      method !== "GET" ||
      !Object.hasOwn(assets, name)
    )
      throw new TypeError("NETWORK_DENIED");
    return new Response(assets[name], {
      headers: {
        "Content-Type": name.endsWith(".wasm")
          ? "application/wasm"
          : "application/octet-stream",
      },
    });
  };
}
