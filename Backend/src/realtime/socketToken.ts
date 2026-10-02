// Short-lived tokens that authenticate the Socket.IO handshake without the
// session cookie. The socket connects straight to this backend, cross-site
// from the frontend (a Vercel rewrite doesn't carry a WebSocket upgrade —
// see the frontend's api/socket.ts), and Safari blocks third-party cookies
// outright, so on an iPhone or a Mac the handshake never carries mc_sid and
// io.ts's session check alone always failed there. The frontend instead asks
// for one of these over the same-origin REST API (where the session cookie
// *is* first-party, so Safari sends it) and hands it to the socket.
//
// "<userId>.<expiry ms>.<HMAC-SHA256 of both, keyed by SESSION_SECRET>" —
// stateless, and good for a couple of minutes: it only has to survive the
// trip to the handshake, and every reconnect fetches a fresh one. The user
// is still looked up (and a blocked one refused) at handshake time.
import { createHmac, timingSafeEqual } from "crypto";

export const SOCKET_TOKEN_TTL_MS = 2 * 60 * 1000;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSocketToken(userId: string, secret: string, now = Date.now()): string {
  const payload = `${userId}.${now + SOCKET_TOKEN_TTL_MS}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** The user id a token was issued for, or null when it's malformed, forged or expired. */
export function verifySocketToken(token: unknown, secret: string, now = Date.now()): string | null {
  if (typeof token !== "string" || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiry, signature] = parts;
  const expected = Buffer.from(sign(`${userId}.${expiry}`, secret));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const expiresAt = Number(expiry);
  if (!userId || !Number.isFinite(expiresAt) || expiresAt < now) return null;
  return userId;
}
