import { describe, expect, it } from "vitest";
import { NODE_TYPE_TEMPLATE, layoutTemplate } from "./templates";
import { CANVAS_H, CANVAS_W, getCirclePackSpacing } from "./canvasLayout";
import { outlinePoints, shapeStep, shapeTree } from "./shapeLayout";
import type { Obstacle } from "./canvasLayout";

const EDGE = 120;

describe("layoutTemplate", () => {
  it("lays the first level out on its shape round the root, a step out", () => {
    const root = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    const step = shapeStep(getCirclePackSpacing());
    // "decision": a question and three options — four, so a square.
    const placed = layoutTemplate("decision", root).filter((p) => p.parentKey === null);
    const want = outlinePoints(4, "square");
    const radius = Math.max(1, 4 / (4 * Math.SQRT2));
    placed.forEach((p, i) => {
      expect(p.x).toBeCloseTo(root.x + want[i].x * radius * step, 5);
      expect(p.y).toBeCloseTo(root.y + want[i].y * radius * step, 5);
    });
  });

  it("puts three children of one node at the corners of an equilateral triangle", () => {
    const shape = shapeTree([{ id: "a", parentId: "r" }, { id: "b", parentId: "r" }, { id: "c", parentId: "r" }], "r");
    const [a, b, c] = ["a", "b", "c"].map((id) => shape.get(id)!);
    const d = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
    expect(d(a, b)).toBeCloseTo(d(b, c), 6);
    expect(d(b, c)).toBeCloseTo(d(c, a), 6);
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

  it("steers a placed node clear of an obstacle already sitting where its shape would put it", () => {
    // existingObstacles is what MapPage's applyTemplate feeds in (every
    // visible node plus every zone backdrop), so a template grown near other
    // nodes never lands on top of them.
    const root = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    const step = shapeStep(getCirclePackSpacing());
    // "retry" has two nodes: the first straight above the root.
    const raw = { x: root.x, y: root.y - step };
    const obstacle: Obstacle = { x: raw.x, y: raw.y, minDist: 200 };
    const placed = layoutTemplate("retry", root, [obstacle]);
    const dist = Math.hypot(placed[0].x - obstacle.x, placed[0].y - obstacle.y);
    expect(dist).toBeGreaterThanOrEqual(obstacle.minDist - 1);
  });

  it("places one entry per node across every template kind, in parent-before-child order", () => {
    for (const kind of ["problem", "goal", "retry", "decision", "retro", "idea"] as const) {
      const placed = layoutTemplate(kind, { x: CANVAS_W / 2, y: CANVAS_H / 2 });
      const seen = new Set<string>();
      for (const p of placed) {
        if (p.parentKey) expect(seen.has(p.parentKey)).toBe(true);
        seen.add(p.key);
      }
    }
  });

  it("grows an idea into its need, how it works with a first try, proof, risk, unknown and another idea", () => {
    const placed = layoutTemplate("idea", { x: CANVAS_W / 2, y: CANVAS_H / 2 });
    expect(placed.map((p) => [p.key, p.type, p.parentKey])).toEqual([
      ["ideaNeed", "Problem", null],
      ["ideaHow", "Solution", null],
      ["ideaTry", "Option", "ideaHow"],
      ["ideaProof", "Success", null],
      ["ideaRisk", "Fail", null],
      ["ideaUnknown", "unknown", null],
      ["ideaAlternative", "Idea", null],
    ]);
  });
});

describe("NODE_TYPE_TEMPLATE", () => {
  it("offers the idea template on an Idea node, and none on an Option", () => {
    expect(NODE_TYPE_TEMPLATE.Idea).toBe("idea");
    expect(NODE_TYPE_TEMPLATE.Problem).toBe("problem");
    expect(NODE_TYPE_TEMPLATE.Option).toBeUndefined();
  });
});
