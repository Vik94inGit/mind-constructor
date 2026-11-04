import { describe, expect, it } from "vitest";
import { firstParentPoint, showsAnyNode } from "./openingFocus";
import { makeNode } from "../test/fixtures";

const pos = (entries: [string, number, number][]) => new Map(entries.map(([id, x, y]) => [id, { x, y }]));

describe("firstParentPoint", () => {
  it("is null on an empty map", () => {
    expect(firstParentPoint([], new Map())).toBeNull();
  });

  it("prefers the map's first node when it is a root", () => {
    const nodes = [
      makeNode({ nodeId: "a", parentId: null, createdAt: "2026-01-01" }),
      makeNode({ nodeId: "b", parentId: null, createdAt: "2026-01-02", isFirstNode: true }),
    ];
    expect(firstParentPoint(nodes, pos([["a", 10, 10], ["b", 500, 400]]))).toEqual({ x: 500, y: 400 });
  });

  it("otherwise takes the oldest root that has children over a lone older note", () => {
    const nodes = [
      makeNode({ nodeId: "lone", parentId: null, createdAt: "2026-01-01" }),
      makeNode({ nodeId: "p", parentId: null, createdAt: "2026-01-02" }),
      makeNode({ nodeId: "c", parentId: "p", createdAt: "2026-01-03" }),
    ];
    expect(firstParentPoint(nodes, pos([["lone", 0, 0], ["p", 300, 300], ["c", 300, 500]]))).toEqual({ x: 300, y: 300 });
  });

  it("falls back to the oldest root, and skips weapons and unplaced nodes", () => {
    const nodes = [
      makeNode({ nodeId: "w", parentId: null, createdAt: "2025-01-01", isWeapon: true }),
      makeNode({ nodeId: "gone", parentId: null, createdAt: "2025-06-01" }),
      makeNode({ nodeId: "b", parentId: null, createdAt: "2026-02-01" }),
      makeNode({ nodeId: "a", parentId: null, createdAt: "2026-01-01" }),
    ];
    expect(firstParentPoint(nodes, pos([["w", 1, 1], ["a", 20, 30], ["b", 40, 50]]))).toEqual({ x: 20, y: 30 });
  });
});

describe("showsAnyNode", () => {
  const positions = pos([["a", 1000, 1000]]);
  it("is true when a node is within half a screen of the spot", () => {
    expect(showsAnyNode({ x: 1300, y: 900 }, positions, 400, 300)).toBe(true);
  });
  it("is false for a spot of empty canvas", () => {
    expect(showsAnyNode({ x: 2000, y: 1000 }, positions, 400, 300)).toBe(false);
  });
});
