import { afterEach, describe, expect, it } from "vitest";
import { createRedisClient } from "../src/config/redis.js";

describe("createRedisClient", () => {
  const prev = process.env.REDIS_URL;
  afterEach(() => {
    process.env.REDIS_URL = prev;
  });

  it("fails connect() instead of hanging when Redis is unreachable at startup", async () => {
    // Nothing listens on port 1, so every attempt is refused at once.
    process.env.REDIS_URL = "redis://127.0.0.1:1";
    const client = createRedisClient()!;
    client.on("error", () => {});
    await expect(client.connect()).rejects.toThrow(/unreachable at startup/);
  }, 20_000);

  it("returns null without REDIS_URL", () => {
    delete process.env.REDIS_URL;
    expect(createRedisClient()).toBeNull();
  });
});
