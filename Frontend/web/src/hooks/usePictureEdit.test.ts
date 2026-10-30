import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePictureEdit } from "./usePictureEdit";
import { makeNode } from "../test/fixtures";
import { pictureDots, pictureGroups } from "../utils/pictures";
import type { NodeDoc } from "../types";

vi.mock("../api/nodes", () => ({ updateNode: vi.fn(async (id: string, patch: object) => ({ nodeId: id, ...patch })) }));
import * as nodesApi from "../api/nodes";

const posFor = (n: NodeDoc) => ({ x: n.x ?? 0, y: n.y ?? 0 });

// A star laid out at the size "Draw a picture" gives it, written in or not.
function star() {
  return pictureDots("star", { x: 3000, y: 2000 }).map((d, i) =>
    makeNode({ nodeId: `s${i}`, x: d.x, y: d.y, ghost: true, picture: { id: "p1", kind: "star", dot: i } }),
  );
}

function setup(nodes: NodeDoc[]) {
  const params = {
    pictures: pictureGroups(nodes),
    posFor,
    upsertNode: vi.fn(),
    recordMove: vi.fn(),
    setMultiSelectIds: vi.fn(),
    setSelectedId: vi.fn(),
    setMoveMode: vi.fn(),
    setActionError: vi.fn(),
    errorMessage: "resize failed",
  };
  const hook = renderHook(() => usePictureEdit(params));
  return { params, hook };
}

const width = (pts: { x: number }[]) => Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));

describe("usePictureEdit", () => {
  beforeEach(() => vi.mocked(nodesApi.updateNode).mockClear());

  it("opens a picture's bar and closes it on Escape", () => {
    const { hook } = setup(star());
    expect(hook.result.current.openPicture).toBeNull();
    act(() => hook.result.current.openPictureBar("p1"));
    expect(hook.result.current.openPicture?.id).toBe("p1");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(hook.result.current.openPicture).toBeNull();
  });

  it("makes the whole picture bigger, saves every dot and records it for undo", async () => {
    const nodes = star();
    const { params, hook } = setup(nodes);
    act(() => hook.result.current.openPictureBar("p1"));
    await act(async () => hook.result.current.resizePicture(1));
    expect(params.recordMove).toHaveBeenCalledWith(nodes);
    expect(nodesApi.updateNode).toHaveBeenCalledTimes(nodes.length);
    const after = vi.mocked(nodesApi.updateNode).mock.calls.map(([, patch]) => patch as { x: number; y: number });
    expect(width(after) / width(nodes.map(posFor))).toBeCloseTo(1.15, 1);
  });

  it("picks up every dot in Move mode to move the picture as one", () => {
    const nodes = star();
    const { params, hook } = setup(nodes);
    act(() => hook.result.current.openPictureBar("p1"));
    act(() => hook.result.current.movePicture());
    expect(params.setMultiSelectIds).toHaveBeenCalledWith(new Set(nodes.map((n) => n.nodeId)));
    expect(params.setMoveMode).toHaveBeenCalledWith(true);
    expect(hook.result.current.openPicture).toBeNull();
  });

  it("gives every dot the picked fill colour", async () => {
    const nodes = star();
    const { params, hook } = setup(nodes);
    act(() => hook.result.current.openPictureBar("p1"));
    await act(async () => hook.result.current.setPictureColor("sage"));
    expect(nodesApi.updateNode).toHaveBeenCalledTimes(nodes.length);
    expect(vi.mocked(nodesApi.updateNode).mock.calls.every(([, patch]) => (patch as { pictureColor?: string }).pictureColor === "sage")).toBe(true);
    expect(params.upsertNode).toHaveBeenCalledWith(expect.objectContaining({ nodeId: "s0", picture: expect.objectContaining({ color: "sage" }) }));
  });

  it("puts the dots back and says so when saving fails", async () => {
    vi.mocked(nodesApi.updateNode).mockRejectedValueOnce(new Error("offline"));
    const nodes = star();
    const { params, hook } = setup(nodes);
    act(() => hook.result.current.openPictureBar("p1"));
    await act(async () => hook.result.current.resizePicture(1));
    expect(params.setActionError).toHaveBeenLastCalledWith("resize failed");
    expect(params.upsertNode).toHaveBeenLastCalledWith(nodes[nodes.length - 1]);
  });
});
