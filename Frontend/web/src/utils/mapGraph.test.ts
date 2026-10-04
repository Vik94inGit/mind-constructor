import { describe, expect, it } from "vitest";
import {
  closestToCentroidIndex,
  collectBranchIds,
  collectDescendants,
  computeAttackPairIds,
  computeHiddenBranchIds,
  computeSolved,
  computeUnsolvedProblemIds,
  countPackedByContainer,
  upsertBy,
  weaponFlightVector,
  zoneLabel,
} from "./mapGraph";
import { makeNode } from "../test/fixtures";

describe("upsertBy", () => {
  it("appends an unknown id and replaces a known one in place", () => {
    const a = { id: "a", v: 1 };
    const b = { id: "b", v: 1 };
    expect(upsertBy([a], b, (x) => x.id)).toEqual([a, b]);
    expect(upsertBy([a, b], { id: "a", v: 2 }, (x) => x.id)).toEqual([{ id: "a", v: 2 }, b]);
  });
});

describe("computeHiddenBranchIds", () => {
  it("is empty when nothing is hidden", () => {
    expect(computeHiddenBranchIds([makeNode({ nodeId: "a" })]).size).toBe(0);
  });

  it("covers a hidden root and everything hanging from it", () => {
    const nodes = [
      makeNode({ nodeId: "root", hiddenFromMembers: true }),
      makeNode({ nodeId: "child", parentId: "root" }),
      makeNode({ nodeId: "grandchild", parentId: "child" }),
      makeNode({ nodeId: "other" }),
    ];
    expect(computeHiddenBranchIds(nodes)).toEqual(new Set(["root", "child", "grandchild"]));
  });

  it("survives a parentId loop", () => {
    const nodes = [
      makeNode({ nodeId: "a", parentId: "b" }),
      makeNode({ nodeId: "b", parentId: "a" }),
      makeNode({ nodeId: "h", hiddenFromMembers: true }),
    ];
    expect(computeHiddenBranchIds(nodes)).toEqual(new Set(["h"]));
  });
});

describe("computeAttackPairIds", () => {
  const nodes = [
    makeNode({ nodeId: "target" }),
    makeNode({ nodeId: "w1", isWeapon: true, targetNodeId: "target" }),
    makeNode({ nodeId: "w2", isWeapon: true, targetNodeId: "target" }),
    makeNode({ nodeId: "lonely" }),
  ];

  it("pairs a weapon with its target", () => {
    expect(computeAttackPairIds("w1", nodes)).toEqual(new Set(["w1", "target"]));
  });

  it("pairs a target with every attacker", () => {
    expect(computeAttackPairIds("target", nodes)).toEqual(new Set(["target", "w1", "w2"]));
  });

  it("is null with no selection or no attack", () => {
    expect(computeAttackPairIds(null, nodes)).toBeNull();
    expect(computeAttackPairIds("lonely", nodes)).toBeNull();
    expect(computeAttackPairIds("missing", nodes)).toBeNull();
  });
});

describe("collectDescendants", () => {
  it("walks parentId forward to every depth", () => {
    const pool = [
      makeNode({ nodeId: "r" }),
      makeNode({ nodeId: "c", parentId: "r" }),
      makeNode({ nodeId: "g", parentId: "c" }),
      makeNode({ nodeId: "x" }),
    ];
    expect(collectDescendants(new Set(["r"]), pool)).toEqual(new Set(["r", "c", "g"]));
  });
});

describe("collectBranchIds", () => {
  it("goes level by level and skips others' nodes, weapons and shields but walks through them", () => {
    const pool = [
      makeNode({ nodeId: "r" }),
      makeNode({ nodeId: "a", parentId: "r" }),
      makeNode({ nodeId: "theirs", parentId: "r", userId: "u2" }),
      makeNode({ nodeId: "w", parentId: "r", isWeapon: true }),
      makeNode({ nodeId: "s", parentId: "r", isProtection: true }),
      makeNode({ nodeId: "deep", parentId: "theirs" }),
      makeNode({ nodeId: "a2", parentId: "a" }),
    ];
    const isOwn = (n: { userId: unknown }) => n.userId === "u1";
    expect(collectBranchIds("r", pool, isOwn)).toEqual(["a", "a2", "deep"]);
  });
});

describe("countPackedByContainer", () => {
  it("counts packed members per container", () => {
    const nodes = [
      makeNode({ nodeId: "box" }),
      makeNode({ nodeId: "p1", packedIntoNodeId: "box" }),
      makeNode({ nodeId: "p2", packedIntoNodeId: "box" }),
      makeNode({ nodeId: "free" }),
    ];
    expect(countPackedByContainer(nodes)).toEqual(new Map([["box", 2]]));
  });
});

describe("computeUnsolvedProblemIds", () => {
  it("flags a Problem with no Success/Option/Solution child", () => {
    const nodes = [
      makeNode({ nodeId: "p1", type: "Problem" }),
      makeNode({ nodeId: "p1-fail", type: "Fail", parentId: "p1" }),
      makeNode({ nodeId: "p2", type: "Problem" }),
      makeNode({ nodeId: "p2-sol", type: "Solution", parentId: "p2" }),
      makeNode({ nodeId: "pw", type: "Problem", isWeapon: true }),
    ];
    expect(computeUnsolvedProblemIds(nodes)).toEqual(new Set(["p1"]));
  });
});

describe("closestToCentroidIndex", () => {
  it("picks the point nearest the centroid", () => {
    expect(closestToCentroidIndex([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 4, y: 0 }])).toBe(2);
    expect(closestToCentroidIndex([])).toBe(0);
  });
});

describe("weaponFlightVector", () => {
  it("points away from the target, 150px long", () => {
    expect(weaponFlightVector({ x: 10, y: 0 }, { x: 0, y: 0 })).toEqual({ x: 150, y: 0 });
    // Same spot: no direction, but no NaN either.
    expect(weaponFlightVector({ x: 0, y: 0 }, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe("zoneLabel", () => {
  it("prefers zoneName, then title, then text, and caps the length", () => {
    expect(zoneLabel(makeNode({ nodeId: "a", zoneName: "Zone", title: "T", text: "x" }))).toBe("Zone");
    expect(zoneLabel(makeNode({ nodeId: "a", title: "T", text: "x" }))).toBe("T");
    expect(zoneLabel(makeNode({ nodeId: "a", text: "a".repeat(30) }))).toBe(`${"a".repeat(22)}…`);
    expect(zoneLabel(undefined)).toBeUndefined();
  });
});

describe("computeSolved", () => {
  it("marks a Success under a Problem or a goal, however deep, and what it solves", () => {
    const nodes = [
      makeNode({ nodeId: "p", type: "Problem" }),
      makeNode({ nodeId: "o", type: "Option", parentId: "p" }),
      makeNode({ nodeId: "s1", type: "Success", parentId: "o" }),
      makeNode({ nodeId: "g", type: "Solution" }),
      makeNode({ nodeId: "s2", type: "Success", parentId: "g" }),
    ];
    const { successIds, solvedIds } = computeSolved(nodes);
    expect(successIds).toEqual(new Set(["s1", "s2"]));
    expect(solvedIds).toEqual(new Set(["p", "g"]));
  });

  it("answers the nearest Problem/goal only, and skips a Success with none above it", () => {
    const nodes = [
      makeNode({ nodeId: "outer", type: "Problem" }),
      makeNode({ nodeId: "inner", type: "Problem", parentId: "outer" }),
      makeNode({ nodeId: "s", type: "Success", parentId: "inner" }),
      makeNode({ nodeId: "lone", type: "Success" }),
      makeNode({ nodeId: "under-option", type: "Success", parentId: "opt" }),
      makeNode({ nodeId: "opt", type: "Option" }),
    ];
    const { successIds, solvedIds } = computeSolved(nodes);
    expect(successIds).toEqual(new Set(["s"]));
    expect(solvedIds).toEqual(new Set(["inner"]));
  });
});
