import { describe, expect, it } from "vitest";
import { introAmount, introOffsets } from "./useIntroMigration";

describe("introOffsets", () => {
  it("sends each node straight out from the middle of the map", () => {
    const offsets = introOffsets(
      new Map([
        ["left", { x: 0, y: 0 }],
        ["right", { x: 200, y: 0 }],
      ]),
      100,
    );
    const left = offsets.get("left")!;
    const right = offsets.get("right")!;
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
    expect(Math.abs(left.y)).toBeLessThan(1e-9);
    for (const o of [left, right]) {
      const len = Math.hypot(o.x, o.y);
      expect(len).toBeGreaterThanOrEqual(60);
      expect(len).toBeLessThanOrEqual(100);
    }
  });

  it("still moves a lone node sitting right on the middle", () => {
    const o = introOffsets(new Map([["only", { x: 5, y: 5 }]]), 100).get("only")!;
    expect(Math.hypot(o.x, o.y)).toBeGreaterThan(0);
  });
});

describe("introAmount", () => {
  it("starts and ends at home, furthest out halfway", () => {
    expect(introAmount(0)).toBe(0);
    expect(introAmount(1)).toBeCloseTo(0);
    expect(introAmount(0.5)).toBeCloseTo(1);
  });
});
