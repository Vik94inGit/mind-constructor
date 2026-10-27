import { describe, expect, it } from "vitest";
import { computeGeometrizedPositions, computeSlideOrder } from "./presentation";
import { makeNode } from "../test/fixtures";

const ids = (nodes: { nodeId: string }[]) => nodes.map((n) => n.nodeId);

describe("computeSlideOrder", () => {
  it("shows the parents in the order they were made, each followed by its children left to right", () => {
    const nodes = [
      makeNode({ nodeId: "root", createdAt: "2026-01-01T00:00:00Z", x: 500 }),
      // Made first but sits on the right: still shown after its left sibling.
      makeNode({ nodeId: "right", parentId: "root", createdAt: "2026-01-02T00:00:00Z", x: 800 }),
      makeNode({ nodeId: "left", parentId: "root", createdAt: "2026-01-03T00:00:00Z", x: 200 }),
      makeNode({ nodeId: "right-kid", parentId: "right", createdAt: "2026-01-04T00:00:00Z", x: 800 }),
      makeNode({ nodeId: "left-kid", parentId: "left", createdAt: "2026-01-05T00:00:00Z", x: 200 }),
    ];
    // "right" became a parent before "left" did, so its children come first.
    expect(ids(computeSlideOrder(nodes))).toEqual(["root", "left", "right", "right-kid", "left-kid"]);
  });

  it("orders separate trees by when their roots were made, and shows every node once", () => {
    const nodes = [
      makeNode({ nodeId: "b", createdAt: "2026-02-01T00:00:00Z" }),
      makeNode({ nodeId: "a", createdAt: "2026-01-01T00:00:00Z" }),
      makeNode({ nodeId: "a1", parentId: "a", createdAt: "2026-03-01T00:00:00Z" }),
    ];
    expect(ids(computeSlideOrder(nodes))).toEqual(["a", "a1", "b"]);
  });

  it("still shows nodes caught in a parent loop", () => {
    const nodes = [makeNode({ nodeId: "p", parentId: "q" }), makeNode({ nodeId: "q", parentId: "p" })];
    expect(ids(computeSlideOrder(nodes)).sort()).toEqual(["p", "q"]);
  });
});

describe("computeGeometrizedPositions", () => {
  it("keeps children in the left-to-right order they sit in on the canvas", () => {
    const nodes = [
      makeNode({ nodeId: "root", x: 500 }),
      makeNode({ nodeId: "right", parentId: "root", x: 800 }),
      makeNode({ nodeId: "left", parentId: "root", x: 200 }),
    ];
    const pos = computeGeometrizedPositions(nodes);
    expect(pos.get("left")!.x).toBeLessThan(pos.get("right")!.x);
  });
});
