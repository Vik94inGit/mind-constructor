import { describe, expect, it } from "vitest";
import { countByType, filterByTypes, groupByType, isAnswered, isTemplateMap, templateAnswerGroups } from "./mapSummary";
import { makeNode } from "../test/fixtures";

describe("mapSummary", () => {
  const plain = [
    makeNode({ nodeId: "p", text: "Too slow", type: "Problem", createdAt: "1" }),
    makeNode({ nodeId: "s", text: "Cache it", type: "Solution", parentId: "p", createdAt: "2" }),
    makeNode({ nodeId: "p2", text: "Too costly", type: "Problem", parentId: "p", x: 200, createdAt: "3" }),
  ];

  it("counts and groups nodes by type, in the type order, leaving out empty types", () => {
    expect(countByType(plain).Problem).toBe(2);
    expect(countByType(plain).Idea).toBe(0);
    expect(groupByType(plain).map((g) => [g.type, g.nodes.map((n) => n.nodeId)])).toEqual([
      ["Problem", ["p", "p2"]],
      ["Solution", ["s"]],
    ]);
  });

  it("filters by the picked types, all when none are picked", () => {
    expect(filterByTypes(plain, []).length).toBe(3);
    expect(filterByTypes(plain, ["Solution"]).map((n) => n.nodeId)).toEqual(["s"]);
  });

  it("tells a template map by its ghost questions, and a ghost never counts as answered", () => {
    expect(isTemplateMap(plain)).toBe(false);
    expect(isTemplateMap([...plain, makeNode({ nodeId: "q", text: "", prompt: "Why?" })])).toBe(true);
    expect(isAnswered(makeNode({ nodeId: "a", text: "yes" }))).toBe(true);
    expect(isAnswered(makeNode({ nodeId: "b", text: "  " }))).toBe(false);
    expect(isAnswered(makeNode({ nodeId: "c", text: "left over", ghost: true }))).toBe(false);
  });

  it("groups a template's questions by level with progress, and locks a level behind an unfilled one", () => {
    const nodes = [
      makeNode({ nodeId: "root", text: "Bike sharing", prompt: "What's the idea?", type: "Idea", createdAt: "0" }),
      makeNode({ nodeId: "a1", text: "Commuters", prompt: "What problem does it solve?", level: 1, parentId: "root", x: 1, createdAt: "1" }),
      makeNode({ nodeId: "a2", text: "", ghost: true, prompt: "Why would it work?", level: 1, parentId: "root", x: 2, createdAt: "2" }),
      makeNode({ nodeId: "b1", text: "", ghost: true, prompt: "What's the plan?", level: 2, parentId: "root", x: 3, createdAt: "3" }),
      makeNode({ nodeId: "own", text: "Ask Petr", parentId: "root", x: 4, createdAt: "4" }),
    ];
    const { groups, other } = templateAnswerGroups(nodes);
    expect(groups.map((g) => [g.level, g.items.map((n) => n.nodeId), g.answered, g.total, g.locked])).toEqual([
      [null, ["root"], 1, 1, false],
      [1, ["a1", "a2"], 1, 2, false],
      [2, ["b1"], 0, 1, true],
    ]);
    expect(other.map((n) => n.nodeId)).toEqual(["own"]);
  });

  it("puts every question in one group when the template has no levels", () => {
    const nodes = [
      makeNode({ nodeId: "r", text: "", ghost: true, prompt: "Goal?" }),
      makeNode({ nodeId: "c", text: "Run 5k", prompt: "How will you know?", parentId: "r" }),
    ];
    const { groups } = templateAnswerGroups(nodes);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ level: null, answered: 1, total: 2, locked: false });
  });
});
