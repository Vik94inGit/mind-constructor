// Shared by every controller's catch block. Each action in this codebase
// used to repeat the same shape by hand: check ValidationError first (always
// 400, from abl/errors.ts), then walk its own list of domain-specific error
// classes imported from its own ABL module, then fall back to
// console.error(...) + 500. This is a mechanical extraction of that shape —
// not a behavior change — so every controller still imports its own error
// classes from its own ABL module and passes them in via `mappings`.
import type { Response } from "express";
import { ValidationError } from "../abl/errors.js";

// The JSON body an error mapping produces — always includes `success: false`
// (added by handleAblError itself), so a mapping only ever supplies the rest.
// A plain string is the common case (a fixed error message); a function lets
// a handler pull extra fields off the error itself (e.g. WeaponOnCooldownError's
// own `readyAt`).
type ErrorBody<E> = string | ((error: E) => Record<string, unknown>);

export type ErrorMapping<E extends Error = Error> = [
  errorClass: new (...args: any[]) => E,
  status: number,
  body: ErrorBody<E>,
];

// Checked after every mapping fails to match — the message + status logged/
// sent when `error` isn't a ValidationError or any of the caller's own
// mapped classes.
export interface FallbackResponse {
  status?: number; // defaults to 500
  message: string;
  logLabel: string; // e.g. "createNode" -> logs "createNode error:"
}

export function handleAblError(
  res: Response,
  error: unknown,
  mappings: ErrorMapping[],
  fallback: FallbackResponse,
): Response {
  if (error instanceof ValidationError) {
    return res.status(400).json({ success: false, error: error.message });
  }

  for (const [ErrorClass, status, body] of mappings) {
    if (error instanceof ErrorClass) {
      const extra = typeof body === "string" ? { error: body } : body(error);
      return res.status(status).json({ success: false, ...extra });
    }
  }

  console.error(`${fallback.logLabel} error:`, error);
  return res.status(fallback.status ?? 500).json({ success: false, error: fallback.message });
}
