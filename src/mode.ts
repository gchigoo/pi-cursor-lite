import { CursorLiteError } from "./error.js";

/** The two supported Cursor agent modes. */
export type CursorLiteMode = "plan" | "agent";

const ENV_KEY = "PI_CURSOR_MODE";

/**
 * Read the process-level Cursor mode from `PI_CURSOR_MODE`.
 * - Unset or empty → "plan"
 * - "plan" → "plan"
 * - "agent" → "agent"
 * - Any other non-empty value → throws CONFIG/configure error
 */
export function resolveMode(): CursorLiteMode {
  const raw = process.env[ENV_KEY]?.trim();
  if (!raw) return "plan";
  if (raw === "plan") return "plan";
  if (raw === "agent") return "agent";
  throw new CursorLiteError("CONFIG", "configure", `${ENV_KEY} must be "plan" or "agent", got "${raw}"`);
}
