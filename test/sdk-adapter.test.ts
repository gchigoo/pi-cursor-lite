import { beforeEach, describe, expect, it, vi } from "vitest";

const sdkMocks = vi.hoisted(() => ({
  agentCreate: vi.fn(),
  modelsList: vi.fn(),
}));

vi.mock("@cursor/sdk", () => ({
  Agent: { create: sdkMocks.agentCreate },
  Cursor: { models: { list: sdkMocks.modelsList } },
  JsonlLocalAgentStore: class JsonlLocalAgentStore {
    constructor(_rootDir: string) {}
  },
}));

import { createCursorSdkAdapter } from "../src/sdk-adapter.js";

const sink = { text: vi.fn(), thinking: vi.fn() };
const baseInput = {
  apiKey: "test-key",
  modelId: "test-model",
  mode: "plan" as const,
  cwd: process.cwd(),
  prompt: "hello",
};

function makeAgent(run: object) {
  return {
    send: vi.fn().mockResolvedValue(run),
    [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
  };
}

function makeRun(result: object) {
  return {
    supports: vi.fn().mockReturnValue(true),
    unsupportedReason: vi.fn().mockReturnValue(undefined),
    wait: vi.fn().mockResolvedValue(result),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
}

describe("createCursorSdkAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps Pi auto to the Cursor default model id", async () => {
    const run = makeRun({ id: "run-1", status: "finished", result: "ok" });
    sdkMocks.agentCreate.mockResolvedValue(makeAgent(run));

    const result = await createCursorSdkAdapter().run(
      { ...baseInput, modelId: "auto" },
      sink,
    );

    expect(result.status).toBe("finished");
    expect(sdkMocks.agentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: { id: "default" } }),
    );
  });

  it("maps SDK error and cancelled terminal states", async () => {
    const errorRun = makeRun({
      id: "run-error",
      status: "error",
      error: { message: "terminal failure" },
    });
    sdkMocks.agentCreate.mockResolvedValueOnce(makeAgent(errorRun));

    await expect(createCursorSdkAdapter().run(baseInput, sink)).resolves.toMatchObject({
      status: "error",
      error: "terminal failure",
    });

    const cancelledRun = makeRun({ id: "run-cancelled", status: "cancelled" });
    sdkMocks.agentCreate.mockResolvedValueOnce(makeAgent(cancelledRun));

    await expect(createCursorSdkAdapter().run(baseInput, sink)).resolves.toMatchObject({
      status: "aborted",
    });
  });

  it("cancels the active Cursor run when Pi aborts", async () => {
    let resolveWait!: (result: object) => void;
    const run = {
      supports: vi.fn().mockReturnValue(true),
      unsupportedReason: vi.fn().mockReturnValue(undefined),
      wait: vi.fn(() => new Promise<object>((resolve) => { resolveWait = resolve; })),
      cancel: vi.fn(async () => resolveWait({ id: "run-2", status: "cancelled" })),
    };
    const agent = makeAgent(run);
    sdkMocks.agentCreate.mockResolvedValue(agent);
    const controller = new AbortController();

    const resultPromise = createCursorSdkAdapter().run(
      { ...baseInput, signal: controller.signal },
      sink,
    );
    await vi.waitFor(() => expect(run.wait).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(resultPromise).resolves.toMatchObject({ status: "aborted" });
    expect(run.cancel).toHaveBeenCalledTimes(1);
  });

  it("returns aborted when cancel succeeds and safely ignores a late wait rejection", async () => {
    let rejectWait!: (reason: unknown) => void;
    const run = {
      supports: vi.fn().mockReturnValue(true),
      unsupportedReason: vi.fn().mockReturnValue(undefined),
      wait: vi.fn(() => new Promise<object>((_resolve, reject) => { rejectWait = reject; })),
      cancel: vi.fn().mockResolvedValue(undefined),
    };
    sdkMocks.agentCreate.mockResolvedValue(makeAgent(run));
    const controller = new AbortController();

    const resultPromise = createCursorSdkAdapter().run(
      { ...baseInput, signal: controller.signal },
      sink,
    );
    await vi.waitFor(() => expect(run.wait).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(resultPromise).resolves.toMatchObject({ status: "aborted" });
    expect(run.cancel).toHaveBeenCalledTimes(1);
    rejectWait(new Error("late wait rejection"));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("keeps a finished terminal state when wait wins before cancellation settles", async () => {
    let resolveWait!: (result: object) => void;
    const run = {
      supports: vi.fn().mockReturnValue(true),
      unsupportedReason: vi.fn().mockReturnValue(undefined),
      wait: vi.fn(() => new Promise<object>((resolve) => { resolveWait = resolve; })),
      cancel: vi.fn(() => new Promise<void>(() => undefined)),
    };
    sdkMocks.agentCreate.mockResolvedValue(makeAgent(run));
    const controller = new AbortController();

    const resultPromise = createCursorSdkAdapter().run(
      { ...baseInput, signal: controller.signal },
      sink,
    );
    await vi.waitFor(() => expect(run.wait).toHaveBeenCalledTimes(1));
    controller.abort();
    resolveWait({ id: "run-finished", status: "finished", result: "done" });

    await expect(resultPromise).resolves.toMatchObject({
      status: "finished",
      finalText: "done",
    });
  });

  it("reports an error when the active run does not support cancellation", async () => {
    const run = {
      supports: vi.fn().mockReturnValue(false),
      unsupportedReason: vi.fn().mockReturnValue("local cancellation unavailable"),
      wait: vi.fn(() => new Promise<object>(() => undefined)),
      cancel: vi.fn(),
    };
    sdkMocks.agentCreate.mockResolvedValue(makeAgent(run));
    const controller = new AbortController();

    const resultPromise = createCursorSdkAdapter().run(
      { ...baseInput, signal: controller.signal },
      sink,
    );
    await vi.waitFor(() => expect(run.wait).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(resultPromise).resolves.toMatchObject({
      status: "error",
      error: expect.stringContaining("local cancellation unavailable"),
    });
    expect(run.cancel).not.toHaveBeenCalled();
  });

  it("reports an error when cancelling the active run fails", async () => {
    const run = {
      supports: vi.fn().mockReturnValue(true),
      unsupportedReason: vi.fn().mockReturnValue(undefined),
      wait: vi.fn(() => new Promise<object>(() => undefined)),
      cancel: vi.fn().mockRejectedValue(new Error("cancel transport failed")),
    };
    sdkMocks.agentCreate.mockResolvedValue(makeAgent(run));
    const controller = new AbortController();

    const resultPromise = createCursorSdkAdapter().run(
      { ...baseInput, signal: controller.signal },
      sink,
    );
    await vi.waitFor(() => expect(run.wait).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(resultPromise).resolves.toMatchObject({
      status: "error",
      error: expect.stringContaining("cancel transport failed"),
    });
  });

  it("cancels a run returned after the signal fired during send", async () => {
    let resolveSend!: (run: object) => void;
    const run = makeRun({ id: "run-3", status: "cancelled" });
    const agent = {
      send: vi.fn(() => new Promise<object>((resolve) => { resolveSend = resolve; })),
      [Symbol.asyncDispose]: vi.fn().mockResolvedValue(undefined),
    };
    sdkMocks.agentCreate.mockResolvedValue(agent);
    const controller = new AbortController();

    const resultPromise = createCursorSdkAdapter().run(
      { ...baseInput, signal: controller.signal },
      sink,
    );
    await vi.waitFor(() => expect(agent.send).toHaveBeenCalledTimes(1));
    controller.abort();
    resolveSend(run);

    await expect(resultPromise).resolves.toMatchObject({ status: "aborted" });
    expect(run.cancel).toHaveBeenCalledTimes(1);
  });

  it("does not create an agent for an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(createCursorSdkAdapter().run(
      { ...baseInput, signal: controller.signal },
      sink,
    )).resolves.toMatchObject({ status: "aborted" });
    expect(sdkMocks.agentCreate).not.toHaveBeenCalled();
  });
});
