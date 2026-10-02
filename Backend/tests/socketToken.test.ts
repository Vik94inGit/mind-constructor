import { describe, it, expect } from "vitest";
import { createSocketToken, verifySocketToken, SOCKET_TOKEN_TTL_MS } from "../src/realtime/socketToken.js";

const SECRET = "test-secret";

describe("socket tokens", () => {
  it("round-trips the user id while fresh", () => {
    const token = createSocketToken("u1", SECRET, 1_000);
    expect(verifySocketToken(token, SECRET, 1_000 + SOCKET_TOKEN_TTL_MS - 1)).toBe("u1");
  });

  it("refuses an expired token", () => {
    const token = createSocketToken("u1", SECRET, 1_000);
    expect(verifySocketToken(token, SECRET, 1_000 + SOCKET_TOKEN_TTL_MS + 1)).toBeNull();
  });

  it("refuses a token signed with another secret, or with a swapped user id", () => {
    const token = createSocketToken("u1", SECRET, 1_000);
    expect(verifySocketToken(token, "other-secret", 1_000)).toBeNull();
    const [, expiry, signature] = token.split(".");
    expect(verifySocketToken(`u2.${expiry}.${signature}`, SECRET, 1_000)).toBeNull();
  });

  it("refuses junk", () => {
    expect(verifySocketToken(undefined, SECRET)).toBeNull();
    expect(verifySocketToken("nope", SECRET)).toBeNull();
    expect(verifySocketToken("a.b.c", SECRET)).toBeNull();
    expect(verifySocketToken(createSocketToken("u1", SECRET), "")).toBeNull();
  });
});
