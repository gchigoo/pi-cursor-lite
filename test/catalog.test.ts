import { describe, it, expect } from "vitest";
import { createRefreshModels, AUTO_FALLBACK } from "../src/catalog.js";
import type { CursorSdkPort, CursorCatalogModel } from "../src/sdk-port.js";
import type { RefreshModelsContext } from "@earendil-works/pi-ai";

function fakeContext(overrides: Partial<RefreshModelsContext> = {}): RefreshModelsContext {
  return {
    credential: { type: "api_key", key: "test-key" },
    store: {} as any,
    allowNetwork: true,
    ...overrides,
  };
}

describe("createRefreshModels", () => {
  it("returns only auto when allowNetwork is false", async () => {
    const sdk: CursorSdkPort = { listModels: async () => [], run: async () => ({ status: "finished" }) };
    const refresh = createRefreshModels(sdk);
    const models = await refresh(fakeContext({ allowNetwork: false }));
    expect(models).toEqual([AUTO_FALLBACK]);
  });

  it("returns only auto when no credential", async () => {
    const sdk: CursorSdkPort = { listModels: async () => [], run: async () => ({ status: "finished" }) };
    const refresh = createRefreshModels(sdk);
    const models = await refresh(fakeContext({ credential: undefined }));
    expect(models).toEqual([AUTO_FALLBACK]);
  });

  it("returns only auto when credential is oauth type", async () => {
    const sdk: CursorSdkPort = { listModels: async () => [], run: async () => ({ status: "finished" }) };
    const refresh = createRefreshModels(sdk);
    const models = await refresh(fakeContext({ credential: { type: "oauth", access: "x" } }));
    expect(models).toEqual([AUTO_FALLBACK]);
  });

  it("merges auto + sdk models with auto first", async () => {
    const fakeModels: CursorCatalogModel[] = [
      { id: "composer-2.5", displayName: "Composer 2.5" },
      { id: "gpt-5.4", displayName: "GPT 5.4" },
    ];
    const sdk: CursorSdkPort = {
      listModels: async () => fakeModels,
      run: async () => ({ status: "finished" }),
    };
    const refresh = createRefreshModels(sdk);
    const models = await refresh(fakeContext());
    expect(models).toHaveLength(3);
    expect(models[0].id).toBe("auto");
    expect(models[1].id).toBe("composer-2.5");
    expect(models[1].contextWindow).toBe(128000);
    expect(models[2].id).toBe("gpt-5.4");
  });

  it("uses Cursor's documented 256k context window for grok-4.5", async () => {
    const sdk: CursorSdkPort = {
      listModels: async () => [{ id: "grok-4.5", displayName: "Cursor Grok 4.5" }],
      run: async () => ({ status: "finished" }),
    };
    const refresh = createRefreshModels(sdk);
    const models = await refresh(fakeContext());
    const grok = models.find((model) => model.id === "grok-4.5");

    expect(grok?.contextWindow).toBe(256000);
  });

  it("deduplicates by id (first occurrence wins)", async () => {
    const fakeModels: CursorCatalogModel[] = [
      { id: "auto", displayName: "Auto (dup)" },
      { id: "composer-2.5", displayName: "Composer" },
    ];
    const sdk: CursorSdkPort = {
      listModels: async () => fakeModels,
      run: async () => ({ status: "finished" }),
    };
    const refresh = createRefreshModels(sdk);
    const models = await refresh(fakeContext());
    // auto should appear only once
    expect(models.filter((m) => m.id === "auto")).toHaveLength(1);
  });

  it("throws CATALOG error when SDK fails", async () => {
    const sdk: CursorSdkPort = {
      listModels: async () => { throw new Error("Network error"); },
      run: async () => ({ status: "finished" }),
    };
    const refresh = createRefreshModels(sdk);
    await expect(refresh(fakeContext())).rejects.toThrow("CURSOR_LITE_CATALOG");
  });

  it("throws CATALOG error when SDK returns empty array", async () => {
    const sdk: CursorSdkPort = {
      listModels: async () => [],
      run: async () => ({ status: "finished" }),
    };
    const refresh = createRefreshModels(sdk);
    await expect(refresh(fakeContext())).rejects.toThrow("CURSOR_LITE_CATALOG");
  });
});
