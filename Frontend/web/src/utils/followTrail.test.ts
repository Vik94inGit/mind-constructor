import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TRAIL_HOP_EVERY,
  TRAIL_MAX_LAG_TICKS,
  TRAIL_TICK_MS,
  hopsOn,
  shiftAt,
  startTrail,
  stepToward,
  trailLag,
  trailOrder,
} from "./followTrail";

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

describe("hopsOn", () => {
  it("lets each follower hop once every few ticks, neighbours on different beats", () => {
    const beats = Array.from({ length: TRAIL_HOP_EVERY * 2 }, (_, t) => hopsOn(t, 0));
    expect(beats.filter(Boolean)).toHaveLength(2);
    expect(hopsOn(0, 0)).not.toBe(hopsOn(0, 1));
  });
});

describe("startTrail", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const starts = () =>
    new Map([
      ["leader", { x: 0, y: 0 }],
      ["a", { x: 100, y: 0 }],
      ["b", { x: 200, y: 0 }],
    ]);

  it("moves the leader at once and the followers later, the farther one later still", () => {
    let shown = new Map<string, { x: number; y: number }>();
    const trail = startTrail("leader", starts(), true, (s) => (shown = s));
    trail.lead({ x: 0, y: 300 });
    expect(shown.get("leader")).toEqual({ x: 0, y: 300 });
    expect(shown.get("a")).toEqual({ x: 100, y: 0 });
    vi.advanceTimersByTime(TRAIL_TICK_MS * 14);
    expect(shown.get("a")!.y).toBeGreaterThan(0);
    expect(shown.get("b")!.y).toBeLessThan(shown.get("a")!.y);
    trail.stop();
  });

  it("walks every follower to its own landing spot, then settles", async () => {
    let shown = new Map<string, { x: number; y: number }>();
    const trail = startTrail("leader", starts(), true, (s) => (shown = s));
    trail.lead({ x: 0, y: 100 });
    const targets = new Map([
      ["leader", { x: 0, y: 100 }],
      ["a", { x: 100, y: 100 }],
      ["b", { x: 230, y: 100 }],
    ]);
    const landed = trail.land({ x: 0, y: 100 }, targets);
    await vi.advanceTimersByTimeAsync(TRAIL_TICK_MS * 200);
    await landed;
    expect(shown).toEqual(targets);
  });

  it("keeps the shape rigid without motion", () => {
    let shown = new Map<string, { x: number; y: number }>();
    const trail = startTrail("leader", starts(), false, (s) => (shown = s));
    trail.lead({ x: 50, y: 0 });
    vi.advanceTimersByTime(TRAIL_TICK_MS);
    expect(shown.get("b")).toEqual({ x: 250, y: 0 });
    trail.stop();
  });
});
