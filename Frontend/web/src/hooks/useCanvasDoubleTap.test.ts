import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { canvasDoubleTapAllowed, DOUBLE_TAP_MS, isDoubleTap, useCanvasDoubleTap } from "./useCanvasDoubleTap";

const tap = (x: number, y: number, t: number, target = "") => ({ x, y, t, target });

describe("isDoubleTap", () => {
  it("pairs two quick taps on the same spot", () => {
    expect(isDoubleTap(tap(100, 100, 0), tap(105, 98, 200))).toBe(true);
  });
  it("needs a first tap", () => {
    expect(isDoubleTap(null, tap(100, 100, 0))).toBe(false);
  });
  it("ignores a second tap that comes too late", () => {
    expect(isDoubleTap(tap(100, 100, 0), tap(100, 100, DOUBLE_TAP_MS + 1))).toBe(false);
  });
  it("ignores a second tap too far away", () => {
    expect(isDoubleTap(tap(100, 100, 0), tap(160, 100, 100))).toBe(false);
  });
  it("ignores taps on two different things", () => {
    expect(isDoubleTap(tap(100, 100, 0, "zoneA"), tap(100, 100, 100))).toBe(false);
  });
});

describe("useCanvasDoubleTap", () => {
  it("fires on the second tap, and a third starts a new pair", () => {
    const { result } = renderHook(() => useCanvasDoubleTap());
    expect(result.current.tap(tap(10, 10, 0))).toBe(false);
    expect(result.current.tap(tap(10, 10, 100))).toBe(true);
    expect(result.current.tap(tap(10, 10, 200))).toBe(false);
    expect(result.current.tap(tap(10, 10, 300))).toBe(true);
  });
  it("forgets the last tap on reset", () => {
    const { result } = renderHook(() => useCanvasDoubleTap());
    result.current.tap(tap(10, 10, 0));
    result.current.reset();
    expect(result.current.tap(tap(10, 10, 100))).toBe(false);
  });
});

describe("canvasDoubleTapAllowed", () => {
  it("is off in a mode, during the entrance and while replaying or presenting", () => {
    expect(canvasDoubleTapAllowed({ busyMode: false, entranceActive: false, canEdit: true })).toBe(true);
    expect(canvasDoubleTapAllowed({ busyMode: true, entranceActive: false, canEdit: true })).toBe(false);
    expect(canvasDoubleTapAllowed({ busyMode: false, entranceActive: true, canEdit: true })).toBe(false);
    expect(canvasDoubleTapAllowed({ busyMode: false, entranceActive: false, canEdit: false })).toBe(false);
  });
});
