import { describe, it, expect } from "vitest";
import type { AssistantMessageEvent } from "@earendil-works/pi-ai";
import { createStreamSimple, setCwd } from "../src/stream.js";
import type { CursorSdkPort, CursorRunResult, CursorRunSink } from "../src/sdk-port.js";
import type { Context, Model, Api } from "@earendil-works/pi-ai";

/** A fake Cursor SDK port for deterministic integration tests. */
class FakeSdk implements CursorSdkPort {
  listModelsCalls = 0;
  runCalls = 0;
  // Configurable behavior per test
  runResult: CursorRunResult = { status: "finished", finalText: "hello" };
  runDelay = 0;
  throwOnRun: Error | null = null;
  // Record sink calls for assertion
  sunkText: string[] = [];
  sunkThinking: string[] = [];
  // Signal to abort mid-stream
  abortAfterText = -1;

  async listModels() {
    this.listModelsCalls++;
    return [{ id: "test-model", displayName: "Test" }];
  }

  async run(input: { signal?: AbortSignal }, sink: CursorRunSink): Promise<CursorRunResult> {
    this.runCalls++;
    if (this.throwOnRun) throw this.throwOnRun;

    // Simulate streaming
    sink.text("Hello ");
    this.sunkText.push("Hello ");
    if (this.abortAfterText === 1 && input.signal) {
      // Don't abort here — let the test control it
    }
    sink.text("World");
    this.sunkText.push("World");

    sink.thinking("Hmm...");
    this.sunkThinking.push("Hmm...");

    if (this.runDelay > 0) {
      await new Promise((r) => setTimeout(r, this.runDelay));
    }

    if (input.signal?.aborted && this.runResult.status === "finished") {
      return { status: "aborted" };
    }
    return this.runResult;
  }
}

function makeTestModel(): Model<Api> {
  return {
    id: "test-model",
    name: "Test Model",
    api: "cursor-sdk-local" as Api,
    provider: "cursor-lite" as any,
    reasoning: false,
    reasoningLevels: undefined,
    thinkingLevelMap: undefined,
    baseUrl: "https://api.cursor.com",
    input: ["text"],
    contextWindow: 128000,
    maxTokens: 16384,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    headers: {},
  };
}

function makeTestContext(): Context {
  return {
    systemPrompt: "You are helpful.",
    messages: [
      { role: "user", content: "Hi", timestamp: 1 },
    ],
    tools: [],
  };
}

async function collectEvents(stream: AsyncGenerator<AssistantMessageEvent>): Promise<AssistantMessageEvent[]> {
  const events: AssistantMessageEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

describe("createStreamSimple", () => {
  it("produces start → text/text_delta → thinking → done → end", async () => {
    const fake = new FakeSdk();
    const streamSimple = createStreamSimple(fake);
    const stream = streamSimple(makeTestModel(), makeTestContext(), { apiKey: "test-key" });

    const events = await collectEvents(stream);

    // Verify event types in order
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("start");
    expect(types).toContain("text_start");
    expect(types).toContain("text_delta");
    expect(types).toContain("thinking_start");
    expect(types).toContain("thinking_delta");
    expect(types[types.length - 1]).toBe("done");
  });

  it("errors on missing api key", async () => {
    const fake = new FakeSdk();
    const streamSimple = createStreamSimple(fake);
    const stream = streamSimple(makeTestModel(), makeTestContext(), {}); // no apiKey

    const events = await collectEvents(stream);
    expect(events[0].type).toBe("error");
    if (events[0].type === "error") {
      expect(events[0].error.errorMessage).toContain("No API key");
    }
  });

  it("emits aborted error when signal fires before done", async () => {
    const fake = new FakeSdk();
    fake.runResult = { status: "finished" };
    fake.runDelay = 100; // slow run so we can abort

    const ctrl = new AbortController();
    const streamSimple = createStreamSimple(fake);
    const stream = streamSimple(makeTestModel(), makeTestContext(), {
      apiKey: "test-key",
      signal: ctrl.signal,
    });

    // Collect events asynchronously
    const eventsPromise = collectEvents(stream);
    // Abort after a short delay
    setTimeout(() => ctrl.abort(), 10);

    const events = await eventsPromise;
    const last = events[events.length - 1];
    expect(last.type).toBe("error");
    if (last.type === "error") {
      expect(last.reason).toBe("aborted");
    }
  });

  it("trusts a definitive finished result even if the signal fires before delivery", async () => {
    const controller = new AbortController();
    const sdk: CursorSdkPort = {
      listModels: async () => [],
      run: async () => {
        controller.abort();
        return { status: "finished", finalText: "completed" };
      },
    };

    const streamSimple = createStreamSimple(sdk);
    const stream = streamSimple(makeTestModel(), makeTestContext(), {
      apiKey: "test-key",
      signal: controller.signal,
    });

    const events = await collectEvents(stream);
    expect(events[events.length - 1].type).toBe("done");
  });

  it("handles SDK returning aborted status", async () => {
    const fake = new FakeSdk();
    fake.runResult = { status: "aborted" };

    const streamSimple = createStreamSimple(fake);
    const stream = streamSimple(makeTestModel(), makeTestContext(), { apiKey: "test-key" });

    const events = await collectEvents(stream);
    const last = events[events.length - 1];
    expect(last.type).toBe("error");
    if (last.type === "error") {
      expect(last.reason).toBe("aborted");
    }
  });

  it("maps an SDK error terminal state to a Pi error event", async () => {
    const fake = new FakeSdk();
    fake.runResult = { status: "error", error: "run failed" };

    const streamSimple = createStreamSimple(fake);
    const stream = streamSimple(makeTestModel(), makeTestContext(), { apiKey: "test-key" });

    const events = await collectEvents(stream);
    const last = events[events.length - 1];
    expect(last.type).toBe("error");
    if (last.type === "error") {
      expect(last.reason).toBe("error");
      expect(last.error.errorMessage).toBe("run failed");
    }
  });

  it("does not hide a cancellation failure behind an aborted signal", async () => {
    const fake = new FakeSdk();
    fake.runResult = { status: "error", error: "Failed to cancel Cursor run" };
    const controller = new AbortController();
    controller.abort();

    const streamSimple = createStreamSimple(fake);
    const stream = streamSimple(makeTestModel(), makeTestContext(), {
      apiKey: "test-key",
      signal: controller.signal,
    });

    const events = await collectEvents(stream);
    const last = events[events.length - 1];
    expect(last.type).toBe("error");
    if (last.type === "error") {
      expect(last.reason).toBe("error");
      expect(last.error.errorMessage).toContain("Failed to cancel");
    }
  });

  it("handles SDK throwing an error", async () => {
    const fake = new FakeSdk();
    fake.throwOnRun = new Error("SDK crashed");

    const streamSimple = createStreamSimple(fake);
    const stream = streamSimple(makeTestModel(), makeTestContext(), { apiKey: "test-key" });

    const events = await collectEvents(stream);
    const last = events[events.length - 1];
    expect(last.type).toBe("error");
    if (last.type === "error") {
      expect(last.error.errorMessage).toContain("SDK crashed");
    }
  });

  it("passes text deltas through sink", async () => {
    const fake = new FakeSdk();
    const streamSimple = createStreamSimple(fake);
    const stream = streamSimple(makeTestModel(), makeTestContext(), { apiKey: "test-key" });

    await collectEvents(stream);
    expect(fake.sunkText).toEqual(["Hello ", "World"]);
    expect(fake.sunkThinking).toEqual(["Hmm..."]);
  });
});
