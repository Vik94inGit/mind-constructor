import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMapReveal } from "./useMapReveal";
import { makeNode } from "../test/fixtures";

type Pt = { x: number; y: number };

const CANVAS_W = 2400;
const CANVAS_H = 1600;

// Same manual-RAF-capture technique useLineDrawing.test.ts already
// established for this codebase — the hook re-queues a new frame on every
// tick, so `advance` has to re-capture whatever's currently pending each
// time, not just invoke a single captured callback once.
function setupRaf() {
  let queued: FrameRequestCallback | null = null;
  let clockMs = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    queued = cb;
    return 1;
  });
  vi.spyOn(performance, "now").mockImplementation(() => clockMs);
  return {
    advance(stepMs: number) {
      clockMs += stepMs;
      const cb = queued;
      queued = null;
      cb?.(clockMs);
    },
  };
}

describe("useMapReveal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("never activates when every node is neutral", () => {
    setupRaf();
    const nodes = [makeNode({ nodeId: "a", type: "unknown", x: 100, y: 100 })];
    const positions = new Map<string, Pt>([["a", { x: 100, y: 100 }]]);
    const { result } = renderHook(() => useMapReveal(nodes, positions, CANVAS_W, CANVAS_H, 0));
    expect(result.current.active).toBe(false);
    expect(result.current.offsetFor("a")).toBeNull();
  });

  it("waits for real data instead of freezing on an empty first render", () => {
    // Regression test: MapPage calls this hook unconditionally, so its
    // first render(s) happen with an empty node list before the map's own
    // data has loaded — the reveal has to still fire once real nodes show
    // up on a later render, not lock in an empty snapshot forever.
    setupRaf();
    const positions = new Map<string, Pt>();
    const { result, rerender } = renderHook(
      ({ nodes, positions }: { nodes: ReturnType<typeof makeNode>[]; positions: Map<string, Pt> }) =>
        useMapReveal(nodes, positions, CANVAS_W, CANVAS_H, 0),
      { initialProps: { nodes: [] as ReturnType<typeof makeNode>[], positions } },
    );
    expect(result.current.active).toBe(false);

    const nodes = [makeNode({ nodeId: "a", type: "Success", x: 100, y: 100 })];
    const realPositions = new Map<string, Pt>([["a", { x: 100, y: 100 }]]);
    rerender({ nodes, positions: realPositions });

    expect(result.current.active).toBe(true);
  });

  it("pulls a positive node toward the canvas center and eases back to nothing", () => {
    const raf = setupRaf();
    const nodes = [makeNode({ nodeId: "a", type: "Success", x: 100, y: 100 })];
    const positions = new Map<string, Pt>([["a", { x: 100, y: 100 }]]);
    const { result } = renderHook(() => useMapReveal(nodes, positions, CANVAS_W, CANVAS_H, 0));
    expect(result.current.active).toBe(true);

    act(() => raf.advance(900)); // partway through the outward leg
    let offset = result.current.offsetFor("a");
    expect(offset).not.toBeNull();
    // Node at (100,100), center (1200,800) — center is up and to the right.
    expect(offset!.x).toBeGreaterThan(0);
    expect(offset!.y).toBeGreaterThan(0);

    act(() => raf.advance(6000)); // well past the whole cycle
    expect(result.current.active).toBe(false);
    expect(result.current.offsetFor("a")).toBeNull();
  });

  it("pushes a negative node toward the nearest canvas edge, not the center", () => {
    const raf = setupRaf();
    const nodes = [makeNode({ nodeId: "a", type: "Fail", x: 100, y: 800 })];
    const positions = new Map<string, Pt>([["a", { x: 100, y: 800 }]]);
    const { result } = renderHook(() => useMapReveal(nodes, positions, CANVAS_W, CANVAS_H, 0));

    act(() => raf.advance(900));
    const offset = result.current.offsetFor("a");
    expect(offset).not.toBeNull();
    // Node already left-of-center on the y-midline — away from center (x:1200,y:800) is further left (negative x), no vertical component.
    expect(offset!.x).toBeLessThan(0);
    expect(offset!.y).toBeCloseTo(0, 5);
  });

  it("a click mid-reveal snaps every offset back to zero well before the reveal's own natural return would", () => {
    const raf = setupRaf();
    const nodes = [makeNode({ nodeId: "a", type: "Success", x: 100, y: 100 })];
    const positions = new Map<string, Pt>([["a", { x: 100, y: 100 }]]);
    const { result, rerender } = renderHook(
      ({ skipTick }: { skipTick: number }) => useMapReveal(nodes, positions, CANVAS_W, CANVAS_H, skipTick),
      { initialProps: { skipTick: 0 } },
    );

    act(() => raf.advance(900)); // out on its own normal (slower) outward leg
    const beforeSkip = result.current.offsetFor("a")!;
    expect(beforeSkip.x).toBeGreaterThan(0);

    rerender({ skipTick: 1 }); // the click
    act(() => raf.advance(500)); // SKIP_RETURN_S (0.4s) has fully elapsed by now
    expect(result.current.active).toBe(false);
    expect(result.current.offsetFor("a")).toBeNull();
  });
});
