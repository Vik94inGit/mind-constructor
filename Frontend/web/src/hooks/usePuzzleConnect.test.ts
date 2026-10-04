import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePuzzleConnect } from "./usePuzzleConnect";
import { makeEdge, makeNode } from "../test/fixtures";
import type { EdgeDoc, NodeDoc } from "../types";
import type { Snap } from "../utils/puzzleSnap";

vi.mock("../api/edges", () => ({ createEdge: vi.fn() }));
import * as edgesApi from "../api/edges";

function setup(nodes: NodeDoc[], edges: EdgeDoc[] = []) {
  const params = {
    mapId: "m1",
    nodes,
    edges,
    visibleNodes: nodes,
    zoom: 1,
    puzzleJoins: new Map(),
    isOwnNode: (n: NodeDoc) => n.userId === "u1",
    drawnAsCard: () => true,
    posFor: (n: NodeDoc) => ({ x: n.x ?? 0, y: n.y ?? 0 }),
    screenToCanvas: (x: number, y: number) => ({ x, y }),
    upsertEdge: vi.fn(),
    refreshInsights: vi.fn(),
    setActionError: vi.fn(),
    setContextMenu: vi.fn(),
    setPendingLink: vi.fn(),
    linkFailedMessage: "link failed",
  };
  const { result } = renderHook(() => usePuzzleConnect(params));
  return { result, params };
}

const snap = (from: string, to: string) => ({ from, to }) as Snap;

describe("usePuzzleConnect.linkSnappedPieces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links two of your own unlinked pieces, tab to blank", async () => {
    const a = makeNode({ nodeId: "a" });
    const b = makeNode({ nodeId: "b" });
    const created = makeEdge("a", "b");
    vi.mocked(edgesApi.createEdge).mockResolvedValue(created);
    const { result, params } = setup([a, b]);
    await act(() => result.current.linkSnappedPieces(a, snap("a", "b")));
    expect(edgesApi.createEdge).toHaveBeenCalledWith("m1", { fromNodeId: "a", toNodeId: "b", sentiment: "neutral" });
    expect(params.upsertEdge).toHaveBeenCalledWith(created);
    expect(params.refreshInsights).toHaveBeenCalledWith("m1");
  });

  it("skips someone else's piece, an existing link, and a parent/child pair", async () => {
    const a = makeNode({ nodeId: "a" });
    const theirs = makeNode({ nodeId: "t", userId: "u2" });
    const linked = makeNode({ nodeId: "l" });
    const child = makeNode({ nodeId: "c", parentId: "a" });
    const { result } = setup([a, theirs, linked, child], [makeEdge("l", "a")]);
    await act(() => result.current.linkSnappedPieces(a, snap("a", "t")));
    await act(() => result.current.linkSnappedPieces(a, snap("a", "l")));
    await act(() => result.current.linkSnappedPieces(a, snap("a", "c")));
    expect(edgesApi.createEdge).not.toHaveBeenCalled();
  });

  it("reports a failed link", async () => {
    const a = makeNode({ nodeId: "a" });
    const b = makeNode({ nodeId: "b" });
    vi.mocked(edgesApi.createEdge).mockRejectedValue(new Error("nope"));
    const { result, params } = setup([a, b]);
    await act(async () => {
      await result.current.linkSnappedPieces(a, snap("a", "b"));
    });
    expect(params.setActionError).toHaveBeenCalledWith("link failed");
  });
});
