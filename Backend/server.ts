import dotenv from "dotenv";
dotenv.config();
import express from "express";
import http from "http";

import type { Express } from "express";
import mongoose from "mongoose";
import cors from "cors";
import session from "express-session";
import { RedisStore } from "connect-redis";

import authRoutes from "./src/routes/authRoutes.js";
import mapRoute from "./src/routes/mapRoute.js";
import nodeRoute from "./src/routes/nodeRoute.js";
import edgeRoute from "./src/routes/edgeRoute.js";
import lineRoute from "./src/routes/lineRoute.js";
import folderRoute from "./src/routes/folderRoute.js";
import userStateRoute from "./src/routes/userStateRoute.js";
import { initRealtime } from "./src/realtime/io.js";
import { createRedisClient } from "./src/config/redis.js";

console.log(
  "Checking MONGO_URI:",
  process.env.MONGO_URI ? "FOUND" : "NOT FOUND",
);

const app: Express = express();
const PORT: number = Number(process.env.PORT) || 3000;

// Render (like most PaaS hosts) terminates TLS at its own edge and forwards
// plain HTTP internally, with an X-Forwarded-Proto header saying what the
// original request actually was. Without this, Express's req.secure is
// always false regardless of the real connection, since it never looks at
// that header — and express-session silently *refuses* to send Set-Cookie
// for a cookie configured secure:true (correctly, in production — see the
// isProd cookie config below) when req.secure reads false, on the reasoning
// that it'd be sending a "secure" cookie over what looks like plain HTTP.
// That produced a real, hard-to-spot bug: a 200 response with the right
// user in the body, but *no* Set-Cookie header at all, no error anywhere —
// this is what "trust proxy" exists to fix.
app.set("trust proxy", 1);

console.log("DEBUG: Script is starting...");

app.use((req, res, next) => {
  console.log(`[EXPRESS] ${req.method} ${req.originalUrl}`);
  next();
});

// CORS_ORIGIN restricts the API to specific frontend origin(s) — comma-
// separated, e.g. "https://my-app.vercel.app". Required in production (see
// run()'s own check below): a credentialed session cookie needs `cors` to
// echo back a real, explicit origin, and cors's own wildcard-reflect
// fallback (origin left undefined) would defeat that entirely. Left unset,
// only outside production, both this and Socket.IO's own cors
// (src/realtime/io.ts) stay wide open — fine for local dev.
const allowedOrigins = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim());
app.use(cors({ origin: allowedOrigins ?? true, credentials: true }));

// "Are we actually running on a real deploy" — NODE_ENV alone isn't reliable
// for this: Render (unlike some other platforms) does NOT set NODE_ENV to
// "production" by itself, so relying on it alone silently fell back to dev-
// mode cookie settings (secure:false, sameSite:"lax") on the real deployed
// backend. sameSite:"lax" is *not* sent on a cross-site fetch/XHR at all
// (only top-level navigation) — since the frontend (Vercel) and backend
// (Render) are different domains, that meant the session cookie was set on
// login but then silently dropped by the browser on the very next API call,
// reading as "logs in, then immediately looks logged out again" — the
// couple of requests that *did* still work right after login were just
// Chrome's ~2-minute grace period for a freshly-set SameSite-defaulted
// cookie, not the intended behavior. RENDER=true is a var Render itself
// always injects (unlike NODE_ENV), so it's the reliable signal here.
const isProd = process.env.NODE_ENV === "production" || process.env.RENDER === "true";

// Session store: Redis-backed in production, so logging out or blocking a
// user actually revokes access immediately instead of waiting on a token to
// expire client-side. createRedisClient() returns null when REDIS_URL isn't
// set — run() below decides what that means (hard-fail in production, or a
// dev/test fallback to express-session's own in-memory MemoryStore, which is
// also what keeps this app's test suite runnable without a real Redis).
const redisClient = createRedisClient();
const sessionMiddleware = session({
  store: redisClient ? new RedisStore({ client: redisClient, prefix: "mc_sess:" }) : undefined,
  secret: process.env.SESSION_SECRET as string,
  name: "mc_sid",
  resave: false,
  saveUninitialized: false,
  // Refreshes maxAge on every response, so an actively-used session doesn't
  // expire mid-use — a sliding window: signed in until a month after the
  // last visit.
  rolling: true,
  cookie: {
    httpOnly: true,
    // 30 days: an installed app is opened now and then, not daily, and
    // should still be signed in when it is.
    maxAge: 30 * 24 * 60 * 60 * 1000,
    // Secure is mandatory whenever sameSite is "none" (browsers reject the
    // cookie otherwise) and Render always serves over HTTPS, so this only
    // relaxes for local http://localhost dev. sameSite defaults to "none" in
    // production rather than "lax": the frontend (Vercel) and backend
    // (Render) are on different domains, and while most API traffic is
    // proxied same-origin through vercel.json, Socket.IO's handshake can't
    // reliably go through that same rewrite (see realtime/io.ts) and stays
    // genuinely cross-site — COOKIE_SAMESITE=lax is an escape hatch for a
    // future deploy where everything ends up same-origin.
    secure: isProd,
    sameSite: isProd ? (process.env.COOKIE_SAMESITE === "lax" ? "lax" : "none") : "lax",
  },
});
app.use(sessionMiddleware);

// 300 KB: room for a saved draft (see userStateAbl.ts MAX_DRAFT_BYTES).
app.use(express.json({ limit: "300kb" }));

app.use("/api/auth", authRoutes);
app.use("/api/nodes", nodeRoute);
app.use("/api/edges", edgeRoute);
app.use("/api/lines", lineRoute);
// Before the map routes: those are mounted on /api itself, so /api/folders
// would otherwise read as GET /api/:mapId with mapId "folders".
app.use("/api/folders", folderRoute);
// Also before the map routes, for the same reason.
app.use("/api/state", userStateRoute);
app.use("/api", mapRoute);

// Socket.IO attaches to the same HTTP server Express listens on — one
// port, both the REST API and the websocket upgrade. Shares this exact
// sessionMiddleware instance (not a second, separately-configured one) so a
// browser's mc_sid cookie authenticates both the REST API and the socket
// handshake against the same store.
const httpServer = http.createServer(app);
initRealtime(httpServer, sessionMiddleware);

async function run() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing!");
    }
    if (isProd) {
      if (!allowedOrigins || allowedOrigins.length === 0) {
        throw new Error("CORS_ORIGIN is required in production — credentials:true CORS can't use a wildcard.");
      }
      if (!process.env.SESSION_SECRET) {
        throw new Error("SESSION_SECRET is missing!");
      }
      if (!redisClient) {
        throw new Error("REDIS_URL is missing! (production sessions need a real Redis store, not the in-memory fallback)");
      }
    } else if (!redisClient) {
      console.warn(
        "⚠️  REDIS_URL not set — sessions are using express-session's in-memory MemoryStore. Fine for local dev/test, never for production.",
      );
    }
    if (redisClient) {
      await redisClient.connect();
      console.log("✅ Redis connected (session store)");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ DB Connected");

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Critical Failure:", err);
    process.exit(1);
  }
}

const isMainModule =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));

if (isMainModule || process.env.NODE_ENV !== "test") {
  run();
}

// Export the app for testing
export { app };
