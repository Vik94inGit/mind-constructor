import { describe, expect, it } from "vitest";
import { makeNode } from "../test/fixtures";
import { FULL_CANVAS_BOUNDS, NODE_FOOTPRINT, footprintObstacles } from "./canvasLayout";
import { MAX_ZONE_GAP, MIN_NODE_GAP, NEW_NODE_ID, makeZoneRule, placeByZoneRules } from "./zoneRules";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

// A triangle zone: root "r" at the top, children "a" and "b" below it.
function triangleMap(extra: { node: NodeDoc; pos: Pt }[] = []) {
  const nodes = [
    makeNode({ nodeId: "r", parentId: null }),
    makeNode({ nodeId: "a", parentId: "r" }),
    makeNode({ nodeId: "b", parentId: "r" }),
    ...extra.map((e) => e.node),
  ];
  const positions = new Map<string, Pt>([
    ["r", { x: 1000, y: 400 }],
    ["a", { x: 700, y: 900 }],
    ["b", { x: 1300, y: 900 }],
    ...extra.map((e) => [e.node.nodeId, e.pos] as [string, Pt]),
  ]);
  return { nodes, positions };
}

function place(nodes: NodeDoc[], positions: Map<string, Pt>, desired: Pt, nodeId: string, parentId?: string | null) {
  const others = Array.from(positions).filter(([id]) => id !== nodeId).map(([, p]) => p);
  const rule = makeZoneRule(nodes, positions, [{ nodeId, ...(parentId !== undefined ? { parentId } : {}) }]);
  return { at: placeByZoneRules(desired, footprintObstacles(others, MIN_NODE_GAP), FULL_CANVAS_BOUNDS, rule), rule };
}

describe("makeZoneRule", () => {
  it("keeps a node with no zone out of a zone", () => {
    const { nodes, positions } = triangleMap();
    const rule = makeZoneRule(nodes, positions, [{ nodeId: NEW_NODE_ID, parentId: null }]);
    expect(rule.fits({ x: 1000, y: 750 })).toBe(false);
    expect(rule.fits({ x: 1000, y: 1100 })).toBe(true);
  });

  it("keeps a node off a zone's line, not just out of its inside", () => {
    const { nodes, positions } = triangleMap();
    const rule = makeZoneRule(nodes, positions, [{ nodeId: NEW_NODE_ID, parentId: null }]);
    // Just below the a–b edge.
    expect(rule.fits({ x: 1000, y: 920 })).toBe(false);
  });

  it("lets a member move around inside its own zone", () => {
    const { nodes, positions } = triangleMap();
    const rule = makeZoneRule(nodes, positions, [{ nodeId: "a" }]);
    expect(rule.fits({ x: 800, y: 850 })).toBe(true);
  });

  it("won't stretch a zone over a node that isn't in it", () => {
    const { nodes, positions } = triangleMap([
      { node: makeNode({ nodeId: "loner", parentId: null }), pos: { x: 700, y: 1300 } },
    ]);
    const rule = makeZoneRule(nodes, positions, [{ nodeId: "a" }]);
    // a dragged down past the loner: the triangle would now cover it.
    expect(rule.fits({ x: 600, y: 1500 })).toBe(false);
  });

  it("won't let two unrelated zones cross", () => {
    const { nodes, positions } = triangleMap([
      { node: makeNode({ nodeId: "r2", parentId: null }), pos: { x: 1700, y: 400 } },
      { node: makeNode({ nodeId: "c", parentId: "r2" }), pos: { x: 1600, y: 900 } },
      { node: makeNode({ nodeId: "d", parentId: "r2" }), pos: { x: 2000, y: 900 } },
    ]);
    const rule = makeZoneRule(nodes, positions, [{ nodeId: "c" }]);
    // c pulled left under the first triangle: its zone's edge r2–c would cut
    // through the a–b edge without any corner landing inside.
    expect(rule.fits({ x: 900, y: 1150 })).toBe(false);
  });

  it("lets a child zone hang off a member of its parent zone", () => {
    // a roots its own zone with two children below it.
    const { nodes, positions } = triangleMap([
      { node: makeNode({ nodeId: "a1", parentId: "a" }), pos: { x: 500, y: 1250 } },
      { node: makeNode({ nodeId: "a2", parentId: "a" }), pos: { x: 800, y: 1250 } },
    ]);
    const rule = makeZoneRule(nodes, positions, [{ nodeId: "a2" }]);
    expect(rule.fits({ x: 820, y: 1250 })).toBe(true);
    // ...but its children still stay out of the parent zone.
    expect(rule.fits({ x: 1000, y: 800 })).toBe(false);
  });

  it("calls a spot compact only within ~2 cm of a node or zone line", () => {
    const { nodes, positions } = triangleMap();
    const rule = makeZoneRule(nodes, positions, [{ nodeId: NEW_NODE_ID, parentId: null }]);
    const nearB = { x: 1300, y: 900 + NODE_FOOTPRINT.h + MAX_ZONE_GAP - 5 };
    const farFromAll = { x: 2200, y: 1500 };
    expect(rule.compact(nearB)).toBe(true);
    expect(rule.compact(farFromAll)).toBe(false);
  });

  it("anything goes on an empty map", () => {
    const rule = makeZoneRule([], new Map(), [{ nodeId: NEW_NODE_ID, parentId: null }]);
    expect(rule.fits({ x: 100, y: 100 })).toBe(true);
    expect(rule.compact({ x: 100, y: 100 })).toBe(true);
  });

  it("checks every member of a group moved as one", () => {
    const { nodes, positions } = triangleMap([
      { node: makeNode({ nodeId: "x", parentId: null }), pos: { x: 200, y: 200 } },
      { node: makeNode({ nodeId: "y", parentId: null }), pos: { x: 500, y: 200 } },
    ]);
    // Leader x lands well clear of the triangle, but y (300 to its right) would be inside it.
    const rule = makeZoneRule(nodes, positions, [
      { nodeId: "x", offset: { x: 0, y: 0 } },
      { nodeId: "y", offset: { x: 300, y: 0 } },
    ]);
    expect(rule.fits({ x: 700, y: 750 })).toBe(false);
    expect(rule.fits({ x: 200, y: 600 })).toBe(true);
  });
});

describe("placeByZoneRules", () => {
  it("moves a node dropped inside a foreign zone out of it, staying close", () => {
    const { nodes, positions } = triangleMap([
      { node: makeNode({ nodeId: "loner", parentId: null }), pos: { x: 300, y: 300 } },
    ]);
    const { at, rule } = place(nodes, positions, { x: 1000, y: 750 }, "loner");
    expect(rule.fits(at)).toBe(true);
    expect(rule.compact(at)).toBe(true);
  });

  it("pulls a node dropped out in empty space back to within ~2 cm of the rest", () => {
    const { nodes, positions } = triangleMap([
      { node: makeNode({ nodeId: "loner", parentId: null }), pos: { x: 300, y: 300 } },
    ]);
    const { at, rule } = place(nodes, positions, { x: 2200, y: 1500 }, "loner");
    expect(rule.compact(at)).toBe(true);
    expect(rule.fits(at)).toBe(true);
  });

  it("keeps the minimum gap from other nodes", () => {
    const { nodes, positions } = triangleMap();
    const { at } = place(nodes, positions, { x: 1300, y: 950 }, NEW_NODE_ID, "b");
    const b = positions.get("b")!;
    const gapX = Math.abs(at.x - b.x) - NODE_FOOTPRINT.w;
    const gapY = Math.abs(at.y - b.y) - NODE_FOOTPRINT.h;
    expect(Math.max(gapX, gapY)).toBeGreaterThanOrEqual(MIN_NODE_GAP - 0.01);
  });
});
