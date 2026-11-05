import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PointerEvent as ReactPointerEvent } from "react";
import { CANVAS_HOLD_MS, canvasHoldAllowed, useCanvasHoldMenu } from "./useCanvasHoldMenu";

const press = { clientX: 100, clientY: 200, pointerId: 1 } as unknown as ReactPointerEvent;

function pointer(type: string, init: { pointerId: number; clientX?: number; clientY?: number }) {
  const ev = new Event(type) as Event & { pointerId: number; clientX: number; clientY: number };
  Object.assign(ev, { clientX: 100, clientY: 200, ...init });
  window.dispatchEvent(ev);
}

describe("canvasHoldAllowed", () => {
  const idle = { pointerType: "touch", busyMode: false, entranceActive: false, canEdit: true };
  it("allows a finger or pen", () => {
    expect(canvasHoldAllowed(idle)).toBe(true);
    expect(canvasHoldAllowed({ ...idle, pointerType: "pen" })).toBe(true);
  });
  it("leaves a mouse to its right-click, and stays out of modes, the entrance and replays", () => {
    expect(canvasHoldAllowed({ ...idle, pointerType: "mouse" })).toBe(false);
    expect(canvasHoldAllowed({ ...idle, busyMode: true })).toBe(false);
    expect(canvasHoldAllowed({ ...idle, entranceActive: true })).toBe(false);
    expect(canvasHoldAllowed({ ...idle, canEdit: false })).toBe(false);
  });
});

describe("useCanvasHoldMenu", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("opens the menu once the finger has stayed still long enough", () => {
    const onHold = vi.fn();
    const { result } = renderHook(() => useCanvasHoldMenu(onHold));
    act(() => result.current.start(press, true));
    act(() => vi.advanceTimersByTime(CANVAS_HOLD_MS - 50));
    expect(onHold).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(60));
    expect(onHold).toHaveBeenCalledWith(100, 200);
    expect(result.current.swallowClick()).toBe(true);
  });

  it("does nothing for a quick tap", () => {
    const onHold = vi.fn();
    const { result } = renderHook(() => useCanvasHoldMenu(onHold));
    act(() => result.current.start(press, true));
    act(() => pointer("pointerup", { pointerId: 1 }));
    act(() => vi.advanceTimersByTime(CANVAS_HOLD_MS * 2));
    expect(onHold).not.toHaveBeenCalled();
    expect(result.current.swallowClick()).toBe(false);
  });

  it("gives way to a pan or a pinch", () => {
    const onHold = vi.fn();
    const { result } = renderHook(() => useCanvasHoldMenu(onHold));
    act(() => result.current.start(press, true));
    act(() => pointer("pointermove", { pointerId: 1, clientX: 130 }));
    act(() => vi.advanceTimersByTime(CANVAS_HOLD_MS * 2));
    act(() => result.current.start(press, true));
    act(() => pointer("pointerdown", { pointerId: 2 }));
    act(() => vi.advanceTimersByTime(CANVAS_HOLD_MS * 2));
    expect(onHold).not.toHaveBeenCalled();
  });

  it("never starts when not allowed", () => {
    const onHold = vi.fn();
    const { result } = renderHook(() => useCanvasHoldMenu(onHold));
    act(() => result.current.start(press, false));
    act(() => vi.advanceTimersByTime(CANVAS_HOLD_MS * 2));
    expect(onHold).not.toHaveBeenCalled();
  });
});
