import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import * as nodesApi from "../api/nodes";
import { useQuickAdd } from "./useQuickAdd";
import type { NodeDoc } from "../types";
import type { Translation } from "../i18n/translations";

vi.mock("../api/nodes");
vi.mock("../utils/usage");

function setup(extra: { roomForOne?: () => boolean } = {}) {
  const params = {
    ...extra,
    mapId: "m1",
    emojiFirst: false,
    placeNode: vi.fn((p: { x: number; y: number }) => ({ x: p.x + 10, y: p.y })),
    posFor: vi.fn(),
    cardBranchSpot: vi.fn(() => null),
    viewportBounds: vi.fn(() => ({ minX: 0, minY: 0, maxX: 100, maxY: 100 })),
    setInlineEditId: vi.fn(),
    setPendingCreate: vi.fn(),
    upsertNode: vi.fn(),
    setCelebrateIds: vi.fn(),
    setActionError: vi.fn(),
    t: { ui: { errors: { createNode: "could not create" } } } as unknown as Translation,
  };
  const { result } = renderHook(() => useQuickAdd(params));
  return { params, result };
}

describe("createBlankNodeAt (double-tap on empty canvas)", () => {
  it("saves a blank unknown node where the zone rules allow, with no text field", async () => {
    const saved = { nodeId: "n1", text: "", type: "unknown" } as NodeDoc;
    vi.mocked(nodesApi.createNode).mockResolvedValue(saved);
    const { params, result } = setup();
    const node = await result.current.createBlankNodeAt({ x: 50, y: 60 }, "root");
    expect(nodesApi.createNode).toHaveBeenCalledWith("m1", { text: "", type: "unknown", x: 60, y: 60, parentId: "root" });
    expect(node).toBe(saved);
    expect(params.upsertNode).toHaveBeenCalledWith(saved);
    expect(params.setPendingCreate).not.toHaveBeenCalled();
  });

  it("shows an error and hands back nothing when saving fails", async () => {
    vi.mocked(nodesApi.createNode).mockImplementation(async () => { throw new Error("offline"); });
    const { params, result } = setup();
    expect(await result.current.createBlankNodeAt({ x: 0, y: 0 })).toBeNull();
    expect(params.setActionError).toHaveBeenLastCalledWith("could not create");
  });
});

describe("a full area", () => {
  it("starts nothing and makes nothing once there's no room for one more node", async () => {
    vi.mocked(nodesApi.createNode).mockClear();
    const roomForOne = vi.fn(() => false);
    const { params, result } = setup({ roomForOne });
    const parent = { nodeId: "p1" } as NodeDoc;
    result.current.startQuickAdd("Idea", { x: 1, y: 1 }, parent);
    result.current.startNodeAt({ x: 1, y: 1 }, "Idea");
    result.current.startBranchOf(parent);
    expect(await result.current.createBlankNodeAt({ x: 1, y: 1 })).toBeNull();
    await result.current.sketchBranch("Idea", { x: 1, y: 1 }, parent);
    expect(params.setPendingCreate).not.toHaveBeenCalled();
    expect(nodesApi.createNode).not.toHaveBeenCalled();
    expect(roomForOne).toHaveBeenCalledTimes(5);
  });
});
