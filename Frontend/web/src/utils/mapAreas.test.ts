import { afterEach, describe, expect, it } from "vitest";
import {
  areaCountOf,
  areaLinks,
  cutAtAreaEdge,
  areaOf,
  canExtend,
  canRemoveLastArea,
  clampArea,
  MAX_MAP_AREAS,
  miniViews,
  nodesOnArea,
  nodesPerArea,
  setShownArea,
  shownAreaOf,
} from "./mapAreas";
import type { NodeDoc } from "../types";

describe("mapAreas", () => {
  afterEach(() => setShownArea("m1", null));

  it("puts a node with no area on the main one", () => {
    expect(areaOf({})).toBe(0);
    expect(areaOf({ area: 3 })).toBe(3);
  });

  it("keeps a map's area count between one and five", () => {
    expect(areaCountOf(null)).toBe(1);
    expect(areaCountOf({})).toBe(1);
    expect(areaCountOf({ areaCount: 3 })).toBe(3);
    expect(areaCountOf({ areaCount: 9 })).toBe(MAX_MAP_AREAS);
    expect(areaCountOf({ areaCount: 0 })).toBe(1);
  });

  it("sorts nodes by area", () => {
    const nodes = [{ area: 1 }, {}, { area: 1 }, { area: 4 }];
    expect(nodesOnArea(nodes, 1)).toHaveLength(2);
    expect(nodesOnArea(nodes, 0)).toHaveLength(1);
    expect(nodesPerArea(nodes, 3)).toEqual([1, 2, 0]);
  });

  it("shows no mini-views for one area, else All and one per area, six at most", () => {
    expect(miniViews(1)).toEqual([]);
    expect(miniViews(2)).toEqual(["all", 0, 1]);
    expect(miniViews(5)).toEqual(["all", 0, 1, 2, 3, 4]);
    expect(miniViews(9)).toHaveLength(6);
  });

  it("extends up to five areas and gives back only an empty last one", () => {
    expect(canExtend(4)).toBe(true);
    expect(canExtend(5)).toBe(false);
    expect(canRemoveLastArea([], 1)).toBe(false);
    expect(canRemoveLastArea([{ area: 0 }], 2)).toBe(true);
    expect(canRemoveLastArea([{ area: 1 }], 2)).toBe(false);
  });

  it("keeps the area shown inside what the map has", () => {
    expect(clampArea(3, 2)).toBe(1);
    expect(clampArea(-1, 2)).toBe(0);
  });

  it("remembers which area each map shows, for new nodes", () => {
    expect(shownAreaOf("m1")).toBe(0);
    setShownArea("m1", 2);
    expect(shownAreaOf("m1")).toBe(2);
    expect(shownAreaOf("m2")).toBe(0);
    setShownArea("m1", null);
    expect(shownAreaOf("m1")).toBe(0);
  });
});

describe("areaLinks / cutAtAreaEdge", () => {
  const n = (nodeId: string, parentId: string | null, area?: number) => ({ nodeId, parentId, area, text: "" }) as unknown as NodeDoc;
  const nodes = [n("root", null), n("a", "root"), n("b", "root", 1), n("c", "root", 1), n("d", "b", 1)];

  it("links a child on another area back to its parent, and the parent on to it once per area", () => {
    expect(areaLinks(nodes, 1)).toEqual([
      { nodeId: "b", kind: "from", otherId: "root", otherArea: 0 },
      { nodeId: "c", kind: "from", otherId: "root", otherArea: 0 },
    ]);
    expect(areaLinks(nodes, 0)).toEqual([{ nodeId: "root", kind: "to", otherId: "b", otherArea: 1 }]);
  });

  it("draws a thought whose parent is elsewhere as standing on its own", () => {
    const cut = cutAtAreaEdge(nodes.filter((x) => areaOf(x) === 1), nodes);
    expect(cut.map((x) => [x.nodeId, x.parentId])).toEqual([["b", null], ["c", null], ["d", "b"]]);
  });
});
