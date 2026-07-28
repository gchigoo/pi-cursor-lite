import {
  calculateCost,
  createAssistantMessageEventStream,
  type Api,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type Model,
  type SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import { CursorLiteError } from "./error.js";
import { sanitizeError, safeRequestId } from "./sanitize.js";
import { buildPiContextEnvelope } from "./context.js";
import { resolveMode } from "./mode.js";
import type { CursorSdkPort, CursorRunSink } from "./sdk-port.js";

/**
 * Create the `streamSimple` callback for the Provider.
 * Each call creates a fresh one-shot Cursor Agent run, maps deltas
 * to Pi stream events, and cleans up when done or aborted.
 */
export function createStreamSimple(sdk: CursorSdkPort) {
  return function streamCursorOneShot(
    model: Model<Api>,
    context: Context,
    options?: SimpleStreamOptions,
  ): AssistantMessageEventStream {
    const stream = createAssistantMessageEventStream();

    // Snapshot mode at request time
    let mode: ReturnType<typeof resolveMode>;
    try {
      mode = resolveMode();
    } catch (err) {
      const output = createEmptyOutput(model);
      output.stopReason = "error";
      output.errorMessage = sanitizeError(err);
      stream.push({ type: "error", reason: "error", error: output });
      stream.end();
      return stream;
    }

    const output = createEmptyOutput(model);
    const cwd = getCurrentCwd();

    (async () => {
      try {
        const apiKey = options?.apiKey;
        if (!apiKey) {
          throw new CursorLiteError("AUTH", "configure", "No API key available for cursor-lite");
        }

        const prompt = buildPiContextEnvelope(context);

        // Create sink that maps Cursor deltas → Pi stream events
        const sink: CursorRunSink = {
          text(delta: string) {
            if (output.content.length === 0 || output.content[output.content.length - 1].type !== "text") {
              output.content.push({ type: "text", text: "" });
              stream.push({ type: "text_start", contentIndex: output.content.length - 1, partial: output });
            }
            const block = output.content[output.content.length - 1] as { type: "text"; text: string };
            block.text += delta;
            stream.push({ type: "text_delta", contentIndex: output.content.length - 1, delta, partial: output });
          },
          thinking(delta: string) {
            if (
              output.content.length === 0 ||
              output.content[output.content.length - 1].type !== "thinking"
            ) {
              (output.content as any[]).push({ type: "thinking", thinking: "" });
              stream.push({
                type: "thinking_start",
                contentIndex: output.content.length - 1,
                partial: output,
              });
            }
            const block = output.content[output.content.length - 1] as {
              type: "thinking";
              thinking: string;
            };
            block.thinking += delta;
            stream.push({
              type: "thinking_delta",
              contentIndex: output.content.length - 1,
              delta,
              partial: output,
            });
          },
        };

        // Push start event
        stream.push({ type: "start", partial: output });

        const result = await sdk.run(
          { apiKey, modelId: model.id, mode, cwd, prompt, signal: options?.signal },
          sink,
        );

        // A cancellation failure must remain visible even though Pi's signal is aborted.
        if (result.status === "error") {
          output.stopReason = "error";
          output.errorMessage = result.error ?? "Cursor run failed";
          stream.push({ type: "error", reason: "error", error: output });
          stream.end();
          return;
        }

        if (result.status === "aborted") {
          output.stopReason = "aborted";
          stream.push({ type: "error", reason: "aborted", error: output });
          stream.end();
          return;
        }

        // Fill in usage / identity
        if (result.usage) {
          output.usage = {
            input: result.usage.input,
            output: result.usage.output,
            cacheRead: result.usage.cacheRead,
            cacheWrite: result.usage.cacheWrite,
            totalTokens: result.usage.totalTokens,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            ...(result.usage.reasoning !== undefined ? { reasoning: result.usage.reasoning } : {}),
          };
          calculateCost(model, output.usage);
        }

        output.responseModel = result.modelId;
        output.responseId = result.requestId;

        // If no text content was produced but result has text, append a text block
        if (result.finalText) {
          const hasText = output.content.some((c: { type: string }) => c.type === "text");
          if (!hasText) {
            output.content.push({ type: "text", text: result.finalText });
          }
        }

        output.stopReason = "stop";
        stream.push({ type: "done", reason: "stop", message: output });
        stream.end();
      } catch (err) {
        output.stopReason = options?.signal?.aborted ? "aborted" : "error";
        output.errorMessage = sanitizeError(err);
        stream.push({
          type: "error",
          reason: output.stopReason,
          error: output,
        });
        stream.end();
      }
    })();

    return stream;
  };
}

function createEmptyOutput(model: Model<Api>): AssistantMessage {
  return {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

// ---- cwd management ----

let currentCwd: string = process.cwd();

export function setCwd(cwd: string): void {
  currentCwd = cwd;
}

function getCurrentCwd(): string {
  return currentCwd;
}
