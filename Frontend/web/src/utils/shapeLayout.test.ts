import { describe, expect, it } from "vitest";
import { outlinePoints, shapeFor, shapeTree } from "./shapeLayout";

describe("shapeFor", () => {
  it("makes a triangle of three or six, a square of four or eight, a circle otherwise", () => {
    expect(shapeFor(3)).toBe("triangle");
    expect(shapeFor(6)).toBe("triangle");
    expect(shapeFor(4)).toBe("square");
    expect(shapeFor(8)).toBe("square");
    expect(shapeFor(5)).toBe("circle");
    expect(shapeFor(7)).toBe("circle");
  });
});

describe("outlinePoints", () => {
  it("puts four points on the square's corners", () => {
    const h = 1 / Math.SQRT2;
    const pts = outlinePoints(4, "square");
    expect(pts.map((p) => [Math.round(p.x / h), Math.round(p.y / h)])).toEqual([[-1, -1], [1, -1], [1, 1], [-1, 1]]);
  });

  it("fills a triangle's corners first, then the middle of each side", () => {
    const pts = outlinePoints(6, "triangle");
    expect(pts[0].x).toBeCloseTo(0, 6);
    expect(pts[0].y).toBeCloseTo(-1, 6);
    // The point between the first two corners sits halfway along that side.
    expect(pts[1].x).toBeCloseTo((pts[0].x + pts[2].x) / 2, 6);
    expect(pts[1].y).toBeCloseTo((pts[0].y + pts[2].y) / 2, 6);
  });
});

describe("shapeTree", () => {
  it("puts a child one step out from its parent, away from the center", () => {
    const pos = shapeTree([{ id: "a", parentId: "r" }, { id: "a0", parentId: "a" }], "r");
    const a = pos.get("a")!;
    const a0 = pos.get("a0")!;
    expect(Math.hypot(a0.x - a.x, a0.y - a.y)).toBeCloseTo(1, 6);
    expect(Math.hypot(a0.x, a0.y)).toBeGreaterThan(Math.hypot(a.x, a.y));
  });
});
