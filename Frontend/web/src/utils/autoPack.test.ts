import { beforeEach, describe, expect, it } from "vitest";
import { branchParentIds, foldAway, loadFolded, overviewFolds, saveFolded } from "./autoPack";
import type { NodeDoc } from "../types";

const node = (nodeId: string, parentId?: string) => ({ nodeId, text: "", type: "Option", parentId }) as NodeDoc;

// root ─ a ─ a1
//      │   └ a2
//      ├ b ─ b1 ─ b11
//      └ c
const map = [
  node("root"),
  node("a", "root"),
  node("a1", "a"),
  node("a2", "a"),
  node("b", "root"),
  node("b1", "b"),
  node("b11", "b1"),
  node("c", "root"),
];

describe("autoPack", () => {
  beforeEach(() => localStorage.clear());

  it("knows which nodes have a branch", () => {
    expect([...branchParentIds(map)].sort()).toEqual(["a", "b", "b1", "root"]);
  });

  it("hides everything below a packed parent and counts it", () => {
    const { hidden, counts } = foldAway(map, new Set(["b"]));
    expect([...hidden].sort()).toEqual(["b1", "b11"]);
    expect(counts.get("b")).toBe(2);
  });

  it("hides a packed parent inside another packed branch, counting only the outer one", () => {
    const { hidden, counts } = foldAway(map, new Set(["root", "b"]));
    expect(hidden.size).toBe(7);
    expect(counts.get("root")).toBe(7);
    expect(counts.has("b")).toBe(false);
  });

  it("the overview packs each parent's last details in", () => {
    expect([...overviewFolds(map)].sort()).toEqual(["a", "b1"]);
    const { hidden } = foldAway(map, overviewFolds(map));
    expect([...hidden].sort()).toEqual(["a1", "a2", "b11"]);
  });

  it("keeps the choice per map", () => {
    saveFolded("m1", new Set(["a"]));
    expect([...loadFolded("m1")]).toEqual(["a"]);
    expect(loadFolded("m2").size).toBe(0);
    saveFolded("m1", new Set());
    expect(loadFolded("m1").size).toBe(0);
  });
});
