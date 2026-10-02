import { describe, expect, it } from "vitest";
import { focusedZoneIds, sameIds } from "./zoneFocus";
import type { NodeGroup } from "./canvasLayout";

const group = (rootId: string, cx: number, cy: number, r = 100): NodeGroup => ({
  rootId,
  members: [],
  sentiment: "neutral",
  cx,
  cy,
  r,
  outline: [],
});

describe("focusedZoneIds", () => {
  it("is null with fewer than two zones", () => {
    expect(focusedZoneIds([group("a", 0, 0)], { x: 0, y: 0 }, 100)).toBeNull();
  });

  it("keeps the zones near the middle of the view", () => {
    const ids = focusedZoneIds([group("a", 0, 0), group("b", 1000, 0)], { x: 50, y: 0 }, 100);
    expect([...ids!]).toEqual(["a"]);
  });

  it("falls back to the nearest zone when none is close", () => {
    const ids = focusedZoneIds([group("a", 0, 0), group("b", 3000, 0)], { x: 1200, y: 0 }, 50);
    expect([...ids!]).toEqual(["a"]);
  });
});

describe("sameIds", () => {
  it("compares by members", () => {
    expect(sameIds(new Set(["a", "b"]), new Set(["b", "a"]))).toBe(true);
    expect(sameIds(new Set(["a"]), null)).toBe(false);
  });
});
