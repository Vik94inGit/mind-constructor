import { describe, expect, it } from "vitest";
import { creationOrder, readingOrder, stepAlong, stepNode, zoneOrder, zoneStepIds } from "./nodeOrder";
import { makeNode } from "../test/fixtures";

const ref = (nodeId: string) => ({ nodeId, text: "", type: "Option" }) as never;

describe("nodeOrder", () => {
  const nodes = [
    makeNode({ nodeId: "b1", parentId: ref("root"), createdAt: "2026-01-03" }),
    makeNode({ nodeId: "root", createdAt: "2026-01-01" }),
    makeNode({ nodeId: "a1", parentId: ref("root"), createdAt: "2026-01-02" }),
    makeNode({ nodeId: "a2", parentId: ref("a1"), createdAt: "2026-01-04" }),
    makeNode({ nodeId: "lone", createdAt: "2026-01-05" }),
  ];

  it("reads the tree like an outline, depth first", () => {
    expect(readingOrder(nodes).map((n) => n.nodeId)).toEqual(["root", "a1", "a2", "b1", "lone"]);
  });

  it("puts step numbers before creation time", () => {
    const withOrder = nodes.map((n) => (n.nodeId === "b1" ? { ...n, order: 1 } : n));
    expect(readingOrder(withOrder).map((n) => n.nodeId)).toEqual(["root", "b1", "a1", "a2", "lone"]);
  });

  it("steps forward and back, stopping at the ends", () => {
    expect(stepNode(nodes, "a2", 1)).toBe("b1");
    expect(stepNode(nodes, "a1", -1)).toBe("root");
    expect(stepNode(nodes, "root", -1)).toBeNull();
    expect(stepNode(nodes, "lone", 1)).toBeNull();
  });
});

describe("readingOrder with attacks", () => {
  it("steps through every attack right after the node it hit", () => {
    const nodes = [
      makeNode({ nodeId: "claim", createdAt: "1" }),
      makeNode({ nodeId: "next", createdAt: "2" }),
      makeNode({ nodeId: "hit", createdAt: "3", isWeapon: true, targetNodeId: "claim", parentId: { nodeId: "claim", text: "", type: "Problem" } }),
    ];
    expect(readingOrder(nodes).map((n) => n.nodeId)).toEqual(["claim", "hit", "next"]);
    expect(stepNode(nodes, "claim", 1)).toBe("hit");
  });
});

describe("creationOrder", () => {
  const nodes = [
    makeNode({ nodeId: "root", createdAt: "2026-01-01T10:00:00Z" }),
    makeNode({ nodeId: "late", parentId: ref("root"), createdAt: "2026-03-01T10:00:00Z" }),
    makeNode({ nodeId: "early", parentId: ref("root"), createdAt: "2026-02-01T10:00:00Z" }),
    makeNode({ nodeId: "deep", parentId: ref("late"), createdAt: "2026-02-15T10:00:00Z" }),
  ];

  it("goes oldest first, whatever the tree or step numbers say", () => {
    const withOrder = nodes.map((n) => (n.nodeId === "late" ? { ...n, order: 1 } : n));
    expect(creationOrder(withOrder).map((n) => n.nodeId)).toEqual(["root", "early", "deep", "late"]);
  });

  it("keeps reading order for the same moment and puts undated nodes last", () => {
    const same = [
      makeNode({ nodeId: "b", createdAt: "2026-01-01T10:00:00Z", order: 2 }),
      makeNode({ nodeId: "x" }),
      makeNode({ nodeId: "a", createdAt: "2026-01-01T10:00:00Z", order: 1 }),
    ];
    expect(creationOrder(same).map((n) => n.nodeId)).toEqual(["a", "b", "x"]);
  });

  it("steps along an order, starting at an end when nothing in it is open", () => {
    const order = creationOrder(nodes);
    expect(stepAlong(order, "early", 1)).toBe("deep");
    expect(stepAlong(order, "early", -1)).toBe("root");
    expect(stepAlong(order, "late", 1)).toBeNull();
    expect(stepAlong(order, null, 1)).toBe("root");
    expect(stepAlong(order, "elsewhere", -1)).toBe("late");
    expect(stepAlong([], null, 1)).toBeNull();
  });
});

describe("zoneOrder", () => {
  const nodes = [
    makeNode({ nodeId: "goal", createdAt: "1" }),
    makeNode({ nodeId: "A", parentId: ref("goal"), createdAt: "2" }),
    makeNode({ nodeId: "A1", parentId: ref("A"), createdAt: "3" }),
    makeNode({ nodeId: "A2", parentId: ref("A"), createdAt: "4" }),
    makeNode({ nodeId: "B", parentId: ref("goal"), createdAt: "5" }),
    makeNode({ nodeId: "B1", parentId: ref("B"), createdAt: "6" }),
    makeNode({ nodeId: "B2", parentId: ref("B"), createdAt: "7" }),
    makeNode({ nodeId: "A1x", parentId: ref("A1"), createdAt: "8" }),
    makeNode({ nodeId: "C", parentId: ref("goal"), createdAt: "9" }),
    makeNode({ nodeId: "lone", createdAt: "10" }),
  ];

  it("finishes each zone before the next, branch by branch", () => {
    expect(zoneOrder(nodes).map((n) => n.nodeId)).toEqual(["goal", "A", "B", "C", "A1", "A2", "A1x", "B1", "B2", "lone"]);
  });

  it("keeps every node exactly once, as readingOrder does", () => {
    expect(zoneOrder(nodes).map((n) => n.nodeId).sort()).toEqual(readingOrder(nodes).map((n) => n.nodeId).sort());
  });

  it("puts an attack right after the node it hit, outside that node's zone", () => {
    const withAttack = [
      ...nodes,
      makeNode({ nodeId: "hit", createdAt: "11", isWeapon: true, targetNodeId: "A", parentId: ref("A") }),
    ];
    const order = zoneOrder(withAttack).map((n) => n.nodeId);
    expect(order.slice(0, 5)).toEqual(["goal", "A", "hit", "B", "C"]);
    expect(order.indexOf("A1")).toBeGreaterThan(order.indexOf("C"));
    expect(zoneStepIds(withAttack, "hit")).toEqual(["goal", "A", "B", "C"]);
    expect(zoneStepIds(withAttack, "A2")).toEqual(["A", "A1", "A2"]);
  });

  it("frames a step with its parent's zone, a top node with its own", () => {
    expect(zoneStepIds(nodes, "goal")).toEqual(["goal", "A", "B", "C"]);
    expect(zoneStepIds(nodes, "B")).toEqual(["goal", "A", "B", "C"]);
    expect(zoneStepIds(nodes, "B2")).toEqual(["B", "B1", "B2"]);
    expect(zoneStepIds(nodes, "A1x")).toEqual(["A1", "A1x"]);
    expect(zoneStepIds(nodes, "lone")).toEqual(["lone"]);
    expect(zoneStepIds(nodes, "missing")).toEqual([]);
  });

  it("survives a parentId loop", () => {
    const loop = [
      makeNode({ nodeId: "x", parentId: ref("y") }),
      makeNode({ nodeId: "y", parentId: ref("x") }),
    ];
    expect(zoneOrder(loop).map((n) => n.nodeId).sort()).toEqual(["x", "y"]);
  });
});
