import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { reducer, useCanvasMode } from "./useCanvasMode";

describe("useCanvasMode reducer", () => {
  it("starts in the none mode", () => {
    expect(reducer(undefined as never, { type: "reset" })).toEqual({ kind: "none" });
  });

  it("chooseStart enters choose mode from any state", () => {
    expect(reducer({ kind: "none" }, { type: "chooseStart" })).toEqual({ kind: "choose" });
  });

  it("reset always returns to none, from any mode", () => {
    const pack = reducer({ kind: "none" }, { type: "packStart", containerId: "c1" });
    expect(reducer(pack, { type: "reset" })).toEqual({ kind: "none" });
  });

  describe("pack mode", () => {
    it("packStart opens with an empty pick set and no error", () => {
      const state = reducer({ kind: "none" }, { type: "packStart", containerId: "c1" });
      expect(state).toEqual({ kind: "pack", containerId: "c1", picks: new Set(), error: null });
    });

    it("packToggle adds a node the first time and removes it the second time", () => {
      let state = reducer({ kind: "none" }, { type: "packStart", containerId: "c1" });
      state = reducer(state, { type: "packToggle", nodeId: "n1" });
      expect(state.kind === "pack" && Array.from(state.picks)).toEqual(["n1"]);

      state = reducer(state, { type: "packToggle", nodeId: "n1" });
      expect(state.kind === "pack" && state.picks.size).toBe(0);
    });

    it("packToggle clears a stale error, same as picking a valid node always did", () => {
      let state = reducer({ kind: "none" }, { type: "packStart", containerId: "c1" });
      state = reducer(state, { type: "packSetError", error: "not eligible" });
      state = reducer(state, { type: "packToggle", nodeId: "n1" });
      expect(state.kind === "pack" && state.error).toBeNull();
    });

    it("pack-only actions are a no-op outside pack mode", () => {
      const none = { kind: "none" } as const;
      expect(reducer(none, { type: "packToggle", nodeId: "n1" })).toBe(none);
      expect(reducer(none, { type: "packSetError", error: "x" })).toBe(none);
    });
  });

  describe("draw mode", () => {
    it("drawStart opens with no points and nothing blocked", () => {
      const state = reducer({ kind: "none" }, { type: "drawStart" });
      expect(state).toEqual({ kind: "draw", points: [], hover: null, blocked: null, saving: false });
    });

    it("drawAddPoint appends, drawUndoPoint removes the last one", () => {
      let state = reducer({ kind: "none" }, { type: "drawStart" });
      state = reducer(state, { type: "drawAddPoint", point: { x: 1, y: 1 } });
      state = reducer(state, { type: "drawAddPoint", point: { x: 2, y: 2 } });
      expect(state.kind === "draw" && state.points).toEqual([
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ]);

      state = reducer(state, { type: "drawUndoPoint" });
      expect(state.kind === "draw" && state.points).toEqual([{ x: 1, y: 1 }]);
    });

    it("drawClearPoints empties the line without leaving draw mode", () => {
      let state = reducer({ kind: "none" }, { type: "drawStart" });
      state = reducer(state, { type: "drawAddPoint", point: { x: 1, y: 1 } });
      state = reducer(state, { type: "drawClearPoints" });
      expect(state).toEqual({ kind: "draw", points: [], hover: null, blocked: null, saving: false });
    });

    it("draw-only actions are a no-op outside draw mode", () => {
      const none = { kind: "none" } as const;
      expect(reducer(none, { type: "drawAddPoint", point: { x: 0, y: 0 } })).toBe(none);
      expect(reducer(none, { type: "drawUndoPoint" })).toBe(none);
      expect(reducer(none, { type: "drawSetSaving", saving: true })).toBe(none);
    });
  });
});

describe("useCanvasMode", () => {
  it("dispatches through to the reducer and re-renders with the new mode", () => {
    const { result } = renderHook(() => useCanvasMode());
    expect(result.current[0]).toEqual({ kind: "none" });

    act(() => {
      result.current[1]({ type: "packStart", containerId: "c1" });
    });
    expect(result.current[0]).toEqual({ kind: "pack", containerId: "c1", picks: new Set(), error: null });

    act(() => {
      result.current[1]({ type: "reset" });
    });
    expect(result.current[0]).toEqual({ kind: "none" });
  });
});
