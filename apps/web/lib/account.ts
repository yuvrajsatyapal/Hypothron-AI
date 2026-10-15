export interface Account {
  id: string;
  email: string;
  token: string;
}
export function validateAccount(value: unknown): Account {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_ACCOUNT");
  const r = value as Record<string, unknown>;
  if (
    Object.keys(r).sort().join(",") !== "email,id,token" ||
    typeof r.id !== "string" ||
    !r.id ||
    r.id.length > 128 ||
    typeof r.email !== "string" ||
    r.email.length > 254 ||
    !r.email.includes("@") ||
    typeof r.token !== "string" ||
    !/^[A-Za-z0-9_-]{32,128}$/.test(r.token)
  )
    throw new Error("INVALID_ACCOUNT");
  return { id: r.id, email: r.email, token: r.token };
}
