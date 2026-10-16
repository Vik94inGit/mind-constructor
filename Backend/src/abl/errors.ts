// Shared across every ABL module.
import type { ZodType } from "zod";

// Thrown when input fails validation — every controller maps this to 400.
export class ValidationError extends Error {}

// The map's discussion has been finished (Map.finishedAt): no new nodes,
// attacks or shields until its owner reopens it. Always 409 — see
// controllers/errorHandling.ts.
export class MapFinishedError extends Error {
  constructor() {
    super("This discussion has been finished. Its owner can reopen it.");
  }
}

// Parses `data` against `schema`; throws a ValidationError with a readable
// message on failure instead of leaking a raw ZodError up to the controller.
export function parseOrThrow<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join("; ");
    throw new ValidationError(message);
  }
  return result.data;
}
