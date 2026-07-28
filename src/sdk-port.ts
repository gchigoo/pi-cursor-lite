import type { CursorLiteMode } from "./mode.js";

/** Minimal projection of a Cursor model for the Pi catalog. */
export interface CursorCatalogModel {
  id: string;
  displayName: string;
}

/**
 * Token usage mapped from Cursor SDK to Pi shape.
 * `totalTokens` equals input + output + cacheRead + cacheWrite;
 * `reasoningTokens` is a subset of `output`.
 */
export interface CursorRunUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning?: number;
  totalTokens: number;
}

/** Result of a one-shot Cursor Agent run. */
export interface CursorRunResult {
  status: "finished" | "error" | "aborted";
  finalText?: string;
  error?: string;
  modelId?: string;
  requestId?: string;
  usage?: CursorRunUsage;
}

/** Sink callbacks for streaming text and thinking deltas from the Cursor SDK. */
export interface CursorRunSink {
  text(delta: string): void;
  thinking(delta: string): void;
}

/**
 * Abstract port for the Cursor SDK.
 * - `listModels` discovers models from the Cursor API.
 * - `run` executes a one-shot agent run and streams deltas to the sink.
 */
export interface CursorSdkPort {
  listModels(input: { apiKey: string; signal?: AbortSignal }): Promise<CursorCatalogModel[]>;
  run(
    input: {
      apiKey: string;
      modelId: string;
      mode: CursorLiteMode;
      cwd: string;
      prompt: string;
      signal?: AbortSignal;
    },
    sink: CursorRunSink,
  ): Promise<CursorRunResult>;
}
