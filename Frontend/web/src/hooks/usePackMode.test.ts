import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePackMode } from "./usePackMode";
import { makeNode } from "../test/fixtures";

vi.mock("../api/nodes", () => ({ packNodes: vi.fn() }));
import * as nodesApi from "../api/nodes";

function setup(picks: string[], selectedId: string | null = null) {
  const params = {
    packContainerId: "box",
    packSelection: new Set(picks),
    nodes: [makeNode({ nodeId: "box" }), makeNode({ nodeId: "a" }), makeNode({ nodeId: "b" })],
    selectedId,
    setSelectedId: vi.fn(),
    setMultiSelectIds: vi.fn(),
    dispatchMode: vi.fn(),
    upsertNode: vi.fn(),
    setActionError: vi.fn(),
    packFailedMessage: "pack failed",
  };
  const { result } = renderHook(() => usePackMode(params));
  return { result, params };
}

describe("usePackMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the container and picks, dropping ones that no longer exist", () => {
    const { result } = setup(["a", "gone"]);
    expect(result.current.packContainer?.nodeId).toBe("box");
    expect(result.current.packPicks.map((n) => n.nodeId)).toEqual(["a"]);
  });

  it("packs the picks, deselects a packed node and leaves pack mode", async () => {
    const container = makeNode({ nodeId: "box" });
    const a = makeNode({ nodeId: "a", packedIntoNodeId: "box" });
    vi.mocked(nodesApi.packNodes).mockResolvedValue({ container, members: [a] } as never);
    const { result, params } = setup(["a"], "a");
    await act(() => result.current.confirmPackSelection());
    expect(nodesApi.packNodes).toHaveBeenCalledWith("box", ["a"]);
    expect(params.upsertNode).toHaveBeenCalledWith(container);
    expect(params.setSelectedId).toHaveBeenCalledWith(null);
    expect(params.dispatchMode).toHaveBeenCalledWith({ type: "reset" });
  });

  it("shows a failed pack in the picker", async () => {
    vi.mocked(nodesApi.packNodes).mockRejectedValue(new Error("x"));
    const { result, params } = setup(["a"]);
    await act(() => result.current.confirmPackSelection());
    expect(params.dispatchMode).toHaveBeenCalledWith({ type: "packSetError", error: "pack failed" });
  });

  it("starting a pick clears the group selection first", () => {
    const { result, params } = setup([]);
    act(() => result.current.startPackFrom("box"));
    expect(params.setMultiSelectIds).toHaveBeenCalledWith(new Set());
    expect(params.dispatchMode).toHaveBeenCalledWith({ type: "packStart", containerId: "box" });
  });
});
