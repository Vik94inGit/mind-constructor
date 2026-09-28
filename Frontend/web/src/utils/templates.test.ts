import { describe, expect, it } from "vitest";
import { layoutTemplate } from "./templates";
import { CANVAS_H, CANVAS_W, getCirclePackSpacing, spiralPoint } from "./canvasLayout";

const EDGE = 120;

describe("layoutTemplate", () => {
  it("fans nodes around the root using the tighter circle-pack spacing, not the general spacing floor", () => {
    const root = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    const placed = layoutTemplate("retry", root);
    expect(placed.length).toBeGreaterThan(0);
    // i+1, not i — spiralPoint(0, root) would be root's own position, and
    // the root is the real, already-existing node the template grows from.
    const expected = spiralPoint(1, root, getCirclePackSpacing());
    expect(placed[0].x).toBeCloseTo(expected.x, 5);
    expect(placed[0].y).toBeCloseTo(expected.y, 5);
  });

  it("keeps every placed node within the canvas edge margin", () => {
    const placed = layoutTemplate("problem", { x: CANVAS_W / 2, y: CANVAS_H / 2 });
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(EDGE);
      expect(p.x).toBeLessThanOrEqual(CANVAS_W - EDGE);
      expect(p.y).toBeGreaterThanOrEqual(EDGE);
      expect(p.y).toBeLessThanOrEqual(CANVAS_H - EDGE);
    }
  });

  it("wires each node's parentKey back to its own branch parent, and root-level nodes to null", () => {
    const placed = layoutTemplate("problem", { x: CANVAS_W / 2, y: CANVAS_H / 2 });
    const plan = placed.find((p) => p.key === "plan");
    expect(plan?.parentKey).toBe("way1");
    const resultPositive = placed.find((p) => p.key === "resultPositive");
    expect(resultPositive?.parentKey).toBe("plan");
    const subProblem1 = placed.find((p) => p.key === "subProblem1");
    expect(subProblem1?.parentKey).toBeNull();
  });

  it("places one entry per node across every template kind, in parent-before-child order", () => {
    for (const kind of ["problem", "goal", "retry", "decision", "retro"] as const) {
      const placed = layoutTemplate(kind, { x: CANVAS_W / 2, y: CANVAS_H / 2 });
      const seen = new Set<string>();
      for (const p of placed) {
        if (p.parentKey) expect(seen.has(p.parentKey)).toBe(true);
        seen.add(p.key);
      }
    }
  });
});
