import { describe, expect, it } from "vitest";
import { MAP_KINDS, NODE_TYPES } from "../types";
import { CORE_TYPES, NON_STUDY_TYPES, RING_TYPES_BY_KIND, STUDY_TYPES, ringAllTypesFor, ringTypesFor } from "./ringTypes";

describe("ringTypesFor", () => {
  it("offers the five core types on a map made empty, the rest but study behind ⋯", () => {
    expect(ringTypesFor(undefined)).toEqual(CORE_TYPES);
    expect(ringTypesFor(null)).toEqual(CORE_TYPES);
    expect(ringAllTypesFor(undefined)).toEqual(NON_STUDY_TYPES);
  });

  it("gives a study map six study choices, with the topic on top", () => {
    const ring = ringTypesFor("study");
    expect(ring).toHaveLength(6);
    expect(ring[0]).toBe("Title");
    for (const type of STUDY_TYPES) expect(ring).toContain(type);
    expect(ringAllTypesFor("study")).toEqual(NODE_TYPES);
  });

  it("never shows a study type on a map that isn't for studying, ⋯ included", () => {
    for (const kind of MAP_KINDS.filter((k) => k !== "study")) {
      for (const type of STUDY_TYPES) {
        expect(ringTypesFor(kind)).not.toContain(type);
        expect(ringAllTypesFor(kind)).not.toContain(type);
      }
    }
  });

  it("keeps every map that isn't for studying to five types up front", () => {
    for (const kind of MAP_KINDS.filter((k) => k !== "study")) expect(ringTypesFor(kind)).toHaveLength(5);
  });

  it("adds the chosen node's own type when the map's set lacks it", () => {
    expect(ringTypesFor("study", "Problem")).toEqual([...RING_TYPES_BY_KIND.study, "Problem"]);
    expect(ringTypesFor("study", "Title")).toEqual(RING_TYPES_BY_KIND.study);
    expect(ringAllTypesFor("problem", "Question")).toEqual([...NON_STUDY_TYPES, "Question"]);
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
