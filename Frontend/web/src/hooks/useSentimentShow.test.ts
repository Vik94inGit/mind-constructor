import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSentimentShow } from "./useSentimentShow";
import { BACK_AT_MS, BACK_MS, OUT_MS, SKIP_MS } from "../utils/sentimentShow";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

function setup(nodes: NodeDoc[], enabled?: boolean) {
  const root = document.createElement("div");
  root.innerHTML =
    nodes.map((n) => `<div data-reveal-node="${n.nodeId}"></div>`).join("") +
    `<svg><polygon data-reveal-points="${nodes.map((n) => n.nodeId).join(" ")}" data-base="${nodes
      .map((n) => `${n.x},${n.y}`)
      .join(" ")}" points="${nodes.map((n) => `${n.x},${n.y}`).join(" ")}"></polygon></svg>`;
  document.body.appendChild(root);
  const positions = new Map<string, Pt>(nodes.map((n) => [n.nodeId, { x: n.x!, y: n.y! }]));
  const showPoints = vi.fn();
  const showNotice = vi.fn();
  const hook = renderHook(() =>
    useSentimentShow({
      nodes,
      visibleNodes: nodes,
      positions,
      draftType: undefined,
      canvasRef: { current: root },
      showPoints,
      showNotice,
      positiveMajorityNotice: "POS",
      negativeMajorityNotice: "NEG",
      enabled,
    }),
  );
  const translate = (id: string) => (root.querySelector(`[data-reveal-node="${id}"]`) as HTMLElement).style.translate;
  const points = () => root.querySelector("polygon")!.getAttribute("points");
  return { ...hook, root, translate, points, showNotice };
}

// Two positive (majority) nodes and one negative (minority) node, all in one zone.
const mapNodes = () => [
  makeNode({ nodeId: "a", type: "Success", x: 900, y: 700 }),
  makeNode({ nodeId: "b", type: "Option", x: 300, y: 300 }),
  makeNode({ nodeId: "c", type: "Fail", x: 1500, y: 900 }),
];

describe("useSentimentShow", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("stays still on a Personal map: no show and no notice", () => {
    const { result, translate, showNotice } = setup(mapNodes(), false);
    act(() => {
      vi.advanceTimersByTime(OUT_MS);
    });
    expect(result.current.active).toBe(false);
    expect(showNotice).not.toHaveBeenCalled();
    expect(translate("a")).toBe("");
  });

  it("plays on open: nodes leave one after another, the zone stretches, and everything ends exactly home", () => {
    const { result, translate, points, showNotice } = setup(mapNodes());
    const start = points();
    expect(result.current.active).toBe(true);
    expect(showNotice).toHaveBeenCalledWith("POS");

    // "a" is nearest the center, so it sets off first; "b" hasn't yet.
    act(() => vi.advanceTimersByTime(60));
    expect(translate("a")).not.toBe("");
    expect(translate("b")).toBe("");

    act(() => vi.advanceTimersByTime(OUT_MS + 900));
    expect(translate("b")).not.toBe("");
    expect(translate("c")).not.toBe("");
    expect(points()).not.toBe(start); // the zone is stretched out

    // Still holding just before 4s…
    const held = translate("a");
    act(() => vi.advanceTimersByTime(BACK_AT_MS - (OUT_MS + 960) - 50));
    expect(translate("a")).toBe(held);

    // …and back home, in its original shape, once the last node lands.
    act(() => vi.advanceTimersByTime(50 + 900 + BACK_MS + 100));
    expect(result.current.active).toBe(false);
    expect(translate("a")).toBe("");
    expect(points()).toBe(start);
  });

  it("a click mid-show sends everything home fast", () => {
    const { result, translate, points } = setup(mapNodes());
    const start = points();
    act(() => vi.advanceTimersByTime(1500));
    expect(translate("a")).not.toBe("");

    act(() => result.current.skip());
    act(() => vi.advanceTimersByTime(SKIP_MS + 50));
    expect(result.current.active).toBe(false);
    expect(translate("a")).toBe("");
    expect(points()).toBe(start);

    // Nothing restarts afterwards.
    act(() => vi.advanceTimersByTime(BACK_AT_MS));
    expect(translate("a")).toBe("");
  });

  it("does nothing on a map with no majority", () => {
    const { result } = setup([
      makeNode({ nodeId: "a", type: "Success", x: 300, y: 300 }),
      makeNode({ nodeId: "b", type: "Fail", x: 900, y: 900 }),
    ]);
    expect(result.current.active).toBe(false);
  });
});
