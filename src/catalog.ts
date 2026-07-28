import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import type { RefreshModelsContext } from "@earendil-works/pi-ai";
import { CursorLiteError } from "./error.js";
import { sanitizeError } from "./sanitize.js";
import type { CursorSdkPort } from "./sdk-port.js";

/** Fallback metadata for models whose limits aren't exposed by the Cursor SDK. */
const DEFAULT_CONTEXT_WINDOW = 128000;
const ESTIMATED_MAX_TOKENS = 16384;

/**
 * Cursor-routed limits documented by Cursor.
 * `Cursor.models.list()` exposes ids and variants, but not context sizes.
 * Source: https://cursor.com/cn/docs/models-and-pricing
 */
const CURSOR_CONTEXT_WINDOWS: Readonly<Record<string, number>> = {
  "grok-4.5": 256000,
};

function contextWindowFor(modelId: string): number {
  return CURSOR_CONTEXT_WINDOWS[modelId] ?? DEFAULT_CONTEXT_WINDOW;
}
const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

/** The static auto fallback model — always available even without a key. */
export const AUTO_FALLBACK: ProviderModelConfig = {
  id: "auto",
  name: "Cursor Auto",
  reasoning: false,
  input: ["text"],
  cost: ZERO_COST,
  contextWindow: DEFAULT_CONTEXT_WINDOW,
  maxTokens: ESTIMATED_MAX_TOKENS,
};

/**
 * Build the static ProviderModelConfig array from Cursor canonical model ids.
 * `auto` is always first; remaining models are deduplicated by first-occurrence order.
 */
function buildModelConfigs(models: Array<{ id: string; displayName: string }>): ProviderModelConfig[] {
  const seen = new Set<string>();
  const result: ProviderModelConfig[] = [];

  // auto always first
  seen.add("auto");
  result.push(AUTO_FALLBACK);

  for (const m of models) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    result.push({
      id: m.id,
      name: m.displayName,
      reasoning: false,
      input: ["text"],
      cost: ZERO_COST,
      contextWindow: contextWindowFor(m.id),
      maxTokens: ESTIMATED_MAX_TOKENS,
    });
  }

  return result;
}

/**
 * Create the `refreshModels` callback.
 * - No credential or non-api_key credential → return [AUTO_FALLBACK] only, no network.
 * - `allowNetwork=false` → return [AUTO_FALLBACK], no network.
 * - With valid api_key credential → call SDK, merge auto + canonical ids.
 */
export function createRefreshModels(sdk: CursorSdkPort) {
  return async (context: RefreshModelsContext): Promise<ProviderModelConfig[]> => {
    // Offline / no-key → just auto
    if (!context.allowNetwork) {
      return [AUTO_FALLBACK];
    }
    if (!context.credential || context.credential.type !== "api_key" || !context.credential.key) {
      return [AUTO_FALLBACK];
    }

    try {
      const models = await sdk.listModels({
        apiKey: context.credential.key,
        signal: context.signal,
      });

      if (models.length === 0) {
        throw new CursorLiteError("CATALOG", "catalog", "Cursor.models.list returned empty array");
      }

      return buildModelConfigs(models);
    } catch (err) {
      throw new CursorLiteError(
        "CATALOG",
        "catalog",
        sanitizeError(err),
      );
    }
  };
}
