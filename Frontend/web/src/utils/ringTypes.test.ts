import { describe, expect, it } from "vitest";
import { MAP_KINDS, NODE_TYPES } from "../types";
import { RING_TYPES_BY_KIND, ringTypesFor } from "./ringTypes";

describe("ringTypesFor", () => {
  it("offers every type on a map made empty", () => {
    expect(ringTypesFor(undefined)).toEqual(NODE_TYPES);
    expect(ringTypesFor(null)).toEqual(NODE_TYPES);
  });

  it("keeps a study map to the study types and a problem map to the problem-solving ones", () => {
    expect(ringTypesFor("study")[0]).toBe("Title");
    expect(ringTypesFor("study")).toContain("Question");
    expect(ringTypesFor("study")).not.toContain("Problematic option");
    expect(ringTypesFor("problem")[0]).toBe("Problem");
    expect(ringTypesFor("problem")).not.toContain("Title");
    expect(ringTypesFor("problem")).not.toContain("Question");
  });

  it("adds the chosen node's own type when the map's set lacks it", () => {
    expect(ringTypesFor("study", "Problem")).toEqual([...RING_TYPES_BY_KIND.study, "Problem"]);
    expect(ringTypesFor("study", "Title")).toEqual(RING_TYPES_BY_KIND.study);
  });

  it("has a set for every kind, each a real subset with the kind's root type", () => {
    const roots = { problem: "Problem", decision: "Problem", goal: "Solution", retro: "unknown", idea: "Idea", study: "Title" } as const;
    for (const kind of MAP_KINDS) {
      const set = RING_TYPES_BY_KIND[kind];
      expect(set.length).toBeLessThan(NODE_TYPES.length);
      expect(new Set(set).size).toBe(set.length);
      for (const type of set) expect(NODE_TYPES).toContain(type);
      expect(set).toContain(roots[kind]);
    }
  });
});
