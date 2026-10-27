import { beforeEach, describe, expect, it } from "vitest";
import {
  ASK_AFTER_MS,
  checkInEntry,
  checkInShift,
  loadAfterSkipped,
  loadFeelings,
  parseCheckIn,
  parseFeelings,
  saveAfterSkipped,
  saveFeelings,
  shouldAskAfter,
  withFeeling,
} from "./feeling";

describe("feelings", () => {
  beforeEach(() => localStorage.clear());

  it("sets and clears one node's feeling", () => {
    const one = withFeeling({}, "a", "worried");
    expect(one).toEqual({ a: "worried" });
    expect(withFeeling(one, "a", null)).toEqual({});
  });

  it("drops anything that isn't one of the feelings", () => {
    expect(parseFeelings({ a: "calm", b: "bored", c: 3 })).toEqual({ a: "calm" });
    expect(parseFeelings(null)).toEqual({});
  });

  it("keeps a map's feelings per browser", () => {
    saveFeelings("m1", { a: "hopeful" });
    expect(loadFeelings("m1")).toEqual({ a: "hopeful" });
    expect(loadFeelings("m2")).toEqual({});
    saveFeelings("m1", {});
    expect(localStorage.getItem("mc_feelings:m1")).toBeNull();
  });
});

describe("check-in", () => {
  beforeEach(() => localStorage.clear());

  const before = { feeling: "worried" as const, strength: 4, at: 0 };

  it("keeps the strength between 1 and 5", () => {
    expect(checkInEntry("calm", 9, 1).strength).toBe(5);
    expect(checkInEntry("calm", 0, 1).strength).toBe(1);
  });

  it("reads back only a real check-in", () => {
    expect(parseCheckIn({ before, after: null })).toEqual({ before, after: null });
    expect(parseCheckIn({ before: { feeling: "bored", strength: 1, at: 0 } })).toBeNull();
    expect(parseCheckIn(null)).toBeNull();
  });

  it("asks 'And now?' only a while after the before, once, and not after a wave-off", () => {
    expect(shouldAskAfter({ before }, ASK_AFTER_MS - 1, false)).toBe(false);
    expect(shouldAskAfter({ before }, ASK_AFTER_MS, false)).toBe(true);
    expect(shouldAskAfter({ before }, ASK_AFTER_MS, true)).toBe(false);
    expect(shouldAskAfter({ before, after: { feeling: "calm", strength: 2, at: 1 } }, ASK_AFTER_MS, false)).toBe(false);
    expect(shouldAskAfter(null, ASK_AFTER_MS, false)).toBe(false);
  });

  it("shows the shift, or a question mark while the after is still to come", () => {
    expect(checkInShift({ before, after: { feeling: "calm", strength: 2, at: 1 } })).toBe("😟 4 → 😌 2");
    expect(checkInShift({ before })).toBe("😟 4 → ?");
    expect(checkInShift({ after: { feeling: "calm", strength: 2, at: 1 } })).toBeNull();
  });

  it("remembers a wave-off per map", () => {
    expect(loadAfterSkipped("m1")).toBe(false);
    saveAfterSkipped("m1", true);
    expect(loadAfterSkipped("m1")).toBe(true);
    expect(loadAfterSkipped("m2")).toBe(false);
  });
});
