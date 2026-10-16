import { describe, expect, it, vi } from "vitest";
import { deletedNodeOf, restoreDeletedNode } from "./restoreNode";
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
});
