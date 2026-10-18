import { describe, expect, it } from "vitest";
import { TRAIL_MAX_LAG_TICKS, shiftAt, stepToward, trailLag, trailOrder } from "./followTrail";

describe("trailOrder", () => {
  it("lines the followers up as a chain, each nearest the one before it", () => {
    const starts = new Map([
      ["leader", { x: 0, y: 0 }],
      ["far", { x: 300, y: 0 }],
      ["near", { x: 100, y: 0 }],
      ["mid", { x: 200, y: 0 }],
    ]);
    expect(trailOrder("leader", starts)).toEqual(["near", "mid", "far"]);
  });

  it("has no followers for a lone leader", () => {
    expect(trailOrder("a", new Map([["a", { x: 0, y: 0 }]]))).toEqual([]);
  });
});

describe("trailLag", () => {
  it("puts each follower further behind than the one in front", () => {
    expect(trailLag(0, 3)).toBeLessThan(trailLag(1, 3));
    expect(trailLag(1, 3)).toBeLessThan(trailLag(2, 3));
  });

  it("keeps a long line within the longest lag", () => {
    expect(trailLag(99, 100)).toBeLessThanOrEqual(TRAIL_MAX_LAG_TICKS);
    expect(trailLag(0, 100)).toBeGreaterThanOrEqual(1);
  });
});

describe("shiftAt", () => {
  it("looks back the given number of ticks, never before the first", () => {
    const h = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
    expect(shiftAt(h, 0)).toEqual({ x: 2, y: 0 });
    expect(shiftAt(h, 2)).toEqual({ x: 0, y: 0 });
    expect(shiftAt(h, 10)).toEqual({ x: 0, y: 0 });
  });
});

describe("stepToward", () => {
  it("hops no farther than the step", () => {
    expect(stepToward({ x: 0, y: 0 }, { x: 100, y: 0 }, 20)).toEqual({ x: 20, y: 0 });
  });

  it("lands exactly when the goal is within reach", () => {
    expect(stepToward({ x: 0, y: 0 }, { x: 3, y: 4 }, 20)).toEqual({ x: 3, y: 4 });
  });
});
