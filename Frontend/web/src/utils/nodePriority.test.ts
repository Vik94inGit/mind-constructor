import { describe, expect, it } from "vitest";
import { captionBox, childCaptionsCoveringParents, computeParentIds, nodeSizeMultiplier } from "./nodePriority";
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

  it("scales with zoom: captions keep their screen size, so zooming out makes them collide", () => {
    const children = new Map([["side", spec(660, 500)]]);
    expect(childCaptionsCoveringParents(children, [parent], 1).size).toBe(0);
    expect(childCaptionsCoveringParents(children, [parent], 0.5).has("side")).toBe(true);
  });

  it("hangs the caption under the icon, lower for a named zone", () => {
    const plain = captionBox(spec(0, 0), 1);
    const named = captionBox(spec(0, 0, { namedZone: true }), 1);
    expect(plain.top).toBeGreaterThan(24);
    expect(named.bottom).toBeGreaterThan(plain.bottom);
    expect(plain.right - plain.left).toBe(148);
  });
});
