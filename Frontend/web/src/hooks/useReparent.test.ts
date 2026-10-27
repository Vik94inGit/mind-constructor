import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useReparent } from "./useReparent";
import { makeEdge, makeNode } from "../test/fixtures";
import { TRANSLATIONS } from "../i18n/translations";
import type { CanvasMode } from "./useCanvasMode";

vi.mock("../api/edges", () => ({ deleteEdge: vi.fn(async () => {}), createEdge: vi.fn() }));
import * as edgesApi from "../api/edges";

const t = TRANSLATIONS.en;

function setup(mode: CanvasMode, opts: { owner?: (id: string) => boolean } = {}) {
  const nodes = [
    makeNode({ nodeId: "root" }),
    makeNode({ nodeId: "a", parentId: "root" }),
    makeNode({ nodeId: "b", parentId: "root" }),
    makeNode({ nodeId: "child", parentId: "a" }),
    makeNode({ nodeId: "theirs", userId: "u2" }),
  ];
  const params = {
    mapId: "m1",
    mode,
    dispatchMode: vi.fn(),
    nodes,
    edges: [makeEdge("child", "a")],
    isOwnNode: (n: { nodeId: string; userId: unknown }) => (opts.owner ? opts.owner(n.nodeId) : n.userId === "u1"),
    posFor: (n: { x?: number; y?: number }) => ({ x: n.x ?? 0, y: n.y ?? 0 }),
    redirectParent: vi.fn(async () => true),
    saveHeadPlan: vi.fn(async () => true),
    setEdges: vi.fn(),
    upsertEdge: vi.fn(),
    refreshInsights: vi.fn(),
    setActionError: vi.fn(),
    setContextMenu: vi.fn(),
    setSelectedId: vi.fn(),
    setMultiSelectIds: vi.fn(),
    t,
  };
  const { result } = renderHook(() => useReparent(params));
  return { result, params };
}

describe("useReparent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starting puts the panel and menus away and enters the mode for that node", () => {
    const { result, params } = setup({ kind: "none" });
    act(() => result.current.startReparent(makeNode({ nodeId: "child" })));
    expect(params.setSelectedId).toHaveBeenCalledWith(null);
    expect(params.setContextMenu).toHaveBeenCalledWith(null);
    expect(params.dispatchMode).toHaveBeenCalledWith({ type: "reparentStart", childId: "child" });
  });

  it("moves the branch and its link to the node tapped next", async () => {
    const { result, params } = setup({ kind: "reparent", childId: "child", error: null });
    expect(result.current.reparentChild?.nodeId).toBe("child");
    vi.mocked(edgesApi.createEdge).mockResolvedValue(makeEdge("child", "b"));
    await act(async () => result.current.pickNewParent(params.nodes[2]));
    expect(params.dispatchMode).toHaveBeenCalledWith({ type: "reset" });
    expect(params.redirectParent).toHaveBeenCalledWith(params.nodes[3], params.nodes[2]);
    await vi.waitFor(() => expect(edgesApi.createEdge).toHaveBeenCalledWith("m1", expect.objectContaining({ fromNodeId: "child", toNodeId: "b" })));
    expect(edgesApi.deleteEdge).toHaveBeenCalledWith("child-a");
  });

  it("says why a tap can't be the new parent and stays in the mode", () => {
    const { result, params } = setup({ kind: "reparent", childId: "a", error: null });
    act(() => result.current.pickNewParent(params.nodes[3]));
    expect(params.dispatchMode).toHaveBeenCalledWith({ type: "reparentSetError", error: t.ui.errors.dropOnOwnBranch });
    expect(params.redirectParent).not.toHaveBeenCalled();
  });

  it("its own parent tapped: the node takes that parent's place", async () => {
    const { result, params } = setup({ kind: "reparent", childId: "child", error: null });
    await act(async () => result.current.pickNewParent(params.nodes[1]));
    expect(params.dispatchMode).toHaveBeenCalledWith({ type: "reset" });
    expect(params.saveHeadPlan).toHaveBeenCalled();
    expect(params.redirectParent).not.toHaveBeenCalled();
  });

  it("Escape leaves the mode, and so does a child that's gone", () => {
    const { params } = setup({ kind: "reparent", childId: "child", error: null });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(params.dispatchMode).toHaveBeenCalledWith({ type: "reset" });
    const gone = setup({ kind: "reparent", childId: "nobody", error: null });
    expect(gone.params.dispatchMode).toHaveBeenCalledWith({ type: "reset" });
  });
});
