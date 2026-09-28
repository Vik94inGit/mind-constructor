import { describe, expect, it } from "vitest";
import { dragUIReducer, initialDragUIState } from "./dragUIState";
import type { DragUIState } from "./dragUIState";

describe("dragUIReducer", () => {
  it("starts with everything null", () => {
    expect(initialDragUIState).toEqual({ drag: null, group: null, dropTarget: null });
  });

  it("dragSet sets the single-node drag position", () => {
    const next = dragUIReducer(initialDragUIState, { type: "dragSet", nodeId: "n1", x: 10, y: 20 });
    expect(next.drag).toEqual({ nodeId: "n1", x: 10, y: 20 });
    // Untouched siblings stay as they were.
    expect(next.group).toBeNull();
    expect(next.dropTarget).toBeNull();
  });

  it("dragSet overwrites a previous drag position (e.g. on every pointermove)", () => {
    const first = dragUIReducer(initialDragUIState, { type: "dragSet", nodeId: "n1", x: 10, y: 20 });
    const second = dragUIReducer(first, { type: "dragSet", nodeId: "n1", x: 30, y: 40 });
    expect(second.drag).toEqual({ nodeId: "n1", x: 30, y: 40 });
  });

  it("dropTargetSet and dropTargetClear toggle the highlight independently of drag", () => {
    const withDrag = dragUIReducer(initialDragUIState, { type: "dragSet", nodeId: "n1", x: 0, y: 0 });
    const withTarget = dragUIReducer(withDrag, { type: "dropTargetSet", nodeId: "n2", valid: true });
    expect(withTarget.dropTarget).toEqual({ nodeId: "n2", valid: true });
    expect(withTarget.drag).toEqual({ nodeId: "n1", x: 0, y: 0 });

    const cleared = dragUIReducer(withTarget, { type: "dropTargetClear" });
    expect(cleared.dropTarget).toBeNull();
    expect(cleared.drag).toEqual({ nodeId: "n1", x: 0, y: 0 });
  });

  it("reset clears drag, group and dropTarget all at once", () => {
    let state: DragUIState = dragUIReducer(initialDragUIState, { type: "dragSet", nodeId: "n1", x: 1, y: 1 });
    state = dragUIReducer(state, { type: "dropTargetSet", nodeId: "n2", valid: false });
    state = dragUIReducer(state, { type: "groupStart", positions: new Map([["n1", { x: 1, y: 1 }]]) });

    const reset = dragUIReducer(state, { type: "reset" });
    expect(reset).toEqual(initialDragUIState);
  });

  it("groupStart seeds the group map wholesale", () => {
    const positions = new Map([
      ["a", { x: 1, y: 1 }],
      ["b", { x: 2, y: 2 }],
    ]);
    const next = dragUIReducer(initialDragUIState, { type: "groupStart", positions });
    expect(next.group).toBe(positions);
  });

  it("groupSetMember updates one member without disturbing the others", () => {
    const positions = new Map([
      ["a", { x: 1, y: 1 }],
      ["b", { x: 2, y: 2 }],
    ]);
    const started = dragUIReducer(initialDragUIState, { type: "groupStart", positions });
    const moved = dragUIReducer(started, {
      type: "groupSetMember",
      id: "a",
      pos: { x: 99, y: 99 },
      fallback: positions,
    });
    expect(moved.group?.get("a")).toEqual({ x: 99, y: 99 });
    expect(moved.group?.get("b")).toEqual({ x: 2, y: 2 });
    // The reducer must not mutate the previous map in place — React relies
    // on referential inequality to know the state actually changed.
    expect(moved.group).not.toBe(started.group);
    expect(started.group?.get("a")).toEqual({ x: 1, y: 1 });
  });

  it("groupSetMember falls back to `fallback` when the group was never started", () => {
    const fallback = new Map([["a", { x: 5, y: 5 }]]);
    const next = dragUIReducer(initialDragUIState, {
      type: "groupSetMember",
      id: "a",
      pos: { x: 7, y: 7 },
      fallback,
    });
    expect(next.group?.get("a")).toEqual({ x: 7, y: 7 });
  });

  it("groupClear drops the group map but leaves drag/dropTarget alone", () => {
    const started = dragUIReducer(initialDragUIState, {
      type: "groupStart",
      positions: new Map([["a", { x: 1, y: 1 }]]),
    });
    const withDrop = dragUIReducer(started, { type: "dropTargetSet", nodeId: "z", valid: true });
    const cleared = dragUIReducer(withDrop, { type: "groupClear" });
    expect(cleared.group).toBeNull();
    expect(cleared.dropTarget).toEqual({ nodeId: "z", valid: true });
  });
});
