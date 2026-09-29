import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { BACK_S, HOLD_UNTIL_MS, SKIP_S, useSentimentShow } from "./useSentimentShow";
import { computeNodeGroups } from "../utils/canvasLayout";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

function setup(nodes: NodeDoc[]) {
  const positions = new Map<string, Pt>(nodes.map((n) => [n.nodeId, { x: n.x!, y: n.y! }]));
  const nodeGroups = computeNodeGroups(nodes, nodes, positions);
  const showPoints = vi.fn();
  const showNotice = vi.fn();
  const hook = renderHook(() =>
    useSentimentShow({
      nodes,
      visibleNodes: nodes,
      positions,
      nodeGroups,
      draftType: undefined,
      showPoints,
      showNotice,
      positiveMajorityNotice: "POS",
      negativeMajorityNotice: "NEG",
    }),
  );
  return { ...hook, showPoints, showNotice };
}

const s = (style: object) => (style as Record<string, unknown>)["--reveal-s"];
const transition = (style: object) => String((style as Record<string, unknown>).transition);

describe("useSentimentShow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => setTimeout(() => cb(0), 16) as unknown as number);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => clearTimeout(id));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const mixed = () => [
    makeNode({ nodeId: "pos", type: "Success", x: 300, y: 300 }),
    makeNode({ nodeId: "pos2", type: "Option", x: 500, y: 1300 }),
    makeNode({ nodeId: "neg", type: "Fail", x: 1500, y: 900 }),
  ];

  it("plays on open: travels out, holds, starts back at 4s, and ends with nothing displaced", () => {
    const { result, showPoints } = setup(mixed());
    expect(result.current.active).toBe(true);
    expect(s(result.current.canvasStyle)).toBe(0); // prep: vectors in place, nothing moved yet
    expect(result.current.vectorFor("pos")).not.toBeNull();
    expect(showPoints).toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(40));
    expect(s(result.current.canvasStyle)).toBe(1);
    expect(transition(result.current.canvasStyle)).toContain("1.8s");

    act(() => vi.advanceTimersByTime(HOLD_UNTIL_MS - 200));
    expect(s(result.current.canvasStyle)).toBe(1); // still holding at the peak

    act(() => vi.advanceTimersByTime(300));
    expect(s(result.current.canvasStyle)).toBe(0);
    expect(transition(result.current.canvasStyle)).toContain(`${BACK_S}s`);
    expect(result.current.active).toBe(true);

    act(() => vi.advanceTimersByTime(BACK_S * 1000 + 100));
    expect(result.current.active).toBe(false);
    expect(result.current.vectorFor("pos")).toBeNull();
  });

  it("a click mid-show sends everything home fast and ends the show", () => {
    const { result } = setup(mixed());
    act(() => vi.advanceTimersByTime(500));
    expect(s(result.current.canvasStyle)).toBe(1);

    act(() => result.current.skip());
    expect(s(result.current.canvasStyle)).toBe(0);
    expect(transition(result.current.canvasStyle)).toContain(`${SKIP_S}s`);

    act(() => vi.advanceTimersByTime(SKIP_S * 1000 + 100));
    expect(result.current.active).toBe(false);
    expect(result.current.vectorFor("pos")).toBeNull();

    // The original "start back at 4s" timer must not fire afterwards.
    act(() => vi.advanceTimersByTime(HOLD_UNTIL_MS));
    expect(result.current.active).toBe(false);
  });

  it("does nothing on a map where no node has a sentiment", () => {
    const { result } = setup([makeNode({ nodeId: "a", type: "unknown", x: 300, y: 300 })]);
    expect(result.current.active).toBe(false);
    act(() => result.current.skip()); // harmless
    expect(result.current.active).toBe(false);
  });
});
