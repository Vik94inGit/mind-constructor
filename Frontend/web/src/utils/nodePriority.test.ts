import { describe, expect, it } from "vitest";
import { captionBox, childCaptionsCoveringParents, computeParentIds, hiddenChildCaptions, nodeSizeMultiplier } from "./nodePriority";
import type { CaptionSpec } from "./nodePriority";
import { makeNode } from "../test/fixtures";

describe("computeParentIds", () => {
  it("marks every visible node that has a visible child, and nothing else", () => {
    const nodes = [
      makeNode({ nodeId: "root" }),
      makeNode({ nodeId: "mid", parentId: "root" }),
      makeNode({ nodeId: "leaf", parentId: "mid" }),
      makeNode({ nodeId: "orphan", parentId: "gone" }),
    ];
    expect([...computeParentIds(nodes)].sort()).toEqual(["mid", "root"]);
  });
});

describe("nodeSizeMultiplier", () => {
  it("puts a circle parent at the biggest tier and shrinks everything in the simplified view", () => {
    expect(nodeSizeMultiplier({ sizeTier: 1 }, true, false)).toBe(1.3);
    expect(nodeSizeMultiplier({ sizeTier: 2 }, false, false)).toBe(1.15);
    expect(nodeSizeMultiplier({ sizeTier: undefined }, false, true)).toBeCloseTo(0.8);
  });
});

describe("childCaptionsCoveringParents", () => {
  const spec = (x: number, y: number, extra: Partial<CaptionSpec> = {}): CaptionSpec => ({
    pos: { x, y },
    sizeMultiplier: 1,
    lines: 2,
    ...extra,
  });
  const parent = spec(500, 500, { sizeMultiplier: 1.3, namedZone: true });

  it("hides a child caption that lands on the parent's caption", () => {
    // Just beside and a little below the parent: its caption row sits in the parent's.
    const children = new Map([["near", spec(560, 510)]]);
    expect(childCaptionsCoveringParents(children, [parent], 1).has("near")).toBe(true);
  });

  it("keeps a child caption that's clear of every parent caption", () => {
    const children = new Map([
      ["below", spec(500, 700)],
      ["side", spec(700, 500)],
      ["above", spec(500, 380)],
    ]);
    expect(childCaptionsCoveringParents(children, [parent], 1).size).toBe(0);
  });

  it("zoomed in, captions keep their screen size and part; zoomed out, they shrink with the map and never collide", () => {
    const side = new Map([["side", spec(660, 500)]]);
    expect(childCaptionsCoveringParents(side, [parent], 1).size).toBe(0);
    expect(childCaptionsCoveringParents(side, [parent], 0.5).size).toBe(0);
    const near = new Map([["near", spec(580, 510)]]);
    expect(childCaptionsCoveringParents(near, [parent], 1).has("near")).toBe(true);
    expect(childCaptionsCoveringParents(near, [parent], 2.5).size).toBe(0);
  });

  it("hangs the caption under the icon, lower for a named zone", () => {
    const plain = captionBox(spec(0, 0), 1);
    const named = captionBox(spec(0, 0, { namedZone: true }), 1);
    expect(plain.top).toBeGreaterThan(24);
    expect(named.bottom).toBeGreaterThan(plain.bottom);
    expect(plain.right - plain.left).toBe(148);
  });
});

describe("hiddenChildCaptions", () => {
  const nodes = [
    makeNode({ nodeId: "p", x: 500, y: 500 }),
    makeNode({ nodeId: "near", parentId: "p", x: 500, y: 510 }),
    makeNode({ nodeId: "far", parentId: "p", x: 1200, y: 900 }),
  ];
  const view = {
    posFor: (n: { x?: number; y?: number }) => ({ x: n.x ?? 0, y: n.y ?? 0 }),
    isCircleParent: () => false,
    modeOf: () => "actual" as const,
    dottedByZone: () => false,
    compact: false,
    zoom: 1,
    selectedId: null,
    inlineEditId: null,
  };
  const parents = computeParentIds(nodes);

  it("leaves out a child's caption that would lie over its parent's", () => {
    expect([...hiddenChildCaptions(nodes, parents, view)]).toEqual(["near"]);
  });

  it("hides nothing while the parent's own caption is down", () => {
    expect(hiddenChildCaptions(nodes, parents, { ...view, selectedId: "p" }).size).toBe(0);
    expect(hiddenChildCaptions(nodes, parents, { ...view, modeOf: () => "puzzle" as const }).size).toBe(0);
  });
});
