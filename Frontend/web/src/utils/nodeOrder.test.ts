import { describe, expect, it } from "vitest";
import { readingOrder, stepNode } from "./nodeOrder";
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
