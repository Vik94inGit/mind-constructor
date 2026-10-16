import { rateLimit } from "express-rate-limit";

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
