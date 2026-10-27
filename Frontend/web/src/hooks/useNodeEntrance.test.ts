import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useNodeEntrance } from "./useNodeEntrance";
import { APPEAR_MS, LEAD_MS, SKIP_MS, STAGGER_MS } from "../utils/nodeEntrance";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

function setup(nodes: NodeDoc[], zoneRootIds?: string[], mapId?: string) {
  const onNodeAppear = vi.fn();
  const onFinish = vi.fn();
  const root = document.createElement("div");
  root.innerHTML = nodes.map((n) => `<div data-reveal-node="${n.nodeId}"></div>`).join("");
  document.body.appendChild(root);
  const hook = renderHook(() => useNodeEntrance({ mapId, visibleNodes: nodes, zoneRootIds, canvasRef: { current: root }, onNodeAppear, onFinish }));
  const opacity = (id: string) => (root.querySelector(`[data-reveal-node="${id}"]`) as HTMLElement).style.opacity;
  return { ...hook, opacity, onNodeAppear, onFinish };
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
    localStorage.clear();
  });

  it("brings the nodes in one after another, in the order they were made, with the camera following, then steps back", () => {
    const { result, opacity, onNodeAppear, onFinish } = setup(mapNodes());
    expect(result.current.active).toBe(true);
    // Hidden from the very first frame, so nothing flashes in and out.
    expect(opacity("a")).toBe("0");
    expect(opacity("c")).toBe("0");

    act(() => vi.advanceTimersByTime(LEAD_MS + 100));
    expect(Number(opacity("a"))).toBeGreaterThan(0);
    expect(opacity("c")).toBe("0");
    expect(onNodeAppear.mock.calls.map((c) => c[0])).toEqual(["a"]);

    act(() => vi.advanceTimersByTime(STAGGER_MS));
    expect(onNodeAppear.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
    expect(onFinish).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(STAGGER_MS + APPEAR_MS));
    expect(result.current.active).toBe(false);
    expect(opacity("a")).toBe("");
    expect(opacity("c")).toBe("");
    expect(onNodeAppear.mock.calls.map((c) => c[0])).toEqual(["a", "b", "c"]);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("a click mid-entrance brings everything in fast, leaves the camera be, and it never plays again", () => {
    const { result, opacity, rerender, onNodeAppear, onFinish } = setup(mapNodes());
    act(() => vi.advanceTimersByTime(LEAD_MS + 50));
    act(() => result.current.skip());
    act(() => vi.advanceTimersByTime(SKIP_MS + 20));
    expect(result.current.active).toBe(false);
    expect(opacity("c")).toBe("");
    expect(onNodeAppear).toHaveBeenCalledTimes(1);
    expect(onFinish).not.toHaveBeenCalled();

    rerender();
    expect(result.current.active).toBe(false);
  });

  it("brings the nodes in first, then steps the camera back while the zones are drawn", () => {
    const onZonesStart = vi.fn();
    const root = document.createElement("div");
    root.innerHTML =
      mapNodes().map((n) => `<div data-reveal-node="${n.nodeId}"></div>`).join("") + `<svg><polygon data-reveal-zone="a"></polygon></svg>`;
    document.body.appendChild(root);
    const onNodeAppear = vi.fn();
    const zone = () => (root.querySelector("polygon") as SVGElement).style.opacity;
    renderHook(() =>
      useNodeEntrance({ visibleNodes: mapNodes(), zoneRootIds: ["a"], canvasRef: { current: root }, onNodeAppear, onZonesStart }),
    );
    act(() => vi.advanceTimersByTime(LEAD_MS + 2 * STAGGER_MS + 50));
    expect(onNodeAppear.mock.calls.map((c) => c[0])).toEqual(["a", "b", "c"]);
    expect(zone()).toBe("0");
    expect(onZonesStart).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(APPEAR_MS + 50));
    expect(onZonesStart).toHaveBeenCalledTimes(1);
    expect(onNodeAppear).toHaveBeenCalledTimes(3);
  });

  it("plays only the first time a map opens in this browser", () => {
    const first = setup(mapNodes(), undefined, "m1");
    expect(first.result.current.active).toBe(true);
    act(() => vi.advanceTimersByTime(5000));
    first.unmount();

    const again = setup(mapNodes(), undefined, "m1");
    expect(again.result.current.active).toBe(false);
    expect(again.opacity("a")).toBe("");

    const other = setup(mapNodes(), undefined, "m2");
    expect(other.result.current.active).toBe(true);
  });
});
