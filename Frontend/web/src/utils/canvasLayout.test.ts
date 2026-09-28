import { describe, expect, it } from "vitest";
import {
  avoidOverlap,
  CAPTION_WIDTH,
  computeDominantSentiment,
  computeLinkCycles,
  computeNodeGroups,
  getCirclePackSpacing,
  getNodeMinDist,
  isDescendant,
} from "./canvasLayout";
import type { EdgeDoc, NodeDoc, NodeType } from "../types";

// Minimal NodeDoc fixture — only the fields these pure functions actually
// read, defaulted so a test only has to spell out what it cares about.
function makeNode(overrides: Partial<NodeDoc> & { nodeId: string }): NodeDoc {
  return {
    text: "",
    type: "unknown",
    parentId: null,
    userId: "u1",
    health: 100,
    defeated: false,
    ...overrides,
  };
}

function makeEdge(fromNodeId: string, toNodeId: string): EdgeDoc {
  return { edgeId: `${fromNodeId}-${toNodeId}`, mapId: "m1", fromNodeId, toNodeId, sentiment: "neutral", userId: "u1" };
}

describe("computeDominantSentiment", () => {
  it("is a tie when nothing has a lean", () => {
    expect(computeDominantSentiment([{ type: "unknown" }])).toBe("tie");
  });

  it("is a tie when positive and negative counts are equal", () => {
    const types: { type: NodeType }[] = [{ type: "Success" }, { type: "Fail" }];
    expect(computeDominantSentiment(types)).toBe("tie");
  });

  it("is positive when Success/Solution/Option strictly outnumber Fail/Problem/Problematic option", () => {
    const types: { type: NodeType }[] = [{ type: "Success" }, { type: "Option" }, { type: "Fail" }];
    expect(computeDominantSentiment(types)).toBe("positive");
  });

  it("is negative when the negative side strictly outnumbers the positive one", () => {
    const types: { type: NodeType }[] = [{ type: "Problem" }, { type: "Fail" }, { type: "Success" }];
    expect(computeDominantSentiment(types)).toBe("negative");
  });

  it("ignores unknown-typed entries entirely — they vote for neither side", () => {
    const types: { type: NodeType }[] = [{ type: "Success" }, { type: "unknown" }, { type: "unknown" }];
    expect(computeDominantSentiment(types)).toBe("positive");
  });
});

describe("isDescendant", () => {
  const nodes: NodeDoc[] = [
    makeNode({ nodeId: "root", parentId: null }),
    makeNode({ nodeId: "child", parentId: "root" }),
    makeNode({ nodeId: "grandchild", parentId: "child" }),
    makeNode({ nodeId: "stranger", parentId: null }),
  ];

  it("is true for a direct child of the ancestor", () => {
    expect(isDescendant("child", "root", nodes)).toBe(true);
  });

  it("is true several hops down the parentId chain", () => {
    expect(isDescendant("grandchild", "root", nodes)).toBe(true);
  });

  it("is false for a node with no relation to the candidate ancestor", () => {
    expect(isDescendant("stranger", "root", nodes)).toBe(false);
  });

  it("is false the other way around — a parent is not its own child's descendant", () => {
    expect(isDescendant("root", "child", nodes)).toBe(false);
  });
});

describe("avoidOverlap", () => {
  it("returns the desired point unchanged when nothing is in the way", () => {
    const placed = avoidOverlap({ x: 500, y: 500 }, []);
    expect(placed).toEqual({ x: 500, y: 500 });
  });

  it("moves a point clear of a spacing obstacle that covers it", () => {
    const desired = { x: 500, y: 500 };
    const obstacle = { x: 500, y: 500, minDist: 150 };
    const placed = avoidOverlap(desired, [obstacle]);
    const dist = Math.hypot(placed.x - desired.x, placed.y - desired.y);
    // It moved, and it cleared the obstacle's own radius.
    expect(dist).toBeGreaterThan(0);
    expect(Math.hypot(placed.x - obstacle.x, placed.y - obstacle.y)).toBeGreaterThanOrEqual(obstacle.minDist - 1);
  });

  it("leaves a point alone that already clears every obstacle", () => {
    const desired = { x: 500, y: 500 };
    const farObstacle = { x: 2000, y: 1400, minDist: 150 };
    expect(avoidOverlap(desired, [farObstacle])).toEqual(desired);
  });
});

describe("computeLinkCycles", () => {
  it("finds a closed triangle of Link edges", () => {
    const edges = [makeEdge("a", "b"), makeEdge("b", "c"), makeEdge("c", "a")];
    const cycles = computeLinkCycles(edges);
    expect(cycles).toHaveLength(1);
    expect(new Set(cycles[0])).toEqual(new Set(["a", "b", "c"]));
  });

  it("finds nothing for a plain two-node link — there's nothing to close", () => {
    const edges = [makeEdge("a", "b")];
    expect(computeLinkCycles(edges)).toEqual([]);
  });

  it("finds nothing for a disconnected pair of edges", () => {
    const edges = [makeEdge("a", "b"), makeEdge("c", "d")];
    expect(computeLinkCycles(edges)).toEqual([]);
  });
});

describe("computeNodeGroups", () => {
  it("groups a root with 2+ direct parentId-children into one circle", () => {
    const nodes: NodeDoc[] = [
      makeNode({ nodeId: "root", type: "unknown" }),
      makeNode({ nodeId: "c1", type: "Success", parentId: "root" }),
      makeNode({ nodeId: "c2", type: "Option", parentId: "root" }),
    ];
    const positions = new Map([
      ["root", { x: 0, y: 0 }],
      ["c1", { x: 100, y: 0 }],
      ["c2", { x: -100, y: 0 }],
    ]);
    const groups = computeNodeGroups(nodes, nodes, positions);
    expect(groups).toHaveLength(1);
    expect(groups[0].rootId).toBe("root");
    expect(groups[0].members.map((m) => m.nodeId).sort()).toEqual(["c1", "c2", "root"]);
    // Both children are positive-leaning types, so the whole circle votes positive.
    expect(groups[0].sentiment).toBe("positive");
  });

  it("does not form a group for a root with only one child", () => {
    const nodes: NodeDoc[] = [
      makeNode({ nodeId: "root" }),
      makeNode({ nodeId: "only-child", parentId: "root" }),
    ];
    const positions = new Map([
      ["root", { x: 0, y: 0 }],
      ["only-child", { x: 100, y: 0 }],
    ]);
    expect(computeNodeGroups(nodes, nodes, positions)).toEqual([]);
  });

  it("votes neutral on a tied or all-unknown circle rather than leaning either way", () => {
    const nodes: NodeDoc[] = [
      makeNode({ nodeId: "root", type: "unknown" }),
      makeNode({ nodeId: "c1", type: "Success", parentId: "root" }),
      makeNode({ nodeId: "c2", type: "Fail", parentId: "root" }),
    ];
    const positions = new Map([
      ["root", { x: 0, y: 0 }],
      ["c1", { x: 100, y: 0 }],
      ["c2", { x: -100, y: 0 }],
    ]);
    const groups = computeNodeGroups(nodes, nodes, positions);
    expect(groups[0].sentiment).toBe("neutral");
  });
});

describe("getCirclePackSpacing", () => {
  it("is tighter than the general node-to-node spacing floor, but never below the caption's own width", () => {
    const packed = getCirclePackSpacing();
    const general = getNodeMinDist();
    expect(packed).toBeLessThan(general);
    expect(packed).toBeGreaterThanOrEqual(CAPTION_WIDTH);
  });
});
