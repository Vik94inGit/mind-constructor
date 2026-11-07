import { beforeEach, describe, expect, it, vi } from "vitest";
import { deletedGroupOf, leafChildrenOf, parentsFirst, restoreDeletedGroup } from "./restoreNode";
import { makeNode } from "../test/fixtures";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import type { EdgeDoc, NodeDoc } from "../types";

vi.mock("../api/nodes", () => ({
  createNode: vi.fn(async (_mapId: string, input: object) => ({ nodeId: "new", ...input })),
  updateNode: vi.fn(async (id: string, patch: object) => ({ nodeId: id, ...patch })),
}));
vi.mock("../api/edges", () => ({ createEdge: vi.fn(async (_mapId: string, input: object) => ({ edgeId: "e2", ...input })) }));

const edge = (edgeId: string, from: string, to: string) => ({ edgeId, mapId: "m", fromNodeId: from, toNodeId: to, sentiment: "positive", userId: "u1" }) as EdgeDoc;
const mine = (n: NodeDoc) => n.userId === "u1";

describe("deleted node undo", () => {
  beforeEach(() => vi.clearAllMocks());

  const gone = makeNode({ nodeId: "a", text: "Full text", title: "T", parentId: "p", x: 5, y: 6, zoneName: "Zone", images: ["/api/images/1"] });
  const nodes = [
    makeNode({ nodeId: "p" }),
    gone,
    makeNode({ nodeId: "c1", parentId: "a" }),
    makeNode({ nodeId: "c2", parentId: "a", userId: "someone else" }),
    makeNode({ nodeId: "w", parentId: "a", isWeapon: true }),
  ];
  const edges = [edge("e1", "a", "b"), edge("e9", "x", "y")];

  it("keeps your own children and the edges the node was on", () => {
    const d = deletedGroupOf([gone], nodes, edges, mine);
    expect(d.children).toEqual([{ nodeId: "c1", parentId: "a" }]);
    expect(d.edges.map((e) => e.edgeId)).toEqual(["e1"]);
  });

  it("recreates the node with its text and extras, re-hangs children and re-links edges", async () => {
    const back = await restoreDeletedGroup("m", deletedGroupOf([gone], nodes, edges, mine), new Set(["p", "c1", "b"]));
    expect(nodesApi.createNode).toHaveBeenCalledWith("m", expect.objectContaining({ text: "Full text", title: "T", parentId: "p", x: 5, y: 6 }));
    expect(nodesApi.updateNode).toHaveBeenCalledWith("new", { zoneName: "Zone", images: ["/api/images/1"] });
    expect(nodesApi.updateNode).toHaveBeenCalledWith("c1", { parentId: "new" });
    expect(edgesApi.createEdge).toHaveBeenCalledWith("m", { fromNodeId: "new", toNodeId: "b", sentiment: "positive" });
    expect(back.children).toHaveLength(1);
  });

  it("skips what has gone since: no parent, child or link that isn't on the map any more", async () => {
    const back = await restoreDeletedGroup("m", deletedGroupOf([gone], nodes, edges, mine), new Set());
    expect(nodesApi.createNode).toHaveBeenCalledWith("m", expect.objectContaining({ parentId: null }));
    expect(nodesApi.updateNode).not.toHaveBeenCalledWith("c1", expect.anything());
    expect(edgesApi.createEdge).not.toHaveBeenCalled();
    expect(back.nodes).toHaveLength(1);
  });

  it("still brings the node back when a link can't be made", async () => {
    vi.mocked(edgesApi.createEdge).mockRejectedValueOnce(new Error("gone"));
    const back = await restoreDeletedGroup("m", deletedGroupOf([gone], nodes, edges, mine), new Set(["b"]));
    expect(back.nodes).toHaveLength(1);
    expect(back.edges).toHaveLength(0);
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
    const leaves = leafChildrenOf(family[0], family, mine);
    expect(leaves.map((n) => n.nodeId)).toEqual(["leaf"]);
    const d = deletedGroupOf([family[0], ...leaves], family, [], mine);
    expect(d.children).toEqual([{ nodeId: "branch", parentId: "p" }]);
  });

  it("brings a group back parents first, each hanging from its parent's new id, edges re-linked", async () => {
    vi.mocked(nodesApi.createNode)
      .mockResolvedValueOnce(makeNode({ nodeId: "newP" }))
      .mockResolvedValueOnce(makeNode({ nodeId: "newLeaf" }));
    const parent = makeNode({ nodeId: "p" });
    const leaf = makeNode({ nodeId: "leaf", parentId: "p" });
    // The leaf listed first: it still waits for its parent.
    const d = deletedGroupOf([leaf, parent], [parent, leaf], [edge("e5", "leaf", "p")], () => true);
    const back = await restoreDeletedGroup("m", d, new Set());
    expect(nodesApi.createNode).toHaveBeenLastCalledWith("m", expect.objectContaining({ parentId: "newP" }));
    expect(back.nodes.map((l) => l.nodeId)).toEqual(["newLeaf", "newP"]);
    expect(edgesApi.createEdge).toHaveBeenCalledWith("m", { fromNodeId: "newLeaf", toNodeId: "newP", sentiment: "positive" });
  });

  it("orders parents before their children", () => {
    const a = makeNode({ nodeId: "a" });
    const b = makeNode({ nodeId: "b", parentId: "a" });
    const c = makeNode({ nodeId: "c", parentId: "b" });
    expect(parentsFirst([c, b, a]).map((n) => n.nodeId)).toEqual(["a", "b", "c"]);
  });
});
