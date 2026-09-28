import { createClient, type RedisClientType } from "redis";

// Session store backing (see server.ts). Returns null when REDIS_URL isn't
// set at all — server.ts decides what that means (hard-fail in production,
// fall back to express-session's in-memory MemoryStore otherwise, which is
// also what keeps the test suite runnable in a sandbox with no real Redis).
export function createRedisClient(): RedisClientType | null {
  if (!process.env.REDIS_URL) return null;
  const client: RedisClientType = createClient({
    url: process.env.REDIS_URL,
    // Without this, a Key Value instance that's slow to come up (or simply
    // unreachable — wrong host, still provisioning) leaves .connect() hanging
    // indefinitely: server.ts never reaches httpServer.listen(), Render's
    // health check never gets a response, and the whole deploy sits stuck
    // "In progress" instead of failing with a readable error.
    socket: { connectTimeout: 10_000 },
  });
  client.on("error", (err) => console.error("Redis client error:", err));
  return client;
}
