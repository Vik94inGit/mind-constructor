import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSelectionActions } from "./useSelectionActions";
import { makeNode } from "../test/fixtures";
import { TRANSLATIONS } from "../i18n/translations";
import type { NodeDoc } from "../types";

vi.mock("../api/nodes", () => ({ updateNode: vi.fn(), deleteManyNodes: vi.fn() }));
import * as nodesApi from "../api/nodes";

const t = TRANSLATIONS.en;

function setup(nodes: NodeDoc[], picked: string[]) {
  const params = {
    mapId: "m1",
    nodes,
    positions: new Map(nodes.map((n) => [n.nodeId, { x: n.x ?? 0, y: n.y ?? 0 }])),
    multiSelectIds: new Set(picked),
    isOwnNode: (n: NodeDoc) => n.userId === "u1",
    upsertNode: vi.fn(),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    setMultiSelectIds: vi.fn(),
    setSelectedId: vi.fn(),
    showNodes: vi.fn(),
    setActionError: vi.fn(),
    refreshInsights: vi.fn(),
    t,
  };
  const { result } = renderHook(() => useSelectionActions(params));
  return { result, params };
}

describe("useSelectionActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("numbers your own chosen nodes in order, skipping others'", async () => {
    vi.mocked(nodesApi.updateNode).mockImplementation(async (id, patch) => makeNode({ nodeId: id, ...patch }) as NodeDoc);
    const nodes = [makeNode({ nodeId: "a" }), makeNode({ nodeId: "theirs", userId: "u2" }), makeNode({ nodeId: "b" })];
    const { result, params } = setup(nodes, ["a", "theirs", "b"]);
    await act(() => result.current.numberSelection(false));
    expect(nodesApi.updateNode).toHaveBeenCalledWith("a", { order: 1 });
    expect(nodesApi.updateNode).toHaveBeenCalledWith("b", { order: 2 });
    expect(nodesApi.updateNode).toHaveBeenCalledTimes(2);
    expect(params.showNodes).toHaveBeenCalledWith(["a", "b"]);
  });

  it("groups the chosen nodes under the one nearest their middle", async () => {
    vi.mocked(nodesApi.updateNode).mockImplementation(async (id, patch) => makeNode({ nodeId: id, ...patch }) as NodeDoc);
    const nodes = [
      makeNode({ nodeId: "left", x: 0 }),
      makeNode({ nodeId: "mid", x: 45 }),
      makeNode({ nodeId: "right", x: 100 }),
    ];
    const { result, params } = setup(nodes, ["left", "mid", "right"]);
    await act(() => result.current.groupSelectionIntoCircle());
    expect(nodesApi.updateNode).toHaveBeenCalledWith("left", { parentId: "mid" });
    expect(nodesApi.updateNode).toHaveBeenCalledWith("right", { parentId: "mid" });
    expect(params.setSelectedId).toHaveBeenCalledWith("mid");
    expect(params.setActionError).not.toHaveBeenCalledWith(expect.stringMatching(/./));
  });

  it("deletes only what the server says it deleted", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(nodesApi.deleteManyNodes).mockResolvedValue({ deleted: [{ deletedId: "a" }] } as never);
    const nodes = [makeNode({ nodeId: "a" }), makeNode({ nodeId: "b" })];
    const { result, params } = setup(nodes, ["a", "b"]);
    await act(() => result.current.deleteSelection());
    const filter = vi.mocked(params.setNodes).mock.calls[0][0] as (prev: NodeDoc[]) => NodeDoc[];
    expect(filter(nodes).map((n) => n.nodeId)).toEqual(["b"]);
    expect(params.refreshInsights).toHaveBeenCalledWith("m1");
  });
});
