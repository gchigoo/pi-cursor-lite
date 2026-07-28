import { describe, it, expect } from "vitest";
import { CursorLiteError } from "../src/error.js";

describe("CursorLiteError", () => {
  it("formats with expected message prefix", () => {
    const err = new CursorLiteError("AUTH", "configure", "bad key");
    expect(err.name).toBe("CursorLiteError");
    expect(err.code).toBe("AUTH");
    expect(err.phase).toBe("configure");
    expect(err.message).toMatch(/^CURSOR_LITE_AUTH phase=configure: bad key$/);
  });

  it("includes optional requestId", () => {
    const err = new CursorLiteError("SDK", "run", "timeout", "abc-123");
    expect(err.message).toMatch(/requestId=abc-123/);
    expect(err.requestId).toBe("abc-123");
  });

  it("throws on invalid code", () => {
    expect(() => new CursorLiteError("INVALID" as any, "configure", "x")).toThrow();
  });

  it("throws on invalid phase", () => {
    expect(() => new CursorLiteError("AUTH", "bad-phase" as any, "x")).toThrow();
  });
});
