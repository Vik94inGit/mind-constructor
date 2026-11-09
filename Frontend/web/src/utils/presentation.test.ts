import { describe, expect, it } from "vitest";
import { computeSlideGroups, computeSlideOrder, slideHeadSize, slideSubSize } from "./presentation";
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

  it("shows a sliced text's numbered pieces in step order, wherever they sit on the canvas", () => {
    const nodes = [
      makeNode({ nodeId: "text", order: 1, x: 500 }),
      // Carried-on pieces placed in two rows: their x order is 4, 2, 5, 3.
      makeNode({ nodeId: "p2", parentId: "text", order: 2, x: 300 }),
      makeNode({ nodeId: "p3", parentId: "text", order: 3, x: 700 }),
      makeNode({ nodeId: "p4", parentId: "text", order: 4, x: 100 }),
      makeNode({ nodeId: "p5", parentId: "text", order: 5, x: 500 }),
      // An unnumbered child comes after the numbered ones.
      makeNode({ nodeId: "loose", parentId: "text", x: 0 }),
    ];
    expect(ids(computeSlideOrder(nodes))).toEqual(["text", "p2", "p3", "p4", "p5", "loose"]);
    expect(computeSlideGroups(nodes)[0].children.map((n) => n.nodeId)).toEqual(["p2", "p3", "p4", "p5", "loose"]);
  });

  it("still shows nodes caught in a parent loop", () => {
    const nodes = [makeNode({ nodeId: "p", parentId: "q" }), makeNode({ nodeId: "q", parentId: "p" })];
    expect(ids(computeSlideOrder(nodes)).sort()).toEqual(["p", "q"]);
  });
});

describe("computeSlideGroups", () => {
  const groups = (nodes: Parameters<typeof computeSlideGroups>[0]) =>
    computeSlideGroups(nodes).map((g) => [g.node.nodeId, ids(g.children)]);

  it("shows a parent, then all its own children, then the next parent and its children", () => {
    const nodes = [
      makeNode({ nodeId: "root", createdAt: "2026-01-01T00:00:00Z", x: 500 }),
      makeNode({ nodeId: "right", parentId: "root", createdAt: "2026-01-02T00:00:00Z", x: 800 }),
      makeNode({ nodeId: "left", parentId: "root", createdAt: "2026-01-03T00:00:00Z", x: 200 }),
      makeNode({ nodeId: "right-kid", parentId: "right", createdAt: "2026-01-04T00:00:00Z", x: 800 }),
      makeNode({ nodeId: "left-kid", parentId: "left", createdAt: "2026-01-05T00:00:00Z", x: 200 }),
      makeNode({ nodeId: "other", createdAt: "2026-01-06T00:00:00Z" }),
    ];
    expect(groups(nodes)).toEqual([
      ["root", ["left", "right"]],
      ["left", ["left-kid"]],
      ["right", ["right-kid"]],
      ["left-kid", []],
      ["right-kid", []],
      ["other", []],
    ]);
  });

  it("gives a lone root its own slide, and keeps nodes in a parent loop", () => {
    expect(groups([makeNode({ nodeId: "solo" })])).toEqual([["solo", []]]);
    const loop = groups([makeNode({ nodeId: "p", parentId: "q" }), makeNode({ nodeId: "q", parentId: "p" })]);
    expect([...new Set(loop.flatMap(([id, kids]) => [id, ...kids]))].sort()).toEqual(["p", "q"]);
  });
});

describe("slideHeadSize", () => {
  it("keeps a short headline big and centered, a step smaller when children share the slide", () => {
    expect(slideHeadSize("Weekend trip", false)).toEqual({ size: "text-[2rem] sm:text-[2.8rem]", align: "center" });
    expect(slideHeadSize("Weekend trip", true).size).toBe("text-[1.6rem] sm:text-[2.2rem]");
  });

  it("shrinks a long headline and reads it left-aligned", () => {
    const medium = slideHeadSize("x".repeat(100), false);
    const long = slideHeadSize("x".repeat(200), false);
    const veryLong = slideHeadSize("x".repeat(500), true);
    expect(medium.align).toBe("center");
    expect(long).toEqual({ size: "text-[1.25rem] sm:text-[1.6rem]", align: "left" });
    expect(veryLong).toEqual({ size: "text-[1.1rem] sm:text-[1.3rem]", align: "left" });
  });

  it("does the same for the second line", () => {
    expect(slideSubSize("Short").align).toBe("center");
    expect(slideSubSize("x".repeat(300))).toEqual({ size: "text-[0.95rem]", align: "left" });
  });
});
