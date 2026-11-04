import { describe, expect, it } from "vitest";
import { ringPoints } from "./menuRing";

describe("ringPoints", () => {
  it("puts the first ghost straight up and spreads the rest clockwise", () => {
    const [top, right, bottom, left] = ringPoints(4, 100);
    expect(top).toEqual({ x: 0, y: -100 });
    expect(right).toEqual({ x: 100, y: 0 });
    expect(bottom).toEqual({ x: 0, y: 100 });
    expect(left).toEqual({ x: -100, y: 0 });
  });

  it("keeps every ghost on the circle", () => {
    for (const p of ringPoints(7, 120)) expect(Math.abs(Math.hypot(p.x, p.y) - 120)).toBeLessThan(1);
  });

  it("returns nothing for an empty menu", () => {
    expect(ringPoints(0, 100)).toEqual([]);
  });
});
