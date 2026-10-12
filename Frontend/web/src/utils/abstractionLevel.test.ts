import { beforeEach, describe, expect, it } from "vitest";
import { levelCount, loadAbstractionLevel, nodeDepths, saveAbstractionLevel, shownAtLevel } from "./abstractionLevel";
import type { NodeDoc } from "../types";

const n = (nodeId: string, parentId: string | null = null) => ({ nodeId, parentId }) as NodeDoc;

describe("nodeDepths", () => {
  it("counts each node's distance from its top idea", () => {
    const depths = nodeDepths([n("c", "b"), n("a"), n("b", "a"), n("x")]);
    expect(depths.get("a")).toBe(0);
    expect(depths.get("b")).toBe(1);
    expect(depths.get("c")).toBe(2);
    expect(depths.get("x")).toBe(0);
    expect(levelCount(depths)).toBe(3);
  });

  it("treats a missing parent as the top", () => {
    expect(nodeDepths([n("a", "gone")]).get("a")).toBe(0);
  });

  it("survives a parent loop", () => {
    const depths = nodeDepths([n("a", "b"), n("b", "a")]);
    expect(depths.size).toBe(2);
  });

  it("has no levels on an empty map", () => {
    expect(levelCount(nodeDepths([]))).toBe(0);
  });
});

describe("shownAtLevel", () => {
  it("shows nodes above the chosen level and everything at null", () => {
    expect(shownAtLevel(0, 1)).toBe(true);
    expect(shownAtLevel(1, 1)).toBe(false);
    expect(shownAtLevel(5, null)).toBe(true);
  });
});

describe("load/save", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips per map and clears on null", () => {
    saveAbstractionLevel("m1", 2);
    expect(loadAbstractionLevel("m1")).toBe(2);
    expect(loadAbstractionLevel("m2")).toBeNull();
    saveAbstractionLevel("m1", null);
    expect(loadAbstractionLevel("m1")).toBeNull();
  });

  it("ignores junk", () => {
    localStorage.setItem("mc_abstraction_level:m1", "zero");
    expect(loadAbstractionLevel("m1")).toBeNull();
  });
});
