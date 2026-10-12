import { test, expect } from "@playwright/test";
const csv =
  "order_id,completed_at,revenue\n1,2025-07-01T00:00:00Z,10.10\n2,2025-07-02T00:00:00Z,20.20\n3,2025-09-30T23:59:59Z,0.03\n4,2025-10-01T00:00:00Z,999.00\n5,2025-08-01T00:00:00Z,\n";
test("independent financial engines, replay, no upload and no implicit save", async ({
  page,
}) => {
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  await page.goto("/");
  await page.getByLabel("Dataset CSV").setInputFiles({
    name: "orders.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByTestId("verification")).toContainText("VERIFIED", {
    timeout: 120000,
  });
  await expect(page.getByTestId("sql-value")).toHaveText("3033");
  await expect(page.getByTestId("python-value")).toHaveText("3033");
  await expect(page.getByTestId("verification")).toContainText(
    "CLIENT_REPORTED",
  );
  expect(posts).toEqual([]);
  expect(
    await page.evaluate(async () => (await indexedDB.databases()).length),
  ).toBe(0);
  await page
    .getByRole("button", { name: "Replay original calculations", exact: true })
    .click();
  await expect(page.getByTestId("replay")).toHaveText("MATCH", {
    timeout: 120000,
  });
  expect(posts).toEqual([]);
  const measured = await page.getByTestId("timing").textContent();
  console.log("real engine timing:", measured);
});
test("execution host rejects network/upload/capability bypass", async ({
  page,
  request,
}) => {
  expect(
    (
      await request.post("http://127.0.0.1:3001/assets/exfil", {
        data: "private",
      })
    ).status(),
  ).toBe(405);
  await page.goto("http://127.0.0.1:3001/");
  const blocked = await page.evaluate(async () => {
    try {
      await fetch("https://example.com/private");
      return false;
    } catch {
      return true;
    }
  });
  expect(blocked).toBe(true);
});
test("accessible narrow screen uses local scrolling without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByLabel("Dataset CSV")).toBeVisible();
});
test("failed new execution removes previous evidence and locks dataset controls", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Dataset CSV").setInputFiles({
    name: "orders.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByLabel("Dataset CSV")).toBeDisabled();
  await expect(page.getByTestId("verification")).toContainText("VERIFIED", {
    timeout: 35000,
  });
  await page.getByLabel("Amount column").fill("missing");
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByTestId("verification")).toHaveCount(0);
  await expect(
    page.locator("section.evidence").getByRole("status"),
  ).toContainText("MISSING_COLUMN", {
    timeout: 35000,
  });
});
test("invalid replacement clears snapshot identity", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Dataset CSV").setInputFiles({
    name: "orders.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(
    page.getByRole("button", { name: "Execute locally", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Dataset CSV").setInputFiles({
    name: "huge.csv",
    mimeType: "text/csv",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await expect(
    page.getByRole("button", { name: "Execute locally", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("No dataset selected")).toBeVisible();
});
test("cancellation clears work and permits a fresh calculation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Dataset CSV").setInputFiles({
    name: "orders.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.locator("section.evidence").getByRole("status"),
  ).toContainText("CANCELLED");
  await expect(page.getByTestId("verification")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByTestId("verification")).toContainText("VERIFIED", {
    timeout: 35000,
  });
});
test("actual analytical worker denies external and same-origin egress", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Dataset CSV").setInputFiles({
    name: "orders.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  const created = page.waitForEvent("worker", (worker) =>
    worker.url().endsWith("/worker.js"),
  );
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  const worker = await created;
  const external = await worker.evaluate(async () => {
    try {
      await fetch("https://example.com/private");
      return "allowed";
    } catch {
      return "blocked";
    }
  });
  expect(external).toBe("blocked");
  // Dataset-bearing compute workers must not use the bootstrap network allowance.
  const local = await worker.evaluate(async () => {
    try {
      return (await fetch("/assets/probe?synthetic_canary=1")).status;
    } catch {
      return 0;
    }
  });
  expect(local).toBe(0);
  const native = await worker.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", "/assets/probe?synthetic_canary=1");
        xhr.onload = () => resolve("allowed");
        xhr.onerror = () => resolve("blocked");
        try {
          xhr.send();
        } catch {
          resolve("blocked");
        }
      }),
  );
  expect(native).toBe("blocked");
  const imported = await worker.evaluate(async () => {
    try {
      await import("/host.js?synthetic_canary=1");
      return "allowed";
    } catch {
      return "blocked";
    }
  });
  expect(imported).toBe("blocked");
  await expect(page.getByTestId("verification")).toContainText("VERIFIED", {
    timeout: 35000,
  });
});

test("real executor channel rejects free-form code and wrong dataset hashes", async ({
  page,
}) => {
  await page.goto("/");
  const responses = await page.evaluate(async () => {
    const iframe = document.createElement("iframe");
    iframe.src = "http://127.0.0.1:3001/";
    iframe.hidden = true;
    document.body.append(iframe);
    await new Promise<void>((resolve) => (iframe.onload = () => resolve()));
    const channel = new MessageChannel();
    const received: Record<string, unknown>[] = [];
    return await new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("channel timeout")),
        15000,
      );
      channel.port1.onmessage = (event) => {
        if (event.data.type === "CONNECTED") {
          const base = {
            version: 1,
            kind: "revenue_sum",
            datasetHash: "a".repeat(64),
            amountColumn: "revenue",
            dateColumn: "completed_at",
            start: "2025-07-01T00:00:00Z",
            end: "2025-10-01T00:00:00Z",
            timezone: "UTC",
            currency: "USD",
            nullPolicy: "exclude",
          };
          channel.port1.postMessage({
            type: "EXECUTE",
            id: "code",
            plan: { ...base, code: "import os" },
            bytes: new Uint8Array([1]),
          });
          for (const kind of ["read_file", "install_extension"])
            channel.port1.postMessage({
              type: "EXECUTE",
              id: kind,
              plan: { ...base, kind },
              bytes: new Uint8Array([1]),
            });
          channel.port1.postMessage({
            type: "EXECUTE",
            id: "hash",
            plan: base,
            bytes: new Uint8Array([1]),
          });
        } else {
          received.push(event.data);
          if (received.length === 4) {
            clearTimeout(timer);
            channel.port1.close();
            iframe.remove();
            resolve(received);
          }
        }
      };
      iframe.contentWindow!.postMessage(
        { type: "CONNECT" },
        "http://127.0.0.1:3001",
        [channel.port2],
      );
    });
  });
  expect(responses.map((r) => r.error)).toEqual([
    "INVALID_PLAN",
    "UNSUPPORTED_OPERATION",
    "UNSUPPORTED_OPERATION",
    "DATASET_HASH_MISMATCH",
  ]);
});

test("injected numerical contradiction remains disputed in real browser evidence", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Dataset CSV").setInputFiles({
    name: "orders.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  const created = page.waitForEvent("worker", (worker) =>
    worker.url().endsWith("/worker.js"),
  );
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  const worker = await created;
  await worker.evaluate(() => {
    const original = self.postMessage.bind(self);
    self.postMessage = ((data: unknown) => {
      const message = data as {
        ok?: boolean;
        result?: { python: { minorUnits: string } };
      };
      if (message.ok && message.result)
        message.result.python.minorUnits = "2000";
      original(data);
    }) as typeof self.postMessage;
  });
  await expect(page.getByTestId("verification")).toContainText("DISPUTED", {
    timeout: 35000,
  });
  await expect(page.getByTestId("sql-value")).toHaveText("3033");
  await expect(page.getByTestId("python-value")).toHaveText("2000");
});
test("empty selected metric is inconclusive, never false verified zero", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Dataset CSV").setInputFiles({
    name: "empty.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("completed_at,revenue\n2025-07-01T00:00:00Z,\n"),
  });
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByTestId("verification")).toContainText("INCONCLUSIVE", {
    timeout: 35000,
  });
});
test("decimal negative values and half-open boundary use exact arithmetic", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Dataset CSV").setInputFiles({
    name: "edges.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "completed_at,revenue\n2025-07-01T00:00:00Z,0.10\n2025-08-01T00:00:00Z,-0.01\n2025-10-01T00:00:00Z,999.99\n",
    ),
  });
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByTestId("verification")).toContainText("VERIFIED", {
    timeout: 35000,
  });
  await expect(page.getByTestId("sql-value")).toHaveText("9");
  await expect(page.getByTestId("python-value")).toHaveText("9");
});
for (const width of [375, 768, 1440])
  test(`responsive workspace ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

test("nested DuckDB worker denies native connections", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Dataset CSV").setInputFiles({
    name: "orders.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  const nested = page.waitForEvent(
    "worker",
    (worker) => worker.url().endsWith("/duckdb-worker.js"),
    { timeout: 15000 },
  );
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  const worker = await nested;
  const denied = await worker.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", "/assets/probe?nested_canary=1");
        xhr.onload = () => resolve(false);
        xhr.onerror = () => resolve(true);
        try {
          xhr.send();
        } catch {
          resolve(true);
        }
      }),
  );
  expect(denied).toBe(true);
  await expect(page.getByTestId("verification")).toContainText("VERIFIED", {
    timeout: 35000,
  });
});

test("wrong-origin bootstrap never receives a channel acknowledgement", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:3001/");
  const acknowledged = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve(true);
        window.postMessage({ type: "CONNECT" }, location.origin, [
          channel.port2,
        ]);
        setTimeout(() => {
          channel.port1.close();
          resolve(false);
        }, 500);
      }),
  );
  expect(acknowledged).toBe(false);
});
test("same-origin sibling cannot seize executor bootstrap channel", async ({
  page,
}) => {
  await page.goto("/");
  const connected = await page.evaluate(async () => {
    const target = document.createElement("iframe");
    target.id = "channel-target";
    target.src = "http://127.0.0.1:3001/";
    document.body.append(target);
    await new Promise<void>((resolve) => (target.onload = () => resolve()));
    const sibling = document.createElement("iframe");
    sibling.srcdoc = `<script>const c=new MessageChannel();parent.document.getElementById('channel-target').contentWindow.postMessage({type:'CONNECT'},'http://127.0.0.1:3001',[c.port2]);parent.postMessage({type:'SIBLING_SENT'},parent.location.origin);</script>`;
    const sent = new Promise<void>((resolve) => {
      const handle = (e: MessageEvent) => {
        if (e.data?.type === "SIBLING_SENT") {
          removeEventListener("message", handle);
          resolve();
        }
      };
      addEventListener("message", handle);
    });
    document.body.append(sibling);
    await sent;
    const channel = new MessageChannel();
    return await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 10000);
      channel.port1.onmessage = (e) => {
        if (e.data.type === "CONNECTED") {
          clearTimeout(timer);
          channel.port1.close();
          target.remove();
          sibling.remove();
          resolve(true);
        }
      };
      target.contentWindow!.postMessage(
        { type: "CONNECT" },
        "http://127.0.0.1:3001",
        [channel.port2],
      );
    });
  });
  expect(connected).toBe(true);
});
test("empty versus populated independent result is disputed", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Dataset CSV").setInputFiles({
    name: "orders.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  const created = page.waitForEvent("worker", (worker) =>
    worker.url().endsWith("/worker.js"),
  );
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  const worker = await created;
  await worker.evaluate(() => {
    const original = self.postMessage.bind(self);
    self.postMessage = ((data: unknown) => {
      const message = data as {
        ok?: boolean;
        result?: { python: { minorUnits: string | null; count: number } };
      };
      if (message.ok && message.result)
        message.result.python = { minorUnits: null, count: 0 };
      original(data);
    }) as typeof self.postMessage;
  });
  await expect(page.getByTestId("verification")).toContainText("DISPUTED", {
    timeout: 35000,
  });
});
