import { describe, expect, it, vi } from "vitest";
import { deletedNodeOf, leafChildrenOf, restoreDeletedNode } from "./restoreNode";
import { makeNode } from "../test/fixtures";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import type { EdgeDoc } from "../types";

vi.mock("../api/nodes", () => ({
  createNode: vi.fn(async (_mapId: string, input: object) => ({ nodeId: "new", ...input })),
  updateNode: vi.fn(async (id: string, patch: object) => ({ nodeId: id, ...patch })),
}));
vi.mock("../api/edges", () => ({ createEdge: vi.fn(async (_mapId: string, input: object) => ({ edgeId: "e2", ...input })) }));

const edge = (edgeId: string, from: string, to: string) => ({ edgeId, mapId: "m", fromNodeId: from, toNodeId: to, sentiment: "positive", userId: "u1" }) as EdgeDoc;

describe("deleted node undo", () => {
  const gone = makeNode({ nodeId: "a", text: "Full text", title: "T", parentId: "p", x: 5, y: 6, zoneName: "Zone", images: ["/api/images/1"] });
  const nodes = [
    gone,
    makeNode({ nodeId: "c1", parentId: "a" }),
    makeNode({ nodeId: "c2", parentId: "a", userId: "someone else" }),
    makeNode({ nodeId: "w", parentId: "a", isWeapon: true }),
  ];
  const edges = [edge("e1", "a", "b"), edge("e9", "x", "y")];

  it("keeps your own children and the edges the node was on", () => {
    const d = deletedNodeOf(gone, nodes, edges, (n) => n.userId === "u1");
    expect(d.childIds).toEqual(["c1"]);
    expect(d.edges.map((e) => e.edgeId)).toEqual(["e1"]);
  });

  it("recreates the node with its text and extras, re-hangs children and re-links edges", async () => {
    const back = await restoreDeletedNode("m", deletedNodeOf(gone, nodes, edges, (n) => n.userId === "u1"));
    expect(nodesApi.createNode).toHaveBeenCalledWith("m", expect.objectContaining({ text: "Full text", title: "T", parentId: "p", x: 5, y: 6 }));
    expect(nodesApi.updateNode).toHaveBeenCalledWith("new", { zoneName: "Zone", images: ["/api/images/1"] });
    expect(nodesApi.updateNode).toHaveBeenCalledWith("c1", { parentId: "new" });
    expect(edgesApi.createEdge).toHaveBeenCalledWith("m", { fromNodeId: "new", toNodeId: "b", sentiment: "positive" });
    expect(back.children).toHaveLength(1);
  });

  it("takes along only the leaf children: your own, one generation down, never a child that is a parent", () => {
    const family = [
      makeNode({ nodeId: "p" }),
      makeNode({ nodeId: "leaf", parentId: "p" }),
      makeNode({ nodeId: "branch", parentId: "p" }),
      makeNode({ nodeId: "grandchild", parentId: "branch" }),
      makeNode({ nodeId: "theirs", parentId: "p", userId: "someone else" }),
      makeNode({ nodeId: "attack", parentId: "p", isWeapon: true }),
      // An attack hanging from a leaf doesn't make it a parent.
      makeNode({ nodeId: "hit", parentId: "leaf", isWeapon: true }),
    ];
    const leaves = leafChildrenOf(family[0], family, (n) => n.userId === "u1");
    expect(leaves.map((n) => n.nodeId)).toEqual(["leaf"]);
    const d = deletedNodeOf(family[0], family, [], (n) => n.userId === "u1", leaves);
    expect(d.childIds).toEqual(["branch"]);
  });

  it("brings the leaves back under the restored node, edges between them re-linked to the new ids", async () => {
    vi.mocked(nodesApi.createNode)
      .mockResolvedValueOnce(makeNode({ nodeId: "newP" }))
      .mockResolvedValueOnce(makeNode({ nodeId: "newLeaf" }));
    const parent = makeNode({ nodeId: "p" });
    const leaf = makeNode({ nodeId: "leaf", parentId: "p" });
    const d = deletedNodeOf(parent, [parent, leaf], [edge("e5", "leaf", "p")], () => true, [leaf]);
    const back = await restoreDeletedNode("m", d);
    expect(nodesApi.createNode).toHaveBeenLastCalledWith("m", expect.objectContaining({ parentId: "newP" }));
    expect(back.leaves.map((l) => l.nodeId)).toEqual(["newLeaf"]);
    expect(edgesApi.createEdge).toHaveBeenCalledWith("m", { fromNodeId: "newLeaf", toNodeId: "newP", sentiment: "positive" });
  });
});
