import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVisualViewportOffset } from "./useVisualViewportOffset";

class FakeViewport extends EventTarget {
  height = 800;
  scale = 1;
  offsetTop = 0;
  offsetLeft = 0;
  pageTop = 0;
  pageLeft = 0;
}

describe("useVisualViewportOffset", () => {
  let vv: FakeViewport;
  const original = Object.getOwnPropertyDescriptor(window, "visualViewport");

  beforeEach(() => {
    vv = new FakeViewport();
    Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  });

  afterEach(() => {
    if (original) Object.defineProperty(window, "visualViewport", original);
    else delete (window as { visualViewport?: unknown }).visualViewport;
    vi.restoreAllMocks();
  });

  it("follows the keyboard's slide of the visible page", () => {
    const { result } = renderHook(() => useVisualViewportOffset());
    expect(result.current).toEqual({ top: 0, left: 0 });

    act(() => {
      vv.height = 450;
      vv.offsetTop = vv.pageTop = 300;
      vv.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toEqual({ top: 300, left: 0 });

    act(() => {
      vv.height = 800;
      vv.offsetTop = vv.pageTop = 0;
      vv.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toEqual({ top: 0, left: 0 });
  });

  it("puts a page left scrolled back at the top once the keyboard is gone", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    Object.defineProperty(window, "scrollY", { configurable: true, value: 120 });
    renderHook(() => useVisualViewportOffset());
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });

  it("leaves the page alone while a field is being typed in", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const field = document.createElement("textarea");
    document.body.appendChild(field);
    field.focus();
    Object.defineProperty(window, "scrollY", { configurable: true, value: 120 });
    renderHook(() => useVisualViewportOffset());
    expect(scrollTo).not.toHaveBeenCalled();
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    field.remove();
  });

  it("puts the page back once the field loses focus (closing the node panel on an iPad)", () => {
    vi.useFakeTimers();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const field = document.createElement("textarea");
    document.body.appendChild(field);
    field.focus();
    renderHook(() => useVisualViewportOffset());
    Object.defineProperty(window, "scrollY", { configurable: true, value: 300 });
    field.blur();
    field.remove();
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
    vi.useRealTimers();
  });

  it("follows a scroll of the page itself, which the visual viewport doesn't report", () => {
    const field = document.createElement("textarea");
    document.body.appendChild(field);
    field.focus();
    const { result } = renderHook(() => useVisualViewportOffset());
    act(() => {
      vv.pageTop = 200;
      window.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.top).toBe(200);
    field.remove();
  });
});
