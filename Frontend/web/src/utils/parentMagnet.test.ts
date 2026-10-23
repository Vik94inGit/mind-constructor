import { describe, expect, it } from "vitest";
import { makeNode } from "../test/fixtures";
import { FULL_CANVAS_BOUNDS, NODE_FOOTPRINT } from "./canvasLayout";
import { MAGNET_BUTTON_FAR_FACTOR, MAGNET_PULL_FACTOR, magnetPulls } from "./parentMagnet";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

const REACH = 300;

function pullsFor(nodes: NodeDoc[], positions: Map<string, Pt>, moved: Map<string, Pt>, canPull = (_n: NodeDoc) => true) {
  const obstaclePoints = (exclude: Set<string>) =>
    Array.from(positions).filter(([id]) => !exclude.has(id)).map(([, p]) => p);
  return magnetPulls(moved, nodes, positions, canPull, obstaclePoints, FULL_CANVAS_BOUNDS, REACH);
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const overlap = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < NODE_FOOTPRINT.w && Math.abs(a.y - b.y) < NODE_FOOTPRINT.h;

describe("magnetPulls", () => {
  it("pulls a child left too far back to the side it was on", () => {
    const nodes = [makeNode({ nodeId: "p", parentId: null }), makeNode({ nodeId: "c", parentId: "p" })];
    const positions = new Map<string, Pt>([["p", { x: 400, y: 800 }], ["c", { x: 700, y: 800 }]]);
    // The parent moved 1000px to the right of where it was: c now sits far to its left.
    const pulls = pullsFor(nodes, positions, new Map([["p", { x: 1600, y: 800 }]]));
    const at = pulls.get("c")!;
    expect(at.x).toBeCloseTo(1600 - REACH * MAGNET_PULL_FACTOR);
    expect(at.y).toBeCloseTo(800);
  });

  it("leaves a child that is still close where it is", () => {
    const nodes = [makeNode({ nodeId: "p", parentId: null }), makeNode({ nodeId: "c", parentId: "p" })];
    const positions = new Map<string, Pt>([["p", { x: 400, y: 800 }], ["c", { x: 700, y: 800 }]]);
    expect(pullsFor(nodes, positions, new Map([["p", { x: 500, y: 800 }]])).size).toBe(0);
  });

  it("the magnet button's closer threshold pulls a child that is just outside the zone", () => {
    const nodes = [makeNode({ nodeId: "p", parentId: null }), makeNode({ nodeId: "c", parentId: "p" })];
    const positions = new Map<string, Pt>([["p", { x: 400, y: 800 }], ["c", { x: 400 + REACH * 1.2, y: 800 }]]);
    const obstaclePoints = (exclude: Set<string>) =>
      Array.from(positions).filter(([id]) => !exclude.has(id)).map(([, p]) => p);
    const at = new Map([["p", positions.get("p")!]]);
    expect(magnetPulls(at, nodes, positions, () => true, obstaclePoints, FULL_CANVAS_BOUNDS, REACH).size).toBe(0);
    const pulls = magnetPulls(at, nodes, positions, () => true, obstaclePoints, FULL_CANVAS_BOUNDS, REACH, 1, MAGNET_BUTTON_FAR_FACTOR);
    expect(pulls.get("c")!.x).toBeCloseTo(400 + REACH * MAGNET_PULL_FACTOR);
  });

  it("moves on to a free spot when the pulled-to spot is taken, still within reach", () => {
    const nodes = [
      makeNode({ nodeId: "p", parentId: null }),
      makeNode({ nodeId: "c", parentId: "p" }),
      makeNode({ nodeId: "o", parentId: null }),
    ];
    const blocker = { x: 1600 - REACH * MAGNET_PULL_FACTOR, y: 800 };
    const positions = new Map<string, Pt>([["p", { x: 400, y: 800 }], ["c", { x: 700, y: 800 }], ["o", blocker]]);
    const parent = { x: 1600, y: 800 };
    const at = pullsFor(nodes, positions, new Map([["p", parent]])).get("c")!;
    expect(overlap(at, blocker)).toBe(false);
    expect(overlap(at, parent)).toBe(false);
    expect(dist(at, parent)).toBeLessThanOrEqual(REACH);
  });

  it("keeps two pulled children off each other", () => {
    const nodes = [
      makeNode({ nodeId: "p", parentId: null }),
      makeNode({ nodeId: "a", parentId: "p" }),
      makeNode({ nodeId: "b", parentId: "p" }),
    ];
    const positions = new Map<string, Pt>([["p", { x: 300, y: 800 }], ["a", { x: 400, y: 800 }], ["b", { x: 410, y: 820 }]]);
    const pulls = pullsFor(nodes, positions, new Map([["p", { x: 1800, y: 800 }]]));
    expect(pulls.size).toBe(2);
    expect(overlap(pulls.get("a")!, pulls.get("b")!)).toBe(false);
  });

  it("carries a pulled child's own far children along", () => {
    const nodes = [
      makeNode({ nodeId: "p", parentId: null }),
      makeNode({ nodeId: "c", parentId: "p" }),
      makeNode({ nodeId: "g", parentId: "c" }),
    ];
    const positions = new Map<string, Pt>([["p", { x: 300, y: 800 }], ["c", { x: 500, y: 800 }], ["g", { x: 500, y: 1000 }]]);
    const pulls = pullsFor(nodes, positions, new Map([["p", { x: 1900, y: 800 }]]));
    const c = pulls.get("c")!;
    const g = pulls.get("g")!;
    expect(g).toBeDefined();
    expect(dist(g, c)).toBeLessThanOrEqual(REACH);
  });

  it("doesn't touch nodes it may not move, attacks, or what was moved itself", () => {
    const nodes = [
      makeNode({ nodeId: "p", parentId: null }),
      makeNode({ nodeId: "theirs", parentId: "p" }),
      makeNode({ nodeId: "atk", parentId: "p", isWeapon: true, targetNodeId: "p" }),
      makeNode({ nodeId: "dragged", parentId: "p" }),
    ];
    const positions = new Map<string, Pt>([
      ["p", { x: 300, y: 800 }],
      ["theirs", { x: 400, y: 600 }],
      ["atk", { x: 400, y: 1000 }],
      ["dragged", { x: 400, y: 800 }],
    ]);
    const moved = new Map([["p", { x: 1900, y: 800 }], ["dragged", { x: 400, y: 800 }]]);
    expect(pullsFor(nodes, positions, moved, (n) => n.nodeId !== "theirs").size).toBe(0);
  });
});
