import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { restorePatch, useMoveUndo } from "./useMoveUndo";
import { makeNode } from "../test/fixtures";
import * as nodesApi from "../api/nodes";

vi.mock("../api/nodes", () => ({ updateNode: vi.fn(async (id: string, patch: object) => ({ nodeId: id, ...patch })) }));

describe("restorePatch", () => {
  it("puts the spots back and the parent only when the drag changed it", () => {
    const before = { nodeId: "a", x: 10, y: 20, cardX: null, cardY: null, parentId: "p" };
    expect(restorePatch(before, makeNode({ nodeId: "a", parentId: "p" }))).toEqual({ x: 10, y: 20, cardX: null, cardY: null });
    expect(restorePatch(before, makeNode({ nodeId: "a", parentId: "q" }))).toEqual({ x: 10, y: 20, cardX: null, cardY: null, parentId: "p" });
  });
});

describe("useMoveUndo", () => {
  function setup() {
    const upsertNode = vi.fn();
    const nodes = [makeNode({ nodeId: "a", x: 300, y: 300 })];
    const hook = renderHook(() => useMoveUndo({ nodes, upsertNode, setActionError: vi.fn(), errorMessage: "x", keysEnabled: true }));
    return { hook, upsertNode };
  }

  it("undoes the last recorded move, newest first", async () => {
    const { hook, upsertNode } = setup();
    expect(hook.result.current.canUndo).toBe(false);
    act(() => hook.result.current.recordMove([makeNode({ nodeId: "a", x: 1, y: 1 })]));
    act(() => hook.result.current.recordMove([makeNode({ nodeId: "a", x: 2, y: 2 })]));
    expect(hook.result.current.canUndo).toBe(true);
    await act(() => hook.result.current.undo());
    expect(nodesApi.updateNode).toHaveBeenLastCalledWith("a", expect.objectContaining({ x: 2, y: 2 }));
    expect(upsertNode).toHaveBeenCalled();
  });

  it("runs a recorded change's own way back, and reports its own error when that fails", async () => {
    const setActionError = vi.fn();
    const hook = renderHook(() => useMoveUndo({ nodes: [], upsertNode: vi.fn(), setActionError, errorMessage: "move", keysEnabled: true }));
    const back = vi.fn().mockRejectedValue(new Error("offline"));
    act(() => hook.result.current.recordUndo(back, "restore failed"));
    await act(() => hook.result.current.undo());
    expect(back).toHaveBeenCalled();
    expect(setActionError).toHaveBeenLastCalledWith("restore failed");
    expect(hook.result.current.canUndo).toBe(false);
  });

  it("undoes on Ctrl+Z, but not while typing in a field", async () => {
    vi.mocked(nodesApi.updateNode).mockClear();
    const { hook } = setup();
    act(() => hook.result.current.recordMove([makeNode({ nodeId: "a", x: 5, y: 5 })]));
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    expect(nodesApi.updateNode).not.toHaveBeenCalled();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));
    });
    expect(nodesApi.updateNode).toHaveBeenCalledWith("a", expect.objectContaining({ x: 5, y: 5 }));
  });
});
