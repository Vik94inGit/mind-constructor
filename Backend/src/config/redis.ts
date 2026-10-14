import { createClient, type RedisClientType } from "redis";

// Session store backing (see server.ts). Returns null when REDIS_URL isn't
// set at all — server.ts decides what that means (hard-fail in production,
// fall back to express-session's in-memory MemoryStore otherwise, which is
// also what keeps the test suite runnable in a sandbox with no real Redis).
/** Connection attempts before startup gives up on an unreachable Redis. */
export const STARTUP_RETRIES = 5;

export function createRedisClient(): RedisClientType | null {
  if (!process.env.REDIS_URL) return null;
  const client: RedisClientType = createClient({
    url: process.env.REDIS_URL,
    // Without this, a Key Value instance that's slow to come up (or simply
    // unreachable — wrong host, still provisioning) leaves .connect() hanging
    // indefinitely: server.ts never reaches httpServer.listen(), Render's
    // health check never gets a response, and the whole deploy sits stuck
    // "In progress" instead of failing with a readable error.
    socket: {
      connectTimeout: 10_000,
      // node-redis retries forever by default, so an unreachable store at
      // startup still left .connect() pending (and the deploy stuck "In
      // progress") despite the timeout above. Before the first successful
      // connection, give up after a few tries so server.ts exits with a
      // readable error; once connected, keep retrying through blips.
      reconnectStrategy: (retries) =>
        !everReady && retries >= STARTUP_RETRIES
          ? new Error(`Redis unreachable at startup after ${retries} attempts`)
          : Math.min(retries * 500, 5_000),
    },
  });
  let everReady = false;
  client.on("ready", () => {
    everReady = true;
  });
  client.on("error", (err) => console.error("Redis client error:", err));
  return client;
}
