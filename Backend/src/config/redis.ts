import { createClient, type RedisClientType } from "redis";

// Session store backing (see server.ts). Returns null when REDIS_URL isn't
// set at all — server.ts decides what that means (hard-fail in production,
// fall back to express-session's in-memory MemoryStore otherwise, which is
// also what keeps the test suite runnable in a sandbox with no real Redis).
export function createRedisClient(): RedisClientType | null {
  if (!process.env.REDIS_URL) return null;
  const client: RedisClientType = createClient({ url: process.env.REDIS_URL });
  client.on("error", (err) => console.error("Redis client error:", err));
  return client;
}
