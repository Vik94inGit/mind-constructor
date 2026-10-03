import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMapViewerPrefs } from "./useMapViewerPrefs";
import { loadBlockLocks } from "../utils/blockLock";
import { loadCardFills } from "../utils/cardFill";
import { loadZoneDisplay } from "../utils/zoneDisplay";
import { loadReadingMode } from "../utils/readingMode";

describe("useMapViewerPrefs", () => {
  beforeEach(() => localStorage.clear());

  it("toggles a block lock on and off, writing it through per map", () => {
    const { result } = renderHook(() => useMapViewerPrefs("m1"));
    act(() => result.current.toggleBlockLock("n1"));
    expect(result.current.blockLocks).toEqual({ n1: true });
    expect(loadBlockLocks("m1")).toEqual({ n1: true });
    expect(loadBlockLocks("m2")).toEqual({});
    act(() => result.current.toggleBlockLock("n1"));
    expect(result.current.blockLocks).toEqual({});
    expect(loadBlockLocks("m1")).toEqual({});
  });

  it("sets and clears a card fill", () => {
    const { result } = renderHook(() => useMapViewerPrefs("m1"));
    act(() => result.current.setCardFill("n1", "#fde68a"));
    expect(loadCardFills("m1")).toEqual({ n1: "#fde68a" });
    act(() => result.current.setCardFill("n1", null));
    expect(result.current.cardFills).toEqual({});
  });

  it("stores the reading mode and zone display", () => {
    const { result } = renderHook(() => useMapViewerPrefs("m1"));
    act(() => result.current.storeReadingMode("puzzle"));
    expect(result.current.readingMode).toBe("puzzle");
    expect(loadReadingMode()).toBe("puzzle");
    act(() => result.current.storeZoneDisplay({ r1: "dots" }));
    expect(result.current.zoneDisplay).toEqual({ r1: "dots" });
    expect(loadZoneDisplay("m1")).toEqual({ r1: "dots" });
  });

  it("starts from what the browser already remembers", () => {
    const first = renderHook(() => useMapViewerPrefs("m1"));
    act(() => first.result.current.toggleBlockLock("n9"));
    const second = renderHook(() => useMapViewerPrefs("m1"));
    expect(second.result.current.blockLocks).toEqual({ n9: true });
  });
});
