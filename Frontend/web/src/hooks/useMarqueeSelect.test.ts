import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useMarqueeSelect } from "./useMarqueeSelect";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

function setup(disabled = false) {
  const nodes = [
    makeNode({ nodeId: "in" }),
    makeNode({ nodeId: "theirs", userId: "u2" }),
    makeNode({ nodeId: "weapon", isWeapon: true }),
    makeNode({ nodeId: "out" }),
  ];
  const positions = new Map([
    ["in", { x: 50, y: 50 }],
    ["theirs", { x: 60, y: 60 }],
    ["weapon", { x: 70, y: 70 }],
    ["out", { x: 500, y: 500 }],
  ]);
  const params = {
    disabled,
    screenToCanvas: (x: number, y: number) => ({ x, y }),
    nodes,
    positions,
    isOwnNode: (n: NodeDoc) => n.userId === "u1",
    suppressNextClick: { current: false },
    setMultiSelectIds: vi.fn(),
    setSelectedId: vi.fn(),
  };
  const { result } = renderHook(() => useMarqueeSelect(params));
  return { result, params };
}

function down(x: number, y: number, pointerType = "mouse") {
  const target = document.createElement("div");
  target.setPointerCapture = vi.fn();
  return { clientX: x, clientY: y, button: 0, pointerType, pointerId: 1, target } as unknown as ReactPointerEvent<HTMLDivElement>;
}

function move(x: number, y: number) {
  window.dispatchEvent(Object.assign(new Event("pointermove"), { clientX: x, clientY: y }));
}

describe("useMarqueeSelect", () => {
  it("selects your own non-weapon nodes inside the swept rectangle", () => {
    const { result, params } = setup();
    act(() => result.current.onCanvasPointerDown(down(0, 0)));
    act(() => move(100, 100));
    expect(result.current.marquee).toEqual({ x0: 0, y0: 0, x1: 100, y1: 100 });
    act(() => {
      window.dispatchEvent(new Event("pointerup"));
    });
    expect(result.current.marquee).toBeNull();
    expect(params.setMultiSelectIds).toHaveBeenCalledWith(new Set(["in"]));
    expect(params.setSelectedId).toHaveBeenCalledWith(null);
    expect(params.suppressNextClick.current).toBe(true);
  });

  it("treats a press with no drag as a plain click", () => {
    const { result, params } = setup();
    act(() => result.current.onCanvasPointerDown(down(0, 0)));
    act(() => {
      window.dispatchEvent(new Event("pointerup"));
    });
    expect(params.setMultiSelectIds).not.toHaveBeenCalled();
    expect(params.suppressNextClick.current).toBe(false);
  });

  it("leaves touch and a busy canvas alone", () => {
    const touch = setup();
    act(() => touch.result.current.onCanvasPointerDown(down(0, 0, "touch")));
    expect(touch.result.current.marquee).toBeNull();
    const busy = setup(true);
    act(() => busy.result.current.onCanvasPointerDown(down(0, 0)));
    expect(busy.result.current.marquee).toBeNull();
  });
});
