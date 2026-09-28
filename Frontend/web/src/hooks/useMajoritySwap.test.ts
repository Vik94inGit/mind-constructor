import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMajoritySwap } from "./useMajoritySwap";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

function props(nodes: NodeDoc[], positions: Map<string, Pt>, showPoints = vi.fn(), showNotice = vi.fn()) {
  return {
    nodes,
    positions,
    nodeGroups: [],
    draftType: undefined,
    showPoints,
    showNotice,
    positiveMajorityNotice: "POSITIVE",
    negativeMajorityNotice: "NEGATIVE",
  };
}

// Rerendering and draining the fake-timer-driven animation have to be two
// separate `act` calls, not one combined async callback — renderHook's own
// `rerender` already wraps itself in its own act(), and folding
// vi.runAllTimersAsync() into that same outer async act callback left the
// animation's later steps un-drained in practice (observed: only the first
// step's setState landed). Splitting them is what actually flushes every
// step through to the end.
function settle(rerender: (p: ReturnType<typeof props>) => void, p: ReturnType<typeof props>) {
  act(() => {
    rerender(p);
  });
}

async function drainTimers() {
  await act(async () => {
    await vi.runAllTimersAsync();
  });
}

describe("useMajoritySwap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing on a tied (or all-unknown) map", async () => {
    const nodes = [makeNode({ nodeId: "a", type: "unknown" })];
    const positions = new Map<string, Pt>([["a", { x: 100, y: 100 }]]);
    const showNotice = vi.fn();
    const { result } = renderHook((p) => useMajoritySwap(p), { initialProps: props(nodes, positions, vi.fn(), showNotice) });

    await drainTimers();

    expect(result.current.majoritySwapState).toBeNull();
    expect(showNotice).not.toHaveBeenCalled();
  });

  it("glides the map toward center and fires the positive notice on a swing to a positive majority", async () => {
    const positions = new Map<string, Pt>([["a", { x: 100, y: 100 }]]);
    const showPoints = vi.fn();
    const showNotice = vi.fn();
    const tied = [makeNode({ nodeId: "a", type: "unknown" })];
    const { result, rerender } = renderHook((p) => useMajoritySwap(p), {
      initialProps: props(tied, positions, showPoints, showNotice),
    });

    const swungPositive = [makeNode({ nodeId: "a", type: "Success" })];
    settle(rerender, props(swungPositive, positions, showPoints, showNotice));

    expect(showNotice).toHaveBeenCalledWith("POSITIVE");
    expect(showPoints).toHaveBeenCalled();

    await drainTimers();

    const settled = result.current.majoritySwapState?.get("a");
    expect(settled).toBeDefined();
    // Moved away from its own starting spot, toward the canvas center.
    expect(settled).not.toEqual({ x: 100, y: 100 });
  });

  it("fires the negative notice on a swing to a negative majority", async () => {
    const positions = new Map<string, Pt>([["a", { x: 100, y: 100 }]]);
    const showPoints = vi.fn();
    const showNotice = vi.fn();
    const tied = [makeNode({ nodeId: "a", type: "unknown" })];
    const { rerender } = renderHook((p) => useMajoritySwap(p), {
      initialProps: props(tied, positions, showPoints, showNotice),
    });

    const swungNegative = [makeNode({ nodeId: "a", type: "Fail" })];
    settle(rerender, props(swungNegative, positions, showPoints, showNotice));
    await drainTimers();

    expect(showNotice).toHaveBeenCalledWith("NEGATIVE");
  });

  it("does not re-fire when the dominant side stays the same across renders", async () => {
    const positions = new Map<string, Pt>([
      ["a", { x: 100, y: 100 }],
      ["b", { x: 200, y: 200 }],
    ]);
    const showNotice = vi.fn();
    const positive = [makeNode({ nodeId: "a", type: "Success" })];
    const { rerender } = renderHook((p) => useMajoritySwap(p), {
      initialProps: props(positive, positions, vi.fn(), showNotice),
    });
    await drainTimers();
    expect(showNotice).toHaveBeenCalledTimes(1);

    // Still positive (another positive-leaning node added) — same decisive
    // side, so the effect's own prev-vs-current check should skip it.
    const stillPositive = [
      makeNode({ nodeId: "a", type: "Success" }),
      makeNode({ nodeId: "b", type: "Option" }),
    ];
    settle(rerender, props(stillPositive, positions, vi.fn(), showNotice));
    await drainTimers();
    expect(showNotice).toHaveBeenCalledTimes(1);
  });

  it("glides back to real stored positions and clears the overlay when the map swings back to a tie", async () => {
    const positions = new Map<string, Pt>([["a", { x: 100, y: 100 }]]);
    const showNotice = vi.fn();
    const tied = [makeNode({ nodeId: "a", type: "unknown" })];
    const { result, rerender } = renderHook((p) => useMajoritySwap(p), {
      initialProps: props(tied, positions, vi.fn(), showNotice),
    });

    const swungPositive = [makeNode({ nodeId: "a", type: "Success" })];
    settle(rerender, props(swungPositive, positions, vi.fn(), showNotice));
    await drainTimers();
    expect(result.current.majoritySwapState).not.toBeNull();

    settle(rerender, props(tied, positions, vi.fn(), showNotice));
    await drainTimers();
    expect(result.current.majoritySwapState).toBeNull();
  });

  it("cancelMajoritySwap immediately drops the overlay, preempting any in-flight animation", async () => {
    const positions = new Map<string, Pt>([["a", { x: 100, y: 100 }]]);
    const tied = [makeNode({ nodeId: "a", type: "unknown" })];
    const { result, rerender } = renderHook((p) => useMajoritySwap(p), {
      initialProps: props(tied, positions),
    });

    const swungPositive = [makeNode({ nodeId: "a", type: "Success" })];
    settle(rerender, props(swungPositive, positions));
    // Only partway through the animation — don't run every timer.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(result.current.majoritySwapState).not.toBeNull();

    act(() => {
      result.current.cancelMajoritySwap();
    });
    expect(result.current.majoritySwapState).toBeNull();

    // The in-flight animation's own token is now stale — letting its
    // remaining timers fire must not resurrect the overlay.
    await drainTimers();
    expect(result.current.majoritySwapState).toBeNull();
  });

  it("cancelMajoritySwap is a safe no-op when nothing is animating", () => {
    const positions = new Map<string, Pt>([["a", { x: 100, y: 100 }]]);
    const tied = [makeNode({ nodeId: "a", type: "unknown" })];
    const { result } = renderHook((p) => useMajoritySwap(p), { initialProps: props(tied, positions) });

    expect(() => act(() => result.current.cancelMajoritySwap())).not.toThrow();
    expect(result.current.majoritySwapState).toBeNull();
  });
});
