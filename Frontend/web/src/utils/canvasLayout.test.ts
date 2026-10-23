import { describe, expect, it } from "vitest";
import {
  avoidOverlap,
  dropTargetDistance,
  footprintObstacles,
  freeFootprintScale,
  NODE_FOOTPRINT,
  realmMembers,
  selfIntersects,
  realmOutline,
  CAPTION_WIDTH,
  computeLinkCycles,
  computeNodeGroups,
  getCirclePackSpacing,
  getNodeMinDist,
  getZoneReach,
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

describe("freeFootprintScale", () => {
  it("grows a node's footprint as the map zooms out, since icons keep their size on screen", () => {
    expect(freeFootprintScale(1)).toBe(1);
    expect(freeFootprintScale(0.6)).toBeCloseTo(1 / 0.6);
  });

  it("never shrinks below the plain footprint when zoomed in, and stays plain for dots", () => {
    expect(freeFootprintScale(2)).toBe(1);
    expect(freeFootprintScale(0.5)).toBe(1);
  });

  it("keeps a node dropped beside another clear of it on screen when zoomed out", () => {
    const zoom = 0.6;
    const other = { x: 1000, y: 1000 };
    // Right next to it: clear at normal zoom, but on screen at 60% the two would overlap.
    const desired = { x: other.x + NODE_FOOTPRINT.w + 10, y: other.y };
    expect(avoidOverlap(desired, footprintObstacles([other]))).toEqual(desired);
    const placed = avoidOverlap(desired, footprintObstacles([other], 0, freeFootprintScale(zoom)));
    const onScreenGapX = (Math.abs(placed.x - other.x) - NODE_FOOTPRINT.w / zoom) * zoom;
    const onScreenGapY = (Math.abs(placed.y - other.y) - NODE_FOOTPRINT.h / zoom) * zoom;
    expect(Math.max(onScreenGapX, onScreenGapY)).toBeGreaterThanOrEqual(-0.5);
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

  it("leaves an attack on a member out of the zone", () => {
    const nodes: NodeDoc[] = [
      makeNode({ nodeId: "root", type: "unknown" }),
      makeNode({ nodeId: "c1", type: "Success", parentId: "root" }),
      makeNode({ nodeId: "c2", type: "Option", parentId: "root" }),
      makeNode({ nodeId: "w", type: "Problem", parentId: "root", isWeapon: true, targetNodeId: "root" }),
    ];
    const positions = new Map([
      ["root", { x: 0, y: 0 }],
      ["c1", { x: 100, y: 0 }],
      ["c2", { x: -100, y: 0 }],
      ["w", { x: 0, y: 900 }],
    ]);
    const groups = computeNodeGroups(nodes, nodes, positions);
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((m) => m.nodeId).sort()).toEqual(["c1", "c2", "root"]);
  });

  it("makes a zone of attacks dropped onto another attack", () => {
    const nodes: NodeDoc[] = [
      makeNode({ nodeId: "keep", type: "Solution" }),
      makeNode({ nodeId: "w1", type: "Problem", parentId: "keep", isWeapon: true, targetNodeId: "keep" }),
      makeNode({ nodeId: "w2", type: "Problem", parentId: "w1", isWeapon: true, targetNodeId: "keep" }),
      makeNode({ nodeId: "w3", type: "Fail", parentId: "w1", isWeapon: true, targetNodeId: "keep" }),
    ];
    const positions = new Map([
      ["keep", { x: 0, y: 0 }],
      ["w1", { x: 600, y: 0 }],
      ["w2", { x: 700, y: 100 }],
      ["w3", { x: 700, y: -100 }],
    ]);
    const groups = computeNodeGroups(nodes, nodes, positions);
    expect(groups).toHaveLength(1);
    expect(groups[0].rootId).toBe("w1");
    expect(groups[0].members.map((m) => m.nodeId).sort()).toEqual(["w1", "w2", "w3"]);
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

  it("keeps a member attached to its zone no matter how far it's dragged — only clearing parentId disconnects it", () => {
    // Zone membership is a pure parentId relationship, recomputed fresh from
    // current positions every render — never a proximity check. A member
    // (or, per the map-open reveal, every member at once) drifting far from
    // the rest of its circle still traces the zone's own outline right out
    // to it; only an explicit parentId change — the "dragged clear of its
    // own circle's backdrop" disconnect useNodeDragAndDrop's own drop logic
    // does — actually drops it.
    const nodes: NodeDoc[] = [
      makeNode({ nodeId: "root", type: "unknown" }),
      makeNode({ nodeId: "c1", type: "Success", parentId: "root" }),
      makeNode({ nodeId: "c2", type: "Option", parentId: "root" }),
    ];
    const farPositions = new Map([
      ["root", { x: 0, y: 0 }],
      ["c1", { x: 2000, y: 1500 }],
      ["c2", { x: -100, y: 0 }],
    ]);
    const groups = computeNodeGroups(nodes, nodes, farPositions);
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((m) => m.nodeId).sort()).toEqual(["c1", "c2", "root"]);
    // …but the far member doesn't stretch the drawn zone out to it: only
    // root and c2 are in reach, too few corners for an outline.
    expect(groups[0].outline).toEqual([]);

    const disconnected = nodes.map((n) => (n.nodeId === "c1" ? { ...n, parentId: null } : n));
    // root is left with only one child — no longer enough to form a group.
    expect(computeNodeGroups(disconnected, disconnected, farPositions)).toEqual([]);
  });

  it("draws the zone only through the root and the children within its reach", () => {
    const nodes: NodeDoc[] = [
      makeNode({ nodeId: "root" }),
      makeNode({ nodeId: "c1", parentId: "root" }),
      makeNode({ nodeId: "c2", parentId: "root" }),
      makeNode({ nodeId: "far", parentId: "root" }),
    ];
    const positions = new Map([
      ["root", { x: 500, y: 500 }],
      ["c1", { x: 600, y: 500 }],
      ["c2", { x: 500, y: 600 }],
      ["far", { x: 500 + getZoneReach() + 1, y: 500 }],
    ]);
    const [group] = computeNodeGroups(nodes, nodes, positions);
    expect(group.members.map((m) => m.nodeId).sort()).toEqual(["c1", "c2", "far", "root"]);
    expect([...(group.outlineIds ?? [])].sort()).toEqual(["c1", "c2", "root"]);
    // The zone's radius follows the drawn outline, not the far member.
    expect(group.r).toBeLessThan(getZoneReach());
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

describe("computeNodeGroups with zone layouts", () => {
  // root → a, b; a → a1, a2: a zone at root and a sub-zone at a.
  const nodes: NodeDoc[] = [
    makeNode({ nodeId: "root" }),
    makeNode({ nodeId: "a", parentId: "root" }),
    makeNode({ nodeId: "b", parentId: "root" }),
    makeNode({ nodeId: "a1", parentId: "a" }),
    makeNode({ nodeId: "a2", parentId: "a" }),
  ];
  const positions = new Map([
    ["root", { x: 0, y: 0 }],
    ["a", { x: 100, y: 0 }],
    ["b", { x: 0, y: 100 }],
    ["a1", { x: 200, y: -50 }],
    ["a2", { x: 200, y: 50 }],
  ]);
  const ids = (layouts: Record<string, "zones" | "nested" | "none">) =>
    computeNodeGroups(nodes, nodes, positions, 1000, layouts).map((g) => [g.rootId, g.members.map((m) => m.nodeId).sort()]);

  it("draws separate zones by default", () => {
    expect(ids({})).toEqual([
      ["root", ["a", "b", "root"]],
      ["a", ["a", "a1", "a2"]],
    ]);
  });

  it("draws no zones for the whole map, unless a parent asks for its own", () => {
    expect(ids({ "*": "none" })).toEqual([]);
    expect(ids({ "*": "none", a: "zones" })).toEqual([["a", ["a", "a1", "a2"]]]);
  });

  it("wraps a nested parent's whole branch, with its sub-zones inside, first", () => {
    const groups = computeNodeGroups(nodes, nodes, positions, 1000, { root: "nested" });
    expect(groups.map((g) => g.rootId)).toEqual(["root", "a"]);
    expect(groups[0].members.map((m) => m.nodeId).sort()).toEqual(["a", "a1", "a2", "b", "root"]);
    // The outline is the branch's hull: a sits inside it, not on it.
    expect(groups[0].outlineIds?.sort()).toEqual(["a1", "a2", "b", "root"]);
  });

  it("drops a parent's branch zones when it says none", () => {
    expect(ids({ root: "none" })).toEqual([]);
    expect(ids({ a: "none" })).toEqual([["root", ["a", "b", "root"]]]);
  });
});

describe("realmOutline / realmMembers", () => {
  const n = (nodeId: string, parentId: string | null, extra: Partial<NodeDoc> = {}) =>
    ({ nodeId, parentId, text: "", type: "Problem", x: 0, y: 0, health: 100, defeated: false, userId: "u", ...extra }) as NodeDoc;

  it("takes the whole tree and the shields guarding it, nothing else", () => {
    const nodes = [
      n("k", null),
      n("c", "k"),
      n("deep", "c"),
      n("shield", null, { isProtection: true, protectsNodeId: "deep" }),
      n("other", null),
    ];
    expect(realmMembers("k", nodes).map((x) => x.nodeId)).toEqual(["k", "c", "deep", "shield"]);
  });

  it("keeps every node at least `pad` inside the border", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 150, y: 200 },
      { x: 150, y: 60 },
    ];
    const outline = realmOutline(pts, 50);
    expect(outline.length).toBeGreaterThan(8);
    for (const p of pts) {
      const nearest = Math.min(...outline.map((o) => Math.hypot(o.x - p.x, o.y - p.y)));
      expect(nearest).toBeGreaterThanOrEqual(49);
    }
  });
});

describe("computeNodeGroups — sticky corners", () => {
  const n = (nodeId: string, parentId: string | null) =>
    ({ nodeId, parentId, text: "", type: "Option", x: 0, y: 0, health: 100, defeated: false, userId: "u" }) as NodeDoc;
  const nodes = [n("r", null), n("a", "r"), n("b", "r"), n("c", "r")];

  it("keeps the corner order when one node moves, so only its corner moves", () => {
    const cache = new Map<string, string[]>();
    const at = (pos: Record<string, [number, number]>) => new Map(Object.entries(pos).map(([k, [x, y]]) => [k, { x, y }]));
    const first = computeNodeGroups(nodes, nodes, at({ r: [0, 0], a: [100, 0], b: [100, 100], c: [0, 100] }), 1000, {}, cache);
    // Move "a" a little — still a simple shape in the old order.
    const second = computeNodeGroups(nodes, nodes, at({ r: [0, 0], a: [60, -40], b: [100, 100], c: [0, 100] }), 1000, {}, cache);
    expect(second[0].outlineIds).toEqual(first[0].outlineIds);
  });

  it("re-orders when keeping the old order would cross itself", () => {
    expect(selfIntersects([{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }])).toBe(true);
    expect(selfIntersects([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }])).toBe(false);
  });
});

describe("dropTargetDistance", () => {
  it("hits anywhere on the card plus a small margin, and misses past it", () => {
    const t = { x: 500, y: 500 };
    expect(dropTargetDistance({ x: 500, y: 500 }, t)).toBe(0);
    expect(dropTargetDistance({ x: 500 + NODE_FOOTPRINT.w / 2 + 10, y: 500 }, t)).not.toBeNull();
    expect(dropTargetDistance({ x: 500 + NODE_FOOTPRINT.w / 2 + 30, y: 500 }, t)).toBeNull();
    expect(dropTargetDistance({ x: 500, y: 500 + NODE_FOOTPRINT.h / 2 + 30 }, t)).toBeNull();
  });

  it("grows with the card when zoomed out", () => {
    const p = { x: 500 + NODE_FOOTPRINT.w, y: 500 };
    expect(dropTargetDistance(p, { x: 500, y: 500 })).toBeNull();
    expect(dropTargetDistance(p, { x: 500, y: 500 }, 2)).not.toBeNull();
  });
});
