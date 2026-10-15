export interface FreeModel {
  id: string;
  name: string;
  contextLength: number;
  maxCompletionTokens: number;
  advertisedFree: true;
}
export interface ModelCatalogue {
  models: FreeModel[];
  preferredModel: string;
  resolvedModel: string | null;
  fallbackModels: string[];
}
function concrete(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value) &&
    !["auto", "openrouter/auto", "openrouter/free"].includes(value)
  );
}
export function validateModelCatalogue(value: unknown): ModelCatalogue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_CATALOGUE");
  const r = value as Record<string, unknown>;
  if (
    !Array.isArray(r.models) ||
    r.models.length > 1000 ||
    !Array.isArray(r.fallbackModels) ||
    r.fallbackModels.length > 10 ||
    !(r.preferredModel === "auto" || concrete(r.preferredModel))
  )
    throw new Error("INVALID_CATALOGUE");
  const ids = new Set<string>();
  const models = r.models.map((value: unknown): FreeModel => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("INVALID_CATALOGUE");
    const m = value as Record<string, unknown>;
    if (
      !concrete(m.id) ||
      ids.has(m.id) ||
      typeof m.name !== "string" ||
      !m.name ||
      m.name.length > 200 ||
      !Number.isSafeInteger(m.contextLength) ||
      Number(m.contextLength) < 32768 ||
      !Number.isSafeInteger(m.maxCompletionTokens) ||
      Number(m.maxCompletionTokens) < 1024 ||
      m.advertisedFree !== true
    )
      throw new Error("INVALID_CATALOGUE");
    ids.add(m.id);
    return {
      id: m.id,
      name: m.name,
      contextLength: Number(m.contextLength),
      maxCompletionTokens: Number(m.maxCompletionTokens),
      advertisedFree: true,
    };
  });
  if (
    !(
      r.resolvedModel === null ||
      (concrete(r.resolvedModel) && ids.has(r.resolvedModel))
    ) ||
    r.fallbackModels.some((id: unknown) => !concrete(id))
  )
    throw new Error("INVALID_CATALOGUE");
  return {
    models,
    preferredModel: String(r.preferredModel),
    resolvedModel: r.resolvedModel as string | null,
    fallbackModels: r.fallbackModels as string[],
  };
}
