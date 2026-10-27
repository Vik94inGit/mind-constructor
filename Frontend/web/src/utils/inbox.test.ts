import { describe, expect, it, vi } from "vitest";
import { addQuickNote, findInbox, moveNoteToMap, moveTargets, noteBranch, notePosition, unsortedNotes } from "./inbox";
import * as mapsApi from "../api/maps";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import type { MapDoc, NodeDoc } from "../types";

vi.mock("../api/maps", () => ({
  createMap: vi.fn(async () => ({ mapId: "inbox", name: "Inbox", ownerId: "u1" })),
  getNodesText: vi.fn(async (_mapId: string, ids: string[]) => Object.fromEntries(ids.map((id) => [id, `text ${id}`]))),
}));
vi.mock("../api/nodes", () => ({
  listNodes: vi.fn(async () => [{ nodeId: "a" }, { nodeId: "b" }]),
  getNode: vi.fn(async (id: string) => ({ nodeId: id })),
  createNode: vi.fn(async (_mapId: string, input: object) => ({ nodeId: "n", ...input })),
  updateNode: vi.fn(async (id: string, patch: object) => ({ nodeId: id, ...patch })),
  deleteManyNodes: vi.fn(async () => ({ success: true, deleted: [] })),
}));
vi.mock("../api/edges", () => ({
  listEdges: vi.fn(async () => []),
  createEdge: vi.fn(async () => ({ edgeId: "e" })),
}));

const node = (nodeId: string, parentId: string | null = null, extra: Partial<NodeDoc> = {}) =>
  ({ nodeId, parentId, type: "unknown", text: "", x: 100, y: 100, ...extra }) as NodeDoc;

const map = (mapId: string, name: string, ownerId = "u1") => ({ mapId, name, ownerId }) as MapDoc;

describe("inbox", () => {
  it("lays notes out in rows, never two on one spot", () => {
    const spots = Array.from({ length: 90 }, (_, i) => notePosition(i));
    expect(new Set(spots.map((p) => `${p.x}:${p.y}`)).size).toBe(90);
    expect(notePosition(1).y).toBe(notePosition(0).y);
    expect(notePosition(5).y).toBeGreaterThan(notePosition(0).y);
  });

  it("finds your own map named Inbox, not someone else's", () => {
    expect(findInbox([map("x", "Inbox", "u2"), map("y", "Inbox")], "u1", "Inbox")?.mapId).toBe("y");
    expect(findInbox([map("x", "Inbox", "u2")], "u1", "Inbox")).toBeNull();
  });

  it("makes the Inbox the first time, then adds after the notes already there", async () => {
    localStorage.clear();
    const first = await addQuickNote("Buy milk", [], "u1", "Inbox");
    expect(first.created).toBe(true);
    expect(mapsApi.createMap).toHaveBeenCalledWith(expect.objectContaining({ name: "Inbox", discussionMode: false }));
    expect(nodesApi.createNode).toHaveBeenLastCalledWith("inbox", expect.objectContaining({ text: "Buy milk", ...notePosition(0) }));

    const second = await addQuickNote("Call mum", [map("inbox", "Renamed")], "u1", "Inbox");
    expect(second.created).toBe(false);
    expect(nodesApi.createNode).toHaveBeenLastCalledWith("inbox", expect.objectContaining({ text: "Call mum", ...notePosition(2) }));
  });

  it("lists the top-level notes to sort, oldest first, and moves a note with its branch", () => {
    const nodes = [
      node("b", null, { createdAt: "2026-02-01" }),
      node("a", null, { createdAt: "2026-01-01" }),
      node("a1", "a"),
      node("a2", "a1"),
      node("w", null, { isWeapon: true }),
    ];
    expect(unsortedNotes(nodes).map((n) => n.nodeId)).toEqual(["a", "b"]);
    expect(noteBranch(nodes, "a")).toEqual(["a", "a1", "a2"]);
    expect(noteBranch(nodes, "b")).toEqual(["b"]);
  });

  it("offers every map but the Inbox and finished discussions", () => {
    const maps = [map("inbox", "Inbox"), map("x", "Work"), { ...map("y", "Done"), finishedAt: "2026-01-01" }];
    expect(moveTargets(maps, "inbox").map((m) => m.mapId)).toEqual(["x"]);
  });

  it("makes the note on the target map with its text, then takes it off the Inbox", async () => {
    vi.mocked(nodesApi.listNodes).mockImplementation(async (mapId: string) =>
      mapId === "inbox" ? [node("a"), node("a1", "a", { x: 200 }), node("c")] : [node("t1")],
    );
    vi.mocked(edgesApi.listEdges).mockResolvedValue([
      { edgeId: "e1", fromNodeId: "a", toNodeId: "a1", sentiment: "neutral" } as never,
      { edgeId: "e2", fromNodeId: "a", toNodeId: "c", sentiment: "neutral" } as never,
    ]);
    let id = 0;
    vi.mocked(nodesApi.createNode).mockImplementation(async (_m, input) => ({ nodeId: `new${++id}`, ...input }) as NodeDoc);
    vi.mocked(nodesApi.createNode).mockClear();

    const created = await moveNoteToMap("inbox", "a", map("t", "Work"));

    expect(created).toHaveLength(2);
    expect(nodesApi.createNode).toHaveBeenNthCalledWith(1, "t", expect.objectContaining({ text: "text a", parentId: null }));
    expect(nodesApi.createNode).toHaveBeenNthCalledWith(2, "t", expect.objectContaining({ text: "text a1", parentId: "new1" }));
    // Only the link inside the branch comes along.
    expect(edgesApi.createEdge).toHaveBeenCalledTimes(1);
    expect(edgesApi.createEdge).toHaveBeenCalledWith("t", { fromNodeId: "new1", toNodeId: "new2", sentiment: "neutral" });
    expect(nodesApi.deleteManyNodes).toHaveBeenCalledWith(["a", "a1"]);
  });

  it("leaves the note in the Inbox when it can't be made on the target", async () => {
    vi.mocked(nodesApi.listNodes).mockResolvedValue([node("a")]);
    vi.mocked(edgesApi.listEdges).mockResolvedValue([]);
    vi.mocked(nodesApi.createNode).mockRejectedValueOnce(new Error("offline"));
    vi.mocked(nodesApi.deleteManyNodes).mockClear();
    await expect(moveNoteToMap("inbox", "a", map("t", "Work"))).rejects.toThrow();
    expect(nodesApi.deleteManyNodes).not.toHaveBeenCalled();
  });
});
