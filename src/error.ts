/** Error codes and phases for cursor-lite Provider errors. */

export type CursorLiteCode = "CONFIG" | "AUTH" | "INPUT" | "CATALOG" | "SDK" | "CLEANUP";
export type CursorLitePhase = "configure" | "catalog" | "prepare" | "create" | "run" | "cleanup";

const ALL_CODES: ReadonlySet<string> = new Set([
  "CONFIG", "AUTH", "INPUT", "CATALOG", "SDK", "CLEANUP",
]);

const ALL_PHASES: ReadonlySet<string> = new Set([
  "configure", "catalog", "prepare", "create", "run", "cleanup",
]);

export class CursorLiteError extends Error {
  readonly code: CursorLiteCode;
  readonly phase: CursorLitePhase;
  readonly requestId?: string;

  constructor(
    code: CursorLiteCode,
    phase: CursorLitePhase,
    message: string,
    requestId?: string,
    options?: ErrorOptions,
  ) {
    if (!ALL_CODES.has(code)) throw new Error(`Invalid CursorLiteError code: ${code}`);
    if (!ALL_PHASES.has(phase)) throw new Error(`Invalid CursorLiteError phase: ${phase}`);
    super(`CURSOR_LITE_${code} phase=${phase}${requestId ? ` requestId=${requestId}` : ""}: ${message}`, options);
    this.name = "CursorLiteError";
    this.code = code;
    this.phase = phase;
    this.requestId = requestId;
  }
}
