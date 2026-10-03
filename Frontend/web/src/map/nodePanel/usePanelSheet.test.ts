import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { usePanelSheet } from "./usePanelSheet";

function pointerDown(clientX: number, clientY: number) {
  const target = document.createElement("div");
  target.setPointerCapture = vi.fn();
  return { clientX, clientY, pointerId: 1, target, stopPropagation: vi.fn() } as unknown as ReactPointerEvent;
}

function move(clientX: number, clientY: number) {
  window.dispatchEvent(Object.assign(new Event("pointermove"), { clientX, clientY }));
}

function setup() {
  return renderHook(() => usePanelSheet({ textareaRef: { current: null }, readonlyTextRef: { current: null } }));
}

describe("usePanelSheet", () => {
  beforeEach(() => localStorage.clear());

  it("grows the sheet when its top edge is dragged up, and remembers the size", () => {
    const { result } = setup();
    expect(result.current.panelHeight).toBeNull();
    act(() => result.current.onResizeHandlePointerDown(pointerDown(0, 500)));
    act(() => move(0, 400));
    act(() => {
      window.dispatchEvent(new Event("pointerup"));
    });
    // No panel measured yet, so it starts from the 200px minimum.
    expect(result.current.panelHeight).toBe(300);
    expect(localStorage.getItem("mc_node_panel_height_px")).toBe("300");
    expect(setup().result.current.panelHeight).toBe(300);
  });

  it("never shrinks below the minimum", () => {
    const { result } = setup();
    act(() => result.current.onResizeHandlePointerDown(pointerDown(0, 500)));
    act(() => move(0, 900));
    expect(result.current.panelHeight).toBe(200);
  });

  it("moves the sheet with the grip, and the panel can reset it", () => {
    const { result } = setup();
    const panel = document.createElement("div");
    Object.defineProperty(panel, "offsetWidth", { value: 400 });
    Object.defineProperty(panel, "offsetHeight", { value: 300 });
    (result.current.panelRef as { current: HTMLDivElement | null }).current = panel;
    act(() => result.current.onGripPointerDown(pointerDown(100, 100)));
    act(() => move(130, 80));
    act(() => {
      window.dispatchEvent(new Event("pointerup"));
    });
    expect(result.current.dragOffset).toEqual({ x: 30, y: -20 });
    act(() => result.current.setDragOffset({ x: 0, y: 0 }));
    expect(result.current.dragOffset).toEqual({ x: 0, y: 0 });
  });

  it("keeps a strip of the sheet on screen however far it's dragged", () => {
    const { result } = setup();
    const panel = document.createElement("div");
    Object.defineProperty(panel, "offsetWidth", { value: 400 });
    Object.defineProperty(panel, "offsetHeight", { value: 300 });
    (result.current.panelRef as { current: HTMLDivElement | null }).current = panel;
    act(() => result.current.onGripPointerDown(pointerDown(100, 100)));
    act(() => move(-5000, 5000));
    expect(result.current.dragOffset).toEqual({ x: 48 - 400, y: window.innerHeight - 48 - (window.innerHeight - 300) });
  });
});
