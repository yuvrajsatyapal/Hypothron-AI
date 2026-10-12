import { test as base, expect } from "@playwright/test";

// Context routing covers app pages/popups/frames. Native compute worker egress
// remains governed by the independently tested execution-origin CSP.
export const test = base.extend<{ providerNetworkGuard: void }>({
  providerNetworkGuard: [
    async ({ context }, use) => {
      let attempts = 0;
      const provider =
        /https?:\/\/([^/]*\.)?(openrouter\.ai|googleapis\.com)([:/]|$)/i;
      context.on("request", (request) => {
        if (provider.test(request.url())) attempts++;
      });
      await context.route(
        /https?:\/\/([^/]*\.)?(openrouter\.ai|googleapis\.com)([:/]|$)/i,
        async (route) => {
          await route.abort("blockedbyclient");
        },
      );
      await use();
      expect(attempts, "Unexpected browser provider HTTP attempt").toBe(0);
    },
    { auto: true },
  ],
});
export { expect };
