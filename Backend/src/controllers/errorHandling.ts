// Shared by every controller's catch block, so no action has to repeat this
// shape by hand: check ValidationError first (always 400, from abl/errors.ts),
// then walk the caller's own list of domain-specific error classes, then fall
// back to console.error(...) + 500. Every controller still imports its own
// error classes from its own ABL module and passes them in via `mappings`.
import type { Request, Response } from "express";
import { MapFinishedError, ValidationError } from "../abl/errors.js";

// The JSON body an error mapping produces — always includes `success: false`
// (added by handleAblError itself), so a mapping only ever supplies the rest.
// A plain string is the common case (a fixed error message); a function lets
// a handler pull extra fields off the error itself.
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
  if (error instanceof MapFinishedError) {
    return res.status(409).json({ success: false, error: error.message, finished: true });
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

// ---------------------------------------------------------------------------
// Controller plumbing. Every protected route runs `protect` first, so
// req.user is always set by the time an action runs; `authed` still answers
// 401 if it isn't (a route registered without `protect` by mistake), then
// runs the action with the caller's id and sends any thrown error through
// handleAblError. That removes the same try/catch and login check from every
// action.

export interface AuthedOptions {
  /** Domain errors this action maps to a status (see handleAblError). */
  errors?: ErrorMapping[];
  /** The 500 message when nothing else matched. */
  message?: string;
}

export function authed<P = Request["params"]>(
  logLabel: string,
  action: (req: Request<P>, res: Response, userId: string) => unknown,
  { errors = [], message = "Internal Server Error" }: AuthedOptions = {},
) {
  return async (req: Request<P>, res: Response) => {
    const userId = req.user?._id;
    if (!userId) return fail(res, 401, "Not authenticated");
    try {
      return await action(req, res, userId);
    } catch (error) {
      return handleAblError(res, error, errors, { message, logLabel });
    }
  };
}

/** `{ success: false, error }` with the given status. */
export const fail = (res: Response, status: number, error: string) =>
  res.status(status).json({ success: false, error });

/** A route param as one string (Express types allow a string array). */
export const param = (req: { params: unknown }, name: string): string => {
  const value = (req.params as Record<string, string | string[]>)[name];
  return Array.isArray(value) ? value[0] : value;
};

/** The public map id off a doc whose mapId was populated, or null. */
export const publicMapIdOf = (doc: { mapId?: unknown } | null | undefined): string | null =>
  (doc?.mapId as { mapId?: string } | null | undefined)?.mapId ?? null;

// Bulk id lists come straight from a request body (up to the 3 MB JSON limit),
// so they are capped: a few thousand is more than any map's selection, and an
// id is a short nanoid, never a long string.
export const MAX_ID_LIST = 5000;
const MAX_ID_LENGTH = 64;

/** True for a non-empty array of short strings, at most MAX_ID_LIST long (bulk id lists in request bodies). */
export const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.length <= MAX_ID_LIST &&
  value.every((id) => typeof id === "string" && id.length > 0 && id.length <= MAX_ID_LENGTH);
