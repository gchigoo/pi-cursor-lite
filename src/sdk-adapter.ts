/**
 * Real Cursor SDK adapter implementing CursorSdkPort.
 * Uses only public API from @cursor/sdk root package.
 */
import { Agent, Cursor, JsonlLocalAgentStore, type SDKAgent, type Run } from "@cursor/sdk";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { CursorLiteError } from "./error.js";
import { sanitizeError, safeRequestId } from "./sanitize.js";
import type { CursorSdkPort, CursorCatalogModel, CursorRunResult, CursorRunSink } from "./sdk-port.js";
import type { CursorLiteMode } from "./mode.js";
import { resolveCursorRuntimeShell, withCursorShellEnvironment } from "./runtime-shell.js";

export function createCursorSdkAdapter(): CursorSdkPort {
  return {
    async listModels(input) {
      try {
        const models = await Cursor.models.list({ apiKey: input.apiKey });
        return models.map((m) => ({
          id: m.id,
          displayName: m.displayName,
        }));
      } catch (err) {
        throw new CursorLiteError(
          "CATALOG",
          "catalog",
          sanitizeError(err),
        );
      }
    },

    async run(input, sink) {
      const rootDir = await mkdtemp(join(tmpdir(), "pi-cursor-lite-"));
      let agent: SDKAgent | undefined;
      let run: Run | undefined;
      let cancelRequested = input.signal?.aborted ?? false;
      let cancelPromise: Promise<void> | undefined;
      let cancelFailed = false;
      let cancelFailure: unknown;
      let rejectCancelFailure!: (reason: unknown) => void;
      const cancelFailurePromise = new Promise<never>((_resolve, reject) => {
        rejectCancelFailure = reject;
      });
      const cancelCompleted = Symbol("cancel-completed");
      let resolveCancelSuccess!: () => void;
      const cancelSuccessPromise = new Promise<typeof cancelCompleted>((resolve) => {
        resolveCancelSuccess = () => resolve(cancelCompleted);
      });

      const cancelRun = () => {
        cancelRequested = true;
        if (!run || cancelPromise || cancelFailed) return;

        try {
          if (!run.supports("cancel")) {
            throw new Error(run.unsupportedReason("cancel") ?? "Cursor run does not support cancellation");
          }
          cancelPromise = run.cancel()
            .then(resolveCancelSuccess)
            .catch((err) => {
              cancelFailed = true;
              cancelFailure = err;
              rejectCancelFailure(err);
            });
        } catch (err) {
          cancelFailed = true;
          cancelFailure = err;
          rejectCancelFailure(err);
        }
      };
      input.signal?.addEventListener("abort", cancelRun, { once: true });

      try {
        if (cancelRequested) {
          return { status: "aborted" as const };
        }

        const shell = resolveCursorRuntimeShell();
        const store = new JsonlLocalAgentStore(rootDir);

        agent = await Agent.create({
          apiKey: input.apiKey,
          model: { id: input.modelId === "auto" ? "default" : input.modelId },
          mode: input.mode as "plan" | "agent",
          local: {
            cwd: input.cwd,
            store,
          },
        });

        if (!agent) {
          throw new CursorLiteError("SDK", "create", "Agent.create returned undefined");
        }
        if (cancelRequested) {
          return { status: "aborted" as const };
        }

        run = await withCursorShellEnvironment(shell, () => agent!.send(input.prompt, {
          mode: input.mode as "plan" | "agent",
          onDelta: ({ update }) => {
            if (cancelRequested) return;
            if (update.type === "text-delta") {
              sink.text(update.text);
            } else if (update.type === "thinking-delta") {
              sink.thinking(update.text);
            }
            // All other update types (tool-call-*, step-*, summary-*, etc.) are silently ignored
          },
        }));

        const waitPromise = run.wait();

        // The signal may have fired while Agent.create() or agent.send() was pending.
        if (cancelRequested) cancelRun();

        // Promise.race observes losers, but explicit drains make late-rejection safety obvious.
        void waitPromise.catch(() => undefined);
        void cancelFailurePromise.catch(() => undefined);
        const outcome = await Promise.race([
          waitPromise,
          cancelFailurePromise,
          cancelSuccessPromise,
        ]);
        if (outcome === cancelCompleted) {
          return { status: "aborted" as const };
        }

        const result = outcome;

        const identity = {
          modelId: result.model?.id,
          requestId: safeRequestId(result.requestId),
        };

        if (result.status === "cancelled") {
          return { status: "aborted" as const, ...identity };
        }
        if (result.status === "error") {
          return {
            status: "error" as const,
            error: sanitizeError(result.error?.message ?? "Cursor run failed"),
            ...identity,
          };
        }

        const usage = result.usage
          ? {
              input: result.usage.inputTokens,
              output: result.usage.outputTokens,
              cacheRead: result.usage.cacheReadTokens,
              cacheWrite: result.usage.cacheWriteTokens,
              reasoning: result.usage.reasoningTokens,
              totalTokens: result.usage.totalTokens,
            }
          : undefined;

        return {
          status: "finished",
          finalText: result.result,
          ...identity,
          usage,
        };
      } catch (err) {
        if (cancelFailed) {
          return {
            status: "error" as const,
            error: `Failed to cancel Cursor run: ${sanitizeError(cancelFailure ?? "Unknown cancellation failure")}`,
          };
        }
        if (cancelRequested) {
          return {
            status: "error" as const,
            error: `Cursor run failed before cancellation was confirmed: ${sanitizeError(err)}`,
          };
        }
        throw new CursorLiteError(
          "SDK",
          "run",
          sanitizeError(err),
          undefined,
          { cause: err },
        );
      } finally {
        input.signal?.removeEventListener("abort", cancelRun);

        // Dispose agent (Symbol.asyncDispose closes the agent)
        if (agent) {
          try {
            await agent[Symbol.asyncDispose]();
          } catch {
            // Dispose failure is logged at CLEANUP level below
          }
        }

        // Delete temp store directory with retries
        await cleanupTempDir(rootDir);
      }
    },
  };
}

async function cleanupTempDir(rootDir: string, maxRetries = 5, retryDelay = 100): Promise<void> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await rm(rootDir, { recursive: true, force: true, maxRetries: 1 });
      return;
    } catch {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, retryDelay));
      }
    }
  }
  // After all retries, the temp dir may remain — residual risk accepted
}
