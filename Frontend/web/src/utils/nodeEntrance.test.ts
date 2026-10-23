import { describe, expect, it } from "vitest";
import { APPEAR_MS, appearAmount, applyEntranceFrame, computeEntranceDelays, entranceEndMs } from "./nodeEntrance";
import { makeNode } from "../test/fixtures";

describe("computeEntranceDelays", () => {
  it("brings nodes in the order they were made, oldest first", () => {
    const delays = computeEntranceDelays([
      makeNode({ nodeId: "late", createdAt: "2026-03-01T00:00:00Z" }),
      makeNode({ nodeId: "early", createdAt: "2026-01-01T00:00:00Z" }),
      makeNode({ nodeId: "mid", createdAt: "2026-02-01T00:00:00Z" }),
    ]);
    expect(delays.get("early")).toBe(0);
    expect(delays.get("mid")!).toBeGreaterThan(0);
    expect(delays.get("late")!).toBeGreaterThan(delays.get("mid")!);
  });

  it("keeps list order for nodes made at the same time or with no date", () => {
    const delays = computeEntranceDelays([makeNode({ nodeId: "a" }), makeNode({ nodeId: "b" })].map((n) => ({ ...n, createdAt: undefined })));
    expect(delays.get("a")).toBeLessThan(delays.get("b")!);
  });

  it("starts the last node within a bounded time however big the map is", () => {
    const many = Array.from({ length: 500 }, (_, i) => makeNode({ nodeId: `n${i}` }));
    expect(entranceEndMs(computeEntranceDelays(many))).toBeLessThanOrEqual(2200 + APPEAR_MS);
  });
});

describe("appearAmount", () => {
  it("is 0 before a node's turn, grows, and stays at 1 once it's in", () => {
    expect(appearAmount(100, 200)).toBe(0);
    const mid = appearAmount(200 + APPEAR_MS / 2, 200);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(appearAmount(200 + APPEAR_MS, 200)).toBe(1);
    expect(appearAmount(10_000, 200)).toBe(1);
  });
});

describe("applyEntranceFrame", () => {
  function canvas() {
    const root = document.createElement("div");
    root.innerHTML =
      `<div data-reveal-node="a"></div><div data-reveal-node="b"></div>` +
      `<svg><line data-reveal-line="a b"></line><polygon data-reveal-points="a b" opacity="0.5"></polygon>` +
      `<circle data-reveal-at="z"></circle></svg>`;
    return root;
  }
  const opacity = (root: HTMLElement, sel: string) => (root.querySelector(sel) as HTMLElement).style.opacity;

  it("fades and grows each node by its own amount and fills links and zones in as their nodes arrive", () => {
    const root = canvas();
    const amounts: Record<string, number> = { a: 1, b: 0 };
    applyEntranceFrame(root, (id) => amounts[id] ?? null);
    expect(opacity(root, '[data-reveal-node="a"]')).toBe("");
    expect(opacity(root, '[data-reveal-node="b"]')).toBe("0");
    expect((root.querySelector('[data-reveal-node="b"]') as HTMLElement).style.scale).toBe("0.6");
    // A link waits for both ends; a zone is half in once half its nodes are,
    // on top of its own dimmed opacity.
    expect(opacity(root, "line")).toBe("0");
    expect(opacity(root, "polygon")).toBe("0.25");
    // Something on a node that isn't part of the entrance is left alone.
    expect(opacity(root, "circle")).toBe("");
  });

  it("clears everything it set once called with no amounts", () => {
    const root = canvas();
    applyEntranceFrame(root, (id) => (id === "a" ? 0.5 : 0));
    applyEntranceFrame(root, () => null);
    root.querySelectorAll<HTMLElement>("[data-reveal-node], line, polygon").forEach((el) => {
      expect(el.style.opacity).toBe("");
      expect(el.style.scale ?? "").toBe("");
      expect(el.dataset.entranceBase).toBeUndefined();
    });
  });
});
