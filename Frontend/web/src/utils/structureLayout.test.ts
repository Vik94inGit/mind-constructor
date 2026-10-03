import { describe, expect, it } from "vitest";
import { makeRoom, planStructureMoves, separateZones, EDGE_MARGIN } from "./structureLayout";
import { CANVAS_W, computeNodeGroups, getCirclePackSpacing } from "./canvasLayout";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };
const node = (nodeId: string, parentId: string | null = null) =>
  ({ nodeId, parentId, type: "Option" }) as unknown as NodeDoc;
const all = () => true;
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

describe("makeRoom", () => {
  it("pushes a node covered by the pinned one out of its way, and leaves the pinned one where it is", () => {
    const pos = new Map<string, Pt>([
      ["new", { x: 1000, y: 800 }],
      ["old", { x: 1040, y: 800 }],
    ]);
    const moved = makeRoom(pos, new Set(["new"]), all);
    expect(moved.has("new")).toBe(false);
    expect(dist(moved.get("old")!, { x: 1000, y: 800 })).toBeGreaterThanOrEqual(getCirclePackSpacing() - 1);
    // Pushed straight away from the new node.
    expect(moved.get("old")!.x).toBeGreaterThan(1040);
  });

  it("cascades: a pushed node pushes the next one along", () => {
    const pos = new Map<string, Pt>([
      ["new", { x: 1000, y: 800 }],
      ["a", { x: 1050, y: 800 }],
      ["b", { x: 1200, y: 800 }],
    ]);
    const moved = makeRoom(pos, new Set(["new"]), all);
    const a = moved.get("a")!;
    const b = moved.get("b") ?? pos.get("b")!;
    expect(dist(a, b)).toBeGreaterThanOrEqual(getCirclePackSpacing() - 1);
  });

  it("slides a node along the border instead of leaving it on top of the new one", () => {
    const edgeX = CANVAS_W - EDGE_MARGIN;
    const pos = new Map<string, Pt>([
      ["new", { x: edgeX - 20, y: 800 }],
      ["old", { x: edgeX, y: 800 }],
    ]);
    const moved = makeRoom(pos, new Set(["new"]), all);
    const old = moved.get("old")!;
    expect(old.x).toBeLessThanOrEqual(edgeX);
    expect(dist(old, pos.get("new")!)).toBeGreaterThanOrEqual(getCirclePackSpacing() - 1);
    // Room was made above.
    expect(old.y).toBeLessThan(800);
  });

  it("leaves alone overlaps nothing new is involved in, and nodes it may not move", () => {
    const pos = new Map<string, Pt>([
      ["new", { x: 400, y: 400 }],
      ["theirs", { x: 420, y: 400 }],
      ["x", { x: 1500, y: 1000 }],
      ["y", { x: 1510, y: 1000 }],
    ]);
    const moved = makeRoom(pos, new Set(["new"]), (id) => id !== "theirs");
    expect(moved.size).toBe(0);
  });
});

describe("separateZones", () => {
  // Two circles (a root with two children each) sitting on top of each other.
  const nodes = [node("A"), node("a1", "A"), node("a2", "A"), node("B"), node("b1", "B"), node("b2", "B")];
  const overlapping = () =>
    new Map<string, Pt>([
      ["A", { x: 1000, y: 800 }],
      ["a1", { x: 900, y: 900 }],
      ["a2", { x: 1100, y: 900 }],
      ["B", { x: 1150, y: 800 }],
      ["b1", { x: 1050, y: 900 }],
      ["b2", { x: 1250, y: 900 }],
    ]);

  it("moves the zone that wasn't just touched clear of the one that was", () => {
    const pos = overlapping();
    const moved = separateZones(nodes, nodes, pos, new Set(["a1"]), new Set(["a1"]), all);
    expect(moved.has("A")).toBe(false);
    expect(moved.has("B")).toBe(true);
    const after = new Map([...pos, ...moved]);
    const [za, zb] = computeNodeGroups(nodes, nodes, after);
    expect(dist({ x: za.cx, y: za.cy }, { x: zb.cx, y: zb.cy })).toBeGreaterThanOrEqual(za.r + zb.r);
    // The whole zone moved as one, keeping its shape.
    expect(after.get("b2")!.x - after.get("B")!.x).toBeCloseTo(100, 5);
  });

  it("doesn't separate a zone from a nested zone it shares a member with", () => {
    const nested = [node("R"), node("c1", "R"), node("c2", "R"), node("d1", "c1"), node("d2", "c1")];
    const pos = new Map<string, Pt>([
      ["R", { x: 1000, y: 800 }],
      ["c1", { x: 1000, y: 600 }],
      ["c2", { x: 1200, y: 800 }],
      ["d1", { x: 900, y: 450 }],
      ["d2", { x: 1100, y: 450 }],
    ]);
    const moved = separateZones(nested, nested, pos, new Set(["c1"]), new Set(), all);
    expect(moved.size).toBe(0);
  });
});

describe("planStructureMoves", () => {
  it("never moves the pinned nodes and ignores packed-away nodes", () => {
    const nodes = [node("new"), node("near"), { ...node("packed"), packedIntoNodeId: "near" } as NodeDoc];
    const pos = new Map<string, Pt>([
      ["new", { x: 1000, y: 800 }],
      ["near", { x: 1010, y: 800 }],
      ["packed", { x: 1000, y: 800 }],
    ]);
    const moved = planStructureMoves(nodes, pos, new Set(["new"]), all);
    expect(moved.has("new")).toBe(false);
    expect(moved.has("packed")).toBe(false);
    expect(moved.has("near")).toBe(true);
  });
});
