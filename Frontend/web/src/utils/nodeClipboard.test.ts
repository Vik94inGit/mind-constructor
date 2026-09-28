import { beforeEach, describe, expect, it } from "vitest";
import { buildNodeClipboard, nodeClipboardSize, readNodeClipboard, writeNodeClipboard } from "./nodeClipboard";
import type { NodeClipboard } from "./nodeClipboard";
import type { EdgeDoc, NodeDoc } from "../types";

function makeNode(overrides: Partial<NodeDoc> & { nodeId: string }): NodeDoc {
  return {
    text: "some text",
    type: "unknown",
    parentId: null,
    userId: "u1",
    health: 100,
    defeated: false,
    x: 0,
    y: 0,
    ...overrides,
  };
}

function makeEdge(fromNodeId: string, toNodeId: string): EdgeDoc {
  return { edgeId: `${fromNodeId}-${toNodeId}`, mapId: "m1", fromNodeId, toNodeId, sentiment: "neutral", userId: "u1" };
}

describe("buildNodeClipboard", () => {
  const nodes: NodeDoc[] = [
    makeNode({ nodeId: "root", x: 0, y: 0 }),
    makeNode({ nodeId: "child", parentId: "root", x: 100, y: 0 }),
    makeNode({ nodeId: "outsider", x: 500, y: 500 }),
    makeNode({ nodeId: "weapon", isWeapon: true, x: 10, y: 10 }),
    makeNode({ nodeId: "shield", isProtection: true, x: 20, y: 20 }),
    makeNode({ nodeId: "packed", packedIntoNodeId: "root", x: 30, y: 30 }),
  ];

  it("returns null when nothing eligible is picked", () => {
    expect(buildNodeClipboard("m1", nodes, ["weapon"], {}, [])).toBeNull();
  });

  it("always excludes weapon, protection and packed-away nodes even from a whole-map copy", () => {
    const clip = buildNodeClipboard("m1", nodes, null, {}, []);
    const ids = clip!.nodes.map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining(["root", "child", "outsider"]));
    expect(ids).not.toContain("weapon");
    expect(ids).not.toContain("shield");
    expect(ids).not.toContain("packed");
  });

  it("drops parentId when the parent itself wasn't part of the picked set", () => {
    const clip = buildNodeClipboard("m1", nodes, ["child"], {}, []);
    expect(clip!.nodes).toHaveLength(1);
    expect(clip!.nodes[0]).toMatchObject({ id: "child", parentId: null });
  });

  it("keeps parentId when both ends of the branch link were picked", () => {
    const clip = buildNodeClipboard("m1", nodes, ["root", "child"], {}, []);
    const child = clip!.nodes.find((n) => n.id === "child");
    expect(child?.parentId).toBe("root");
  });

  it("only carries an edge over when both its endpoints were picked", () => {
    const edges = [makeEdge("root", "child"), makeEdge("root", "outsider")];
    const clip = buildNodeClipboard("m1", nodes, ["root", "child"], {}, edges);
    expect(clip!.edges).toEqual([{ from: "root", to: "child", sentiment: "neutral" }]);
  });

  it("prefers the backfilled text over the node's own (possibly still-empty) text", () => {
    const clip = buildNodeClipboard("m1", nodes, ["root"], { root: "the real text" }, []);
    expect(clip!.nodes[0].text).toBe("the real text");
  });
});

describe("clipboard storage round-trip", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is empty with nothing stored", () => {
    expect(readNodeClipboard()).toBeNull();
    expect(nodeClipboardSize()).toBe(0);
  });

  it("round-trips exactly what was written", () => {
    const clip: NodeClipboard = {
      sourceMapId: "m1",
      nodes: [{ id: "a", text: "hi", type: "unknown", x: 1, y: 2, parentId: null }],
      edges: [],
    };
    expect(writeNodeClipboard(clip)).toBe(true);
    expect(readNodeClipboard()).toEqual(clip);
    expect(nodeClipboardSize()).toBe(1);
  });

  it("treats corrupted JSON as empty rather than throwing", () => {
    localStorage.setItem("mc_node_clipboard", "{not valid json");
    expect(readNodeClipboard()).toBeNull();
  });

  it("treats a stored clipboard with zero nodes as empty", () => {
    localStorage.setItem("mc_node_clipboard", JSON.stringify({ sourceMapId: "m1", nodes: [], edges: [] }));
    expect(readNodeClipboard()).toBeNull();
  });
});
