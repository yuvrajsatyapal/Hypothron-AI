import {
  currencyScale,
  type MetricPlan,
  type EngineDiagnostics,
} from "./contracts";
interface Rows {
  toArray(): Record<string, unknown>[];
}
interface Query {
  query(sql: string): Promise<Rows>;
}
/** Fixed compiler diagnostics: no model source, raw keys or rows leave worker. */
export async function sqlDiagnostics(
  conn: Query,
  p: MetricPlan,
): Promise<EngineDiagnostics> {
  const amount = `o."${p.amountColumn}"`,
    date = `o."${p.dateColumn}"`;
  const scale = currencyScale(p),
    suffix = p.timezone === "UTC" ? "Z" : p.timezone;
  const datePattern =
    "[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}" +
    suffix.replace("+", "\\+");
  const moneyPattern = "-?[0-9]{1,15}" + (scale ? "(\\.[0-9]{1,2})?" : "");
  const n = async (sql: string) =>
    Number((await conn.query(sql)).toArray()[0]?.n);
  if (
    await n(
      `SELECT COUNT(*) AS n FROM orders o WHERE (${amount} IS NOT NULL AND NOT regexp_full_match(${amount}, '${moneyPattern}')) OR ${date} IS NULL OR NOT regexp_full_match(${date}, '${datePattern}')`,
    )
  )
    throw new Error("INVALID_DATA");
  // Timestamp cast enforces calendar validity before the period count.
  const period = `CAST(${date} AS TIMESTAMPTZ) >= TIMESTAMPTZ '${p.start}' AND CAST(${date} AS TIMESTAMPTZ) < TIMESTAMPTZ '${p.end}'`;
  const populationRows = await n("SELECT COUNT(*) AS n FROM orders");
  const grain = p.grainKeys!.map((k) => `"${k}"`).join(",");
  if (
    await n(
      `SELECT COUNT(*) AS n FROM orders WHERE ${p.grainKeys!.map((k) => `"${k}" IS NULL`).join(" OR ")}`,
    )
  )
    throw new Error("INVALID_GRAIN");
  const grainUniqueRows = await n(
    `SELECT COUNT(*) AS n FROM (SELECT DISTINCT ${grain} FROM orders)`,
  );
  if (grainUniqueRows !== populationRows) throw new Error("GRAIN_VIOLATION");
  let joinUniqueRows = populationRows;
  const r = p.relationship;
  if (r) {
    if (populationRows !== r.populationCount)
      throw new Error("POPULATION_MISMATCH");
    const key = `"${r.keyColumn}"`,
      lookup = `"${r.lookupKeyColumn}"`;
    const lookupRows = await n("SELECT COUNT(*) AS n FROM lookup");
    if (lookupRows > 100000) throw new Error("EXPANDED_INPUT_LIMIT");
    if (
      (await n(`SELECT COUNT(*) AS n FROM lookup WHERE ${lookup} IS NULL`)) ||
      (await n(`SELECT COUNT(*) AS n FROM orders WHERE ${key} IS NULL`))
    )
      throw new Error("JOIN_CARDINALITY");
    if (
      (await n(
        `SELECT COUNT(*) AS n FROM (SELECT DISTINCT ${lookup} FROM lookup)`,
      )) !== lookupRows
    )
      throw new Error("JOIN_CARDINALITY");
    const keyUniqueRows = await n(
      `SELECT COUNT(*) AS n FROM (SELECT DISTINCT ${key} FROM orders)`,
    );
    if (r.cardinality === "one_to_one" && keyUniqueRows !== populationRows)
      throw new Error("JOIN_CARDINALITY");
    if (
      await n(
        `SELECT COUNT(*) AS n FROM orders o LEFT JOIN lookup l ON o.${key}=l.${lookup} WHERE l.${lookup} IS NULL`,
      )
    )
      throw new Error("JOIN_CARDINALITY");
    joinUniqueRows = await n(
      `SELECT COUNT(*) AS n FROM (SELECT DISTINCT ${p.grainKeys!.map((k) => `o."${k}"`).join(",")} FROM orders o LEFT JOIN lookup l ON o.${key}=l.${lookup})`,
    );
    if (
      (await n(
        `SELECT COUNT(*) AS n FROM orders o LEFT JOIN lookup l ON o.${key}=l.${lookup}`,
      )) !== populationRows ||
      joinUniqueRows !== populationRows
    )
      throw new Error("JOIN_CARDINALITY");
  }
  if (
    p.nullPolicy === "error" &&
    (await n(`SELECT COUNT(*) AS n FROM orders o WHERE ${amount} IS NULL`))
  )
    throw new Error("NULL_AMOUNT");
  const periodRows = await n(
    `SELECT COUNT(*) AS n FROM orders o WHERE ${period}`,
  );
  const nullAmounts = await n(
    `SELECT COUNT(*) AS n FROM orders o WHERE ${period} AND ${amount} IS NULL`,
  );
  return {
    populationRows,
    periodRows,
    nullAmounts,
    grainUniqueRows,
    joinUniqueRows,
  };
}
