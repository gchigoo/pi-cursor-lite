import { CursorLiteError } from "./error.js";

/**
 * Replace sensitive values in error messages:
 * - CURSOR_API_KEY values (sk-ant-..., sk-cursor-...)
 * - Bearer tokens and Authorization headers
 * - Temp paths matching pi-cursor-lite-*
 * - Full prompts (truncate long messages)
 * - Non-printable control characters
 */
export function sanitizeError(err: unknown): string {
  let msg: string;
  if (err instanceof CursorLiteError) {
    // CursorLiteError already has a sanitized message; just strip any
    // leaked sensitive data that may have slipped through.
    msg = err.message;
  } else if (err instanceof Error) {
    msg = err.message;
  } else {
    msg = String(err);
  }

  // Redact API keys
  msg = msg.replace(/sk-ant-[a-zA-Z0-9_-]+/g, "sk-ant-***");
  msg = msg.replace(/sk-cursor-[a-zA-Z0-9_-]+/g, "sk-cursor-***");
  msg = msg.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "Bearer ***");
  msg = msg.replace(/Authorization:\s*[^\n\r,;]+/gi, "Authorization: ***");

  // Redact temp paths
  msg = msg.replace(/[/\\][^\s"',;]*pi-cursor-lite-[^\s"',;]*/g, "<temp>/pi-cursor-lite-***");

  // Redact key-like hex/base64 tokens (long hex strings or base64 with = padding)
  msg = msg.replace(/\b[a-f0-9]{64,}\b/gi, "<redacted-key>");
  msg = msg.replace(/\b[A-Za-z0-9+/=]{80,}\b/g, "<redacted-key>");

  // Strip control characters (except common whitespace)
  msg = msg.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Truncate to 500 chars
  if (msg.length > 500) {
    msg = msg.slice(0, 497) + "...";
  }

  return msg;
}

/**
 * Validate that a request ID is safe (alphanumeric, hyphens, underscores, dots, max 128 chars).
 * Returns the ID if safe, or undefined.
 */
export function safeRequestId(id: unknown): string | undefined {
  if (typeof id !== "string") return undefined;
  if (id.length > 128) return undefined;
  if (/^[a-zA-Z0-9\-_.]+$/.test(id)) return id;
  return undefined;
}
