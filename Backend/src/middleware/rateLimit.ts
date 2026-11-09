import { ipKeyGenerator, rateLimit } from "express-rate-limit";

// Sign-in endpoints (password login, registration, Google, demo) are the ones
// worth guessing at, so each address gets a small budget of attempts per
// window. Kept in memory: the backend runs as one instance, and a restart
// forgiving everyone is harmless. `trust proxy` (server.ts) makes req.ip the
// visitor's own address behind Render's or the self-hosted proxy, not the
// proxy's.
export const AUTH_WINDOW_MS = 15 * 60 * 1000;
export const AUTH_MAX_ATTEMPTS = 20;

export const authLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  limit: AUTH_MAX_ATTEMPTS,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, error: "Too many attempts. Try again in a few minutes." },
});

// Every other API call: a generous ceiling that no person clicking, dragging
// or replaying an offline outbox comes near (the outbox treats 429 as "try
// again shortly", see Frontend/web/src/offline/sync.ts), but that stops a
// script or a runaway client from hammering the database. Counted per
// signed-in user rather than per address: production traffic arrives through
// Vercel's /api rewrite, so many people can share one address. Requests
// without a session fall back to the address.
export const API_WINDOW_MS = 60 * 1000;
export const API_MAX_REQUESTS = 1200;

export const apiKey = (req: { session?: { userId?: string }; ip?: string }) =>
  req.session?.userId ? `user:${req.session.userId}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;

export const apiLimiter = rateLimit({
  windowMs: API_WINDOW_MS,
  limit: API_MAX_REQUESTS,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: apiKey,
  message: { success: false, error: "Too many requests. Slow down for a moment." },
});
