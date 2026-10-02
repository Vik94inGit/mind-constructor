import { beforeEach, describe, expect, it } from "vitest";
import { loadBlockLocks, saveBlockLocks } from "./blockLock";

describe("block locks", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips per map", () => {
    saveBlockLocks("m1", { a: true, b: true });
    expect(loadBlockLocks("m1")).toEqual({ a: true, b: true });
    expect(loadBlockLocks("m2")).toEqual({});
  });

  it("clears the key once nothing is locked, and ignores junk", () => {
    saveBlockLocks("m1", { a: true });
    saveBlockLocks("m1", {});
    expect(localStorage.getItem("mc_block_lock:m1")).toBeNull();
    localStorage.setItem("mc_block_lock:m1", "{nope");
    expect(loadBlockLocks("m1")).toEqual({});
  });
});
