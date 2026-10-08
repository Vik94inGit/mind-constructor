import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useNodeCreation } from "./useNodeCreation";
import type { PendingCreate } from "./useNodeCreation";
import { makeNode } from "../test/fixtures";
import { TRANSLATIONS } from "../i18n/translations";
import { FULL_CANVAS_BOUNDS } from "../utils/canvasLayout";
import type { NodeDoc } from "../types";

vi.mock("../api/nodes", () => ({ createNode: vi.fn(), packNodes: vi.fn() }));
import * as nodesApi from "../api/nodes";

function setup(pendingCreate: PendingCreate | null = null) {
  const params = {
    mapId: "m1",
    positions: new Map<string, { x: number; y: number }>(),
    pendingCreate,
    setPendingCreate: vi.fn(),
    upsertNode: vi.fn(),
    setCelebrateIds: vi.fn(),
    setSelectedId: vi.fn(),
    setMultiSelectIds: vi.fn(),
    setActionError: vi.fn(),
    obstaclePoints: () => [],
    bigNodeObstacles: () => [],
    placeNode: (p: { x: number; y: number }) => p,
    viewportBounds: () => FULL_CANVAS_BOUNDS,
    showNodes: vi.fn(),
    showNotice: vi.fn(),
    openNewNode: vi.fn(),
    t: TRANSLATIONS.en,
  };
  const { result } = renderHook(() => useNodeCreation(params));
  return { result, params };
}

let created = 0;
describe("useNodeCreation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    created = 0;
    vi.mocked(nodesApi.createNode).mockImplementation(async (_mapId, body) => {
      created += 1;
      return makeNode({ nodeId: `n${created}`, ...body }) as NodeDoc;
    });
  });

  it("creates the pending node where it was typed, closes the input and opens the new node's panel", async () => {
    const { result, params } = setup({ x: 10, y: 20, type: "Problem", parentId: "p" });
    await act(() => result.current.confirmPendingCreate("Hello", "Option"));
    expect(nodesApi.createNode).toHaveBeenCalledWith("m1", { text: "Hello", type: "Option", x: 10, y: 20, parentId: "p" });
    expect(params.upsertNode).toHaveBeenCalled();
    expect(params.openNewNode).toHaveBeenCalledWith(expect.objectContaining({ nodeId: "n1" }), { x: 10, y: 20 });
    expect(params.setPendingCreate).toHaveBeenCalledWith(null);
  });

  it("does nothing without a pending node", async () => {
    const { result } = setup(null);
    await act(() => result.current.confirmPendingCreate("Hello", "Option"));
    expect(nodesApi.createNode).not.toHaveBeenCalled();
  });

  it("creates a circle as a root and two children under it", async () => {
    const { result, params } = setup();
    await act(() => result.current.createCircle());
    const calls = vi.mocked(nodesApi.createNode).mock.calls.map(([, body]) => body);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({ type: "unknown", parentId: null });
    expect(calls[1]).toMatchObject({ type: "Option", parentId: "n1" });
    expect(calls[2]).toMatchObject({ type: "Option", parentId: "n1" });
    expect(params.setSelectedId).toHaveBeenCalledWith("n1");
  });

  it("creates a text's main node and pieces on their spots, and packs the ones without a spot", async () => {
    vi.mocked(nodesApi.packNodes).mockImplementation(async (containerId, ids) => ({
      success: true,
      container: makeNode({ nodeId: containerId }) as NodeDoc,
      members: ids.map((id) => makeNode({ nodeId: id, packedIntoNodeId: containerId }) as NodeDoc),
    }));
    const { result, params } = setup();
    const spots = [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
    ];
    await act(() =>
      result.current.createFromText({
        text: "Whole text",
        rootType: "Problem",
        withRoot: true,
        pieces: [
          { id: "a", text: "A", type: "Option" },
          { id: "b", text: "B", type: "Fail" },
        ],
        packed: new Set(["a"]),
        spots,
      }),
    );
    const calls = vi.mocked(nodesApi.createNode).mock.calls.map(([, body]) => body);
    expect(calls[0]).toMatchObject({ text: "Whole text", type: "Problem", x: 100, y: 100, parentId: null });
    // The piece with a spot first, then the packed one on the main node's spot.
    expect(calls[1]).toMatchObject({ text: "B", x: 300, y: 100, parentId: "n1" });
    expect(calls[2]).toMatchObject({ text: "A", x: 100, y: 100, parentId: "n1" });
    expect(nodesApi.packNodes).toHaveBeenCalledWith("n1", ["n3"]);
    expect(params.showNodes).toHaveBeenCalledWith(["n1", "n2"]);
  });
});
