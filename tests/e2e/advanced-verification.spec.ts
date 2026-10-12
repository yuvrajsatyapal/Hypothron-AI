import { test, expect } from "./fixtures";
test("v2 real SQL/Pandas independently compute money, periods, grain and cardinality", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("/");
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  const results = await page.evaluate(async () => {
    const frame = document.createElement("iframe");
    frame.src = "http://127.0.0.1:3001/";
    frame.hidden = true;
    document.body.append(frame);
    await new Promise<void>((resolve) => (frame.onload = () => resolve()));
    const channel = new MessageChannel();
    const replies: Record<string, unknown>[] = [];
    const hash = async (bytes: Uint8Array) =>
      Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
    let receiver: (reply: Record<string, unknown>) => void = () => {};
    channel.port1.onmessage = (e) => receiver(e.data);
    const connected = new Promise<void>(
      (resolve) =>
        (receiver = (r) => {
          if (r.type === "CONNECTED") resolve();
        }),
    );
    frame.contentWindow!.postMessage(
      { type: "CONNECT" },
      "http://127.0.0.1:3001",
      [channel.port2],
    );
    await connected;
    const csv =
      "order_id,customer_id,completed_at,revenue\n1,A,2025-07-01T00:00:00+05:30,10.10\n2,A,2025-07-02T00:00:00+05:30,-0.03\n3,B,2025-08-01T00:00:00+05:30,\n4,B,2025-10-01T00:00:00+05:30,999.00\n";
    const lookup = "id,label\nA,alpha\nB,beta\n";
    async function run(
      id: string,
      text: string,
      currency = "EUR",
      lookupText: string | null = null,
      cardinality = "many_to_one",
      approve = true,
      nullPolicy = "exclude",
      populationCount = 4,
    ) {
      const bytes = new TextEncoder().encode(text),
        lookupBytes =
          lookupText === null ? null : new TextEncoder().encode(lookupText);
      const plan = {
        version: 2,
        kind: "revenue_sum",
        datasetHash: await hash(bytes),
        amountColumn: "revenue",
        dateColumn: "completed_at",
        start: "2025-07-01T00:00:00+05:30",
        end: "2025-10-01T00:00:00+05:30",
        timezone: "+05:30",
        currency,
        nullPolicy,
        grainKeys: ["order_id"],
        relationship: lookupBytes
          ? {
              datasetHash: await hash(lookupBytes),
              keyColumn: "customer_id",
              lookupKeyColumn: "id",
              cardinality,
              populationCount,
            }
          : null,
      };
      const response = new Promise<Record<string, unknown>>(
        (resolve) => (receiver = resolve),
      );
      channel.port1.postMessage({
        type: "EXECUTE",
        id,
        plan,
        bytes,
        ...(lookupBytes ? { lookupBytes, approvedRelationship: approve } : {}),
      });
      const reply = await response;
      replies.push(reply);
    }
    await run("euro", csv);
    await run("join", csv, "EUR", lookup);
    await run(
      "jpy",
      csv
        .replace("10.10", "10")
        .replace("-0.03", "-3")
        .replace("999.00", "999"),
      "JPY",
    );
    await run("grain", csv.replace("2,A", "1,A"));
    await run("lookup-duplicate", csv, "EUR", lookup + "A,duplicate\n");
    await run("one-to-one", csv, "EUR", lookup, "one_to_one");
    await run("unmatched", csv, "EUR", "id,label\nA,alpha\n");
    await run("fractional-yen", csv, "JPY");
    await run("no-consent", csv, "EUR", lookup, "many_to_one", false);
    await run("invalid-date", csv.replace("2025-07-02", "2025-02-30"));
    await run("null-error", csv, "EUR", null, "many_to_one", true, "error");
    const lines = csv.trimEnd().split("\n");
    await run(
      "reverse",
      lines[0] + "\n" + lines.slice(1).reverse().join("\n") + "\n",
    );
    await run(
      "population",
      csv,
      "EUR",
      lookup,
      "many_to_one",
      true,
      "exclude",
      3,
    );
    await run(
      "null-only",
      csv.replace("10.10", "").replace("-0.03", "").replace("999.00", ""),
    );
    await run(
      "large-exact",
      csv
        .replace("10.10", "999999999999999.99")
        .replace("-0.03", "999999999999999.99"),
      "USD",
    );
    await run(
      "one-to-one-valid",
      csv.replace("2,A", "2,C").replace("4,B", "4,D"),
      "EUR",
      lookup + "C,gamma\nD,delta\n",
      "one_to_one",
    );
    channel.port1.close();
    frame.remove();
    return replies;
  });
  for (const i of [0, 1, 2])
    expect(results[i].ok, JSON.stringify(results[i])).toBe(true);
  const euro = results[0].result as {
    sql: { minorUnits: string; count: number };
    python: { minorUnits: string; count: number };
    diagnostics: {
      sql: Record<string, number>;
      python: Record<string, number>;
    };
  };
  expect(euro.sql).toEqual({ minorUnits: "1007", count: 2 });
  expect(euro.python).toEqual(euro.sql);
  const joined = results[1].result as typeof euro;
  expect(joined.sql).toEqual(euro.sql);
  expect(joined.python).toEqual(euro.sql);
  const yen = results[2].result as typeof euro;
  expect(yen.sql).toEqual({ minorUnits: "7", count: 2 });
  expect(yen.python).toEqual(yen.sql);
  for (const i of [3, 4, 5, 6, 7, 8, 9])
    expect(results[i].ok, JSON.stringify(results[i])).toBe(false);
  expect(results[3].error).toBe("GRAIN_VIOLATION");
  for (const i of [4, 5, 6]) expect(results[i].error).toBe("JOIN_CARDINALITY");
  expect(results[7].error).toBe("INVALID_DATA");
  expect(results[8].error).toBe("RELATIONSHIP_APPROVAL_REQUIRED");
  expect(euro.diagnostics.sql).toEqual({
    populationRows: 4,
    periodRows: 3,
    nullAmounts: 1,
    grainUniqueRows: 4,
    joinUniqueRows: 4,
  });
  expect(euro.diagnostics.python).toEqual(euro.diagnostics.sql);
  expect(results[10].error).toBe("NULL_AMOUNT");
  expect((results[11].result as typeof euro).sql).toEqual(euro.sql);
  expect((results[11].result as typeof euro).python).toEqual(euro.sql);
  expect(results[12].error).toBe("POPULATION_MISMATCH");
  for (const i of [11, 13, 14, 15])
    expect(results[i].ok, JSON.stringify(results[i])).toBe(true);
  expect((results[13].result as typeof euro).sql).toEqual({
    minorUnits: null,
    count: 0,
  });
  expect((results[13].result as typeof euro).python).toEqual({
    minorUnits: null,
    count: 0,
  });
  expect((results[14].result as typeof euro).sql).toEqual({
    minorUnits: "199999999999999998",
    count: 2,
  });
  expect((results[14].result as typeof euro).python).toEqual({
    minorUnits: "199999999999999998",
    count: 2,
  });
  expect((results[15].result as typeof euro).sql).toEqual(euro.sql);
  expect((results[15].result as typeof euro).python).toEqual(euro.sql);
  expect(posts).toEqual([]);
});

test("advanced workspace requires explicit join approval, shows diagnostics and replays original snapshots", async ({
  page,
}) => {
  page.setDefaultTimeout(10000);
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  await page.goto("/");
  await page.getByLabel("Dataset CSV", { exact: true }).setInputFiles({
    name: "orders.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "order_id,customer_id,completed_at,revenue\n1,A,2025-07-01T00:00:00Z,10.10\n2,A,2025-07-02T00:00:00Z,-0.03\n",
    ),
  });
  await page.getByLabel("Use advanced v2 contract").check();
  await page.getByRole("combobox", { name: /^Currency/ }).selectOption("EUR");
  await page.getByLabel("Unique dataset grain keys").fill("order_id");
  await page.getByLabel("Optional lookup CSV").setInputFiles({
    name: "customers.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("id,label\nA,alpha\n"),
  });
  await expect(
    page.getByText("Lookup in local memory: customers.csv"),
  ).toBeVisible();
  await page.getByLabel("Source join key", { exact: true }).fill("customer_id");
  await page.getByLabel("Expected source population rows").fill("2");
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(
    page.locator("section.evidence").getByRole("status"),
  ).toContainText("RELATIONSHIP_APPROVAL_REQUIRED");
  await page.getByLabel("I approve this derived join").check();
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByTestId("verification")).toContainText("VERIFIED", {
    timeout: 35000,
  });
  await expect(page.getByTestId("sql-value")).toHaveText("1007");
  await expect(page.getByTestId("python-value")).toHaveText("1007");
  await expect(
    page.getByRole("columnheader", { name: "Unique grain" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Replay original calculations", exact: true })
    .click();
  await expect(page.getByTestId("replay")).toHaveText("MATCH", {
    timeout: 35000,
  });
  expect(posts).toEqual([]);
  expect(
    await page.evaluate(async () => (await indexedDB.databases()).length),
  ).toBe(0);
});
