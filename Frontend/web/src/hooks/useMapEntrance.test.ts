import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMapEntrance } from "./useMapEntrance";
import { makeNode } from "../test/fixtures";
import { markEntranceSeen } from "../utils/nodeEntrance";
import { rememberView } from "../utils/viewPrompt";
import type { ReadingMode } from "../utils/readingMode";

function setup(count: number, readingMode: ReadingMode = "actual", overviewOn = false) {
  const visibleNodes = Array.from({ length: count }, (_, i) => makeNode({ nodeId: `n${i}` }));
  const params = {
    mapId: "m1",
    loading: false,
    visibleNodes,
    unpackedCount: count,
    zoneRootIds: [],
    canvasRef: { current: null },
    readingMode,
    overviewOn,
    setOverview: vi.fn(),
    setReadingMode: vi.fn(),
  };
  const { result } = renderHook(() => useMapEntrance(params));
  return { result, params };
}

describe("useMapEntrance", () => {
  beforeEach(() => {
    localStorage.clear();
    markEntranceSeen("m1");
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("asks for a view once a big enough map has settled, and remembers the pick", () => {
    const { result, params } = setup(6);
    expect(result.current.viewPromptOpen).toBe(false);
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.viewPromptOpen).toBe(true);
    act(() => result.current.chooseView("cards"));
    expect(result.current.viewPromptOpen).toBe(false);
    expect(localStorage.getItem("mc_map_view")).toBe("cards");
    expect(params.setOverview).toHaveBeenCalledWith(false);
    expect(params.setReadingMode).toHaveBeenCalledWith("puzzle");
  });

  it("doesn't ask on a small map", () => {
    const { result } = setup(3);
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.viewPromptOpen).toBe(false);
  });

  it("opens in the view chosen before", () => {
    rememberView("overview");
    const { result, params } = setup(6, "puzzle");
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.viewPromptOpen).toBe(false);
    expect(params.setReadingMode).toHaveBeenCalledWith("mixed");
    expect(params.setOverview).toHaveBeenCalledWith(true);
  });

  it("closing the prompt keeps the current view as the answer", () => {
    const { result } = setup(6, "actual", true);
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.view).toBe("overview");
    act(() => result.current.closeViewPrompt());
    expect(result.current.viewPromptOpen).toBe(false);
    expect(localStorage.getItem("mc_map_view")).toBe("overview");
  });
});
