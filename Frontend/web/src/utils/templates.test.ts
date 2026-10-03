import { describe, expect, it } from "vitest";
import { layoutTemplate } from "./templates";
import { CANVAS_H, CANVAS_W, computeNodeGroups, getNodeMinDist } from "./canvasLayout";
import type { NodeDoc } from "../types";
import type { Obstacle } from "./canvasLayout";

const EDGE = 120;

describe("layoutTemplate", () => {
  it("puts every top-level branch on a ring around the root, at least a node-spacing apart", () => {
    const root = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    const placed = layoutTemplate("problem", root).filter((p) => p.parentKey === null);
    const gap = getNodeMinDist();
    for (const p of placed) expect(Math.hypot(p.x - root.x, p.y - root.y)).toBeGreaterThanOrEqual(gap - 1);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(Math.hypot(placed[i].x - placed[j].x, placed[i].y - placed[j].y)).toBeGreaterThanOrEqual(gap - 1);
      }
    }
  });

  it("grows a branch's children outward from their own parent, not on the far side of the root", () => {
    const root = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    const placed = layoutTemplate("decision", root);
    const byKey = new Map(placed.map((p) => [p.key, p]));
    for (const [parent, kids] of [["optionA", ["advantageA", "riskA"]], ["optionB", ["advantageB", "riskB"]], ["optionC", ["advantageC", "riskC"]]] as const) {
      const p = byKey.get(parent)!;
      for (const k of kids) {
        const c = byKey.get(k)!;
        // Farther from the root than its parent, and closer to its parent than to the root.
        expect(Math.hypot(c.x - root.x, c.y - root.y)).toBeGreaterThan(Math.hypot(p.x - root.x, p.y - root.y));
        expect(Math.hypot(c.x - p.x, c.y - p.y)).toBeLessThan(Math.hypot(c.x - root.x, c.y - root.y));
      }
    }
  });

  it("never lets two sibling branches' zones overlap", () => {
    const root = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    const placed = layoutTemplate("decision", root);
    const nodes = [
      { nodeId: "root", type: "Problem", parentId: null },
      ...placed.map((p) => ({ nodeId: p.key, type: p.type, parentId: p.parentKey ?? "root" })),
    ] as unknown as NodeDoc[];
    const pos = new Map([["root", root], ...placed.map((p) => [p.key, { x: p.x, y: p.y }] as const)]);
    const zones = computeNodeGroups(nodes, nodes, pos).filter((g) => g.rootId !== "root");
    expect(zones).toHaveLength(3);
    for (let i = 0; i < zones.length; i++) {
      for (let j = i + 1; j < zones.length; j++) {
        const d = Math.hypot(zones[i].cx - zones[j].cx, zones[i].cy - zones[j].cy);
        expect(d).toBeGreaterThanOrEqual(zones[i].r + zones[j].r);
      }
    }
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

  it("turns the ring away from what's already sitting next to the root", () => {
    const root = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    const unturned = layoutTemplate("retry", root);
    const obstacle: Obstacle = { x: unturned[0].x, y: unturned[0].y, minDist: 200 };
    const placed = layoutTemplate("retry", root, [obstacle]);
    for (const p of placed) {
      expect(Math.hypot(p.x - obstacle.x, p.y - obstacle.y)).toBeGreaterThanOrEqual(obstacle.minDist - 1);
    }
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
