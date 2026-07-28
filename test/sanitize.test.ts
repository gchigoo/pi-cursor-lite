import { describe, it, expect } from "vitest";
import { sanitizeError, safeRequestId } from "../src/sanitize.js";
import { CursorLiteError } from "../src/error.js";

describe("sanitizeError", () => {
  it("passes through CursorLiteError messages", () => {
    const err = new CursorLiteError("SDK", "run", "safe message");
    const result = sanitizeError(err);
    expect(result).toContain("safe message");
    expect(result).not.toContain("***"); // nothing to redact
  });

  it("redacts API keys", () => {
    const msg = "Failed with key sk-ant-abc123def456 and sk-cursor-xyz789";
    expect(sanitizeError(new Error(msg))).not.toMatch(/sk-ant-abc123/);
    expect(sanitizeError(new Error(msg))).not.toMatch(/sk-cursor-xyz789/);
    expect(sanitizeError(new Error(msg))).toContain("sk-ant-***");
    expect(sanitizeError(new Error(msg))).toContain("sk-cursor-***");
  });

  it("redacts Bearer tokens", () => {
    const msg = "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abcdef";
    const result = sanitizeError(new Error(msg));
    expect(result).not.toMatch(/eyJhbG/);
    expect(result).toContain("***");
  });

  it("redacts temp paths", () => {
    const msg = "Failed at /tmp/pi-cursor-lite-a1b2c3d4/store.json";
    expect(sanitizeError(new Error(msg))).not.toMatch(/pi-cursor-lite-a1b2c/);
    expect(sanitizeError(new Error(msg))).toContain("***");
  });

  it("handles non-Error values", () => {
    expect(sanitizeError("plain string")).toBe("plain string");
    expect(sanitizeError(42)).toBe("42");
    expect(sanitizeError(null)).toBe("null");
  });

  it("truncates long messages to 500 chars", () => {
    // Use characters that won't be redacted by key-like pattern regexen
    // Use '#' characters that won't match hex or base64 key patterns
    const long = "#".repeat(600);
    const result = sanitizeError(new Error(long));
    expect(result.length).toBeLessThanOrEqual(500);
    expect(result.endsWith("...")).toBe(true);
  });
});

describe("safeRequestId", () => {
  it("returns safe ids", () => {
    expect(safeRequestId("abc-123")).toBe("abc-123");
    expect(safeRequestId("req_abc.123")).toBe("req_abc.123");
  });

  it("returns undefined for unsafe ids", () => {
    expect(safeRequestId("a b")).toBeUndefined();
    expect(safeRequestId("a\nb")).toBeUndefined();
    expect(safeRequestId(undefined)).toBeUndefined();
    expect(safeRequestId(42 as any)).toBeUndefined();
  });

  it("rejects ids longer than 128 chars", () => {
    expect(safeRequestId("x".repeat(129))).toBeUndefined();
    expect(safeRequestId("x".repeat(128))).toBe("x".repeat(128));
  });
});
