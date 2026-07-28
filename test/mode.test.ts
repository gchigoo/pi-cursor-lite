import { describe, it, expect } from "vitest";
import { resolveMode, type CursorLiteMode } from "../src/mode.js";
import { CursorLiteError } from "../src/error.js";

describe("resolveMode", () => {
  const ENV_KEY = "PI_CURSOR_MODE";

  function withEnv(value: string | undefined): CursorLiteMode {
    const prev = process.env[ENV_KEY];
    try {
      if (value === undefined) {
        delete process.env[ENV_KEY];
      } else {
        process.env[ENV_KEY] = value;
      }
      return resolveMode();
    } finally {
      if (prev === undefined) {
        delete process.env[ENV_KEY];
      } else {
        process.env[ENV_KEY] = prev;
      }
    }
  }

  it("defaults to plan when env is unset", () => {
    expect(withEnv(undefined)).toBe("plan");
  });

  it("defaults to plan when env is empty", () => {
    expect(withEnv("")).toBe("plan");
  });

  it('returns plan for "plan"', () => {
    expect(withEnv("plan")).toBe("plan");
  });

  it('returns agent for "agent"', () => {
    expect(withEnv("agent")).toBe("agent");
  });

  it("throws CONFIG/configure for illegal value", () => {
    expect(() => withEnv("execute")).toThrow(CursorLiteError);
    try {
      withEnv("execute");
    } catch (err) {
      expect(err).toBeInstanceOf(CursorLiteError);
      const ce = err as CursorLiteError;
      expect(ce.code).toBe("CONFIG");
      expect(ce.phase).toBe("configure");
    }
  });
});
