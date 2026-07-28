import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { AUTO_FALLBACK, createRefreshModels } from "../src/catalog.js";
import type { CursorSdkPort } from "../src/sdk-port.js";

describe("Pi modelOverrides integration", () => {
  it("applies user metadata above dynamically refreshed Cursor models", async () => {
    const configDir = await mkdtemp(join(tmpdir(), "pi-cursor-lite-overrides-"));
    const modelsPath = join(configDir, "models.json");
    const authPath = join(configDir, "auth.json");

    try {
      await writeFile(
        modelsPath,
        JSON.stringify({
          providers: {
            "cursor-lite": {
              modelOverrides: {
                "grok-4.5": {
                  contextWindow: 222222,
                  maxTokens: 12345,
                },
              },
            },
          },
        }),
      );
      await writeFile(authPath, "{}");

      const sdk: CursorSdkPort = {
        listModels: async () => [{ id: "grok-4.5", displayName: "Cursor Grok 4.5" }],
        run: async () => ({ status: "finished" }),
      };
      const runtime = await ModelRuntime.create({
        authPath,
        modelsPath,
        allowModelNetwork: false,
      });

      runtime.registerProvider("cursor-lite", {
        baseUrl: "https://api.cursor.com",
        apiKey: "test-key",
        api: "cursor-sdk-local",
        models: [AUTO_FALLBACK],
        refreshModels: createRefreshModels(sdk),
        streamSimple: () => {
          throw new Error("not used by this test");
        },
      });

      const provider = runtime.getProvider("cursor-lite");
      expect(provider?.refreshModels).toBeTypeOf("function");
      await provider?.refreshModels?.({
        credential: { type: "api_key", key: "test-key" },
        allowNetwork: true,
      });

      expect(runtime.getModel("cursor-lite", "grok-4.5")).toMatchObject({
        contextWindow: 222222,
        maxTokens: 12345,
      });
    } finally {
      await rm(configDir, { recursive: true, force: true });
    }
  });
});
