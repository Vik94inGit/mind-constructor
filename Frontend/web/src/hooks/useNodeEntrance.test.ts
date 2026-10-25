import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useNodeEntrance } from "./useNodeEntrance";
import { APPEAR_MS, SKIP_MS } from "../utils/nodeEntrance";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

function setup(nodes: NodeDoc[]) {
  const root = document.createElement("div");
  root.innerHTML = nodes.map((n) => `<div data-reveal-node="${n.nodeId}"></div>`).join("");
  document.body.appendChild(root);
  const hook = renderHook(() => useNodeEntrance({ visibleNodes: nodes, canvasRef: { current: root } }));
  const opacity = (id: string) => (root.querySelector(`[data-reveal-node="${id}"]`) as HTMLElement).style.opacity;
  return { ...hook, opacity };
}

const mapNodes = () => [
  makeNode({ nodeId: "a", createdAt: "2026-01-01T00:00:00Z" }),
  makeNode({ nodeId: "b", createdAt: "2026-01-02T00:00:00Z" }),
  makeNode({ nodeId: "c", createdAt: "2026-01-03T00:00:00Z" }),
];

describe("useNodeEntrance", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("brings the nodes in one after another, in the order they were made, and then gets out of the way", () => {
    const { result, opacity } = setup(mapNodes());
    expect(result.current.active).toBe(true);
    // Hidden from the very first frame, so nothing flashes in and out.
    expect(opacity("c")).toBe("0");

    act(() => vi.advanceTimersByTime(100));
    expect(Number(opacity("a"))).toBeGreaterThan(0);
    expect(opacity("c")).toBe("0");

    act(() => vi.advanceTimersByTime(2 * 180 + APPEAR_MS));
    expect(result.current.active).toBe(false);
    expect(opacity("a")).toBe("");
    expect(opacity("c")).toBe("");
  });

  it("a click mid-entrance brings everything in fast, and it never plays again", () => {
    const { result, opacity, rerender } = setup(mapNodes());
    act(() => vi.advanceTimersByTime(50));
    act(() => result.current.skip());
    act(() => vi.advanceTimersByTime(SKIP_MS + 20));
    expect(result.current.active).toBe(false);
    expect(opacity("c")).toBe("");

    rerender();
    expect(result.current.active).toBe(false);
  });
});
