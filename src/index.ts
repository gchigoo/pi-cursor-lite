/**
 * pi-cursor-lite — Lightweight Cursor model Provider for Pi.
 *
 * Registers a "cursor-lite" provider that lets Pi users select Cursor models
 * via `/model`. Each request creates an independent one-shot Cursor Local Agent
 * run, streams back text/thinking, and disposes all temporary resources.
 *
 * Default mode is `plan` ("先规划"); set `PI_CURSOR_MODE=agent` at Pi process
 * startup to enable the `agent` execution mode.
 *
 * Requires a Cursor SDK API Key (set via `CURSOR_API_KEY` environment variable,
 * Pi `/login cursor-lite`, or `--api-key`). Does NOT reuse Cursor Desktop/CLI
 * login state.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { AUTO_FALLBACK, createRefreshModels } from "./catalog.js";
import { createCursorSdkAdapter } from "./sdk-adapter.js";
import { createStreamSimple, setCwd } from "./stream.js";

export default function (pi: ExtensionAPI) {
  const sdk = createCursorSdkAdapter();
  const refreshModels = createRefreshModels(sdk);
  const streamSimple = createStreamSimple(sdk);

  // Track current working directory
  pi.on("session_start", async (_event, ctx) => {
    setCwd(ctx.cwd);
  });

  pi.registerProvider("cursor-lite", {
    baseUrl: "https://api.cursor.com",
    apiKey: "$CURSOR_API_KEY",
    api: "cursor-sdk-local",
    models: [AUTO_FALLBACK],
    refreshModels,
    streamSimple,
  });
}
