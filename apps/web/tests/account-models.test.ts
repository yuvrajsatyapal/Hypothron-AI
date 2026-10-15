import { describe, expect, it } from "vitest";
import { validateAccount } from "../lib/account";
import { validateModelCatalogue } from "../lib/models";

describe("account and model response boundaries", () => {
  it("requires a bounded opaque account token without accepting extra secrets", () => {
    expect(
      validateAccount({
        id: "owner",
        email: "user@example.com",
        token: "x".repeat(43),
      }).email,
    ).toBe("user@example.com");
    expect(() =>
      validateAccount({
        id: "owner",
        email: "user@example.com",
        token: "short",
      }),
    ).toThrow();
    expect(() =>
      validateAccount({
        id: "owner",
        email: "user@example.com",
        token: "x".repeat(43),
        key: "secret",
      }),
    ).toThrow();
  });
  it("accepts only unique concrete free compatible model metadata", () => {
    const model = {
      id: "author/model:free",
      name: "Model",
      contextLength: 32768,
      maxCompletionTokens: 1024,
      advertisedFree: true,
    };
    const catalogue = {
      models: [model],
      preferredModel: "auto",
      resolvedModel: model.id,
      fallbackModels: [],
    };
    expect(validateModelCatalogue(catalogue).resolvedModel).toBe(model.id);
    expect(() =>
      validateModelCatalogue({ ...catalogue, models: [model, model] }),
    ).toThrow();
    expect(() =>
      validateModelCatalogue({
        ...catalogue,
        models: [{ ...model, advertisedFree: false }],
      }),
    ).toThrow();
    expect(() =>
      validateModelCatalogue({ ...catalogue, resolvedModel: "missing/model" }),
    ).toThrow();
    expect(() =>
      validateModelCatalogue({
        ...catalogue,
        models: [{ ...model, id: "openrouter/free" }],
      }),
    ).toThrow();
  });
});
