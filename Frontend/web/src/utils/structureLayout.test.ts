import { describe, expect, it } from "vitest";
import { makeRoom, planStructureMoves, separateZones, EDGE_MARGIN } from "./structureLayout";
import { CANVAS_W, NODE_FOOTPRINT, computeNodeGroups } from "./canvasLayout";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };
const node = (nodeId: string, parentId: string | null = null) =>
  ({ nodeId, parentId, type: "Option" }) as unknown as NodeDoc;
const all = () => true;
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
// Clear of each other's icon + caption box.
const clear = (a: Pt, b: Pt) =>
  Math.abs(a.x - b.x) >= NODE_FOOTPRINT.w - 1 || Math.abs(a.y - b.y) >= NODE_FOOTPRINT.h - 1;

describe("makeRoom", () => {
  it("pushes a node covered by the pinned one out of its way, and leaves the pinned one where it is", () => {
    const pos = new Map<string, Pt>([
      ["new", { x: 1000, y: 800 }],
      ["old", { x: 1040, y: 800 }],
    ]);
    const moved = makeRoom(pos, new Set(["new"]), all);
    expect(moved.has("new")).toBe(false);
    expect(clear(moved.get("old")!, { x: 1000, y: 800 })).toBe(true);
    // Pushed straight away from the new node, and only just clear of it.
    expect(moved.get("old")!).toEqual({ x: 1000 + NODE_FOOTPRINT.w, y: 800 });
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
    expect(clear(a, b)).toBe(true);
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
    expect(clear(old, pos.get("new")!)).toBe(true);
    // Room was made above.
    expect(old.y).toBeLessThan(800);
  });

  it("lets nodes sit close as long as their boxes don't touch", () => {
    const pos = new Map<string, Pt>([
      ["new", { x: 1000, y: 800 }],
      ["below", { x: 1000, y: 800 + NODE_FOOTPRINT.h + 2 }],
      ["beside", { x: 1000 + NODE_FOOTPRINT.w + 2, y: 800 }],
    ]);
    expect(makeRoom(pos, new Set(["new"]), all).size).toBe(0);
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

describe("planStructureMoves after a drop", () => {
  it("nudges the other zone away by just the overlap, leaving the dropped node and its zone where they are", () => {
    const nodes = [node("A"), node("a1", "A"), node("a2", "A"), node("B"), node("b1", "B"), node("b2", "B")];
    const pos = new Map<string, Pt>([
      ["A", { x: 1000, y: 800 }],
      ["a1", { x: 900, y: 900 }],
      // Just dropped: far enough right that A's zone now reaches into B's.
      ["a2", { x: 1250, y: 900 }],
      ["B", { x: 1500, y: 800 }],
      ["b1", { x: 1400, y: 900 }],
      ["b2", { x: 1600, y: 900 }],
    ]);
    const before = computeNodeGroups(nodes, nodes, pos);
    const overlap = before[0].r + before[1].r + 16 - dist({ x: before[0].cx, y: before[0].cy }, { x: before[1].cx, y: before[1].cy });
    expect(overlap).toBeGreaterThan(0);
    const moved = planStructureMoves(nodes, pos, new Set(["a2"]), all);
    expect(moved.has("a2")).toBe(false);
    expect(moved.has("A")).toBe(false);
    const shift = dist(moved.get("B")!, pos.get("B")!);
    // Minimal: no farther than the overlap itself.
    expect(shift).toBeLessThanOrEqual(overlap + 1);
    const after = computeNodeGroups(nodes, nodes, new Map([...pos, ...moved]));
    expect(dist({ x: after[0].cx, y: after[0].cy }, { x: after[1].cx, y: after[1].cy })).toBeGreaterThanOrEqual(after[0].r + after[1].r);
  });
});
