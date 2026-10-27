import { describe, expect, it } from "vitest";
import { APPEAR_MS, appearAmount, hasSeenEntrance, LEAD_MS, markEntranceSeen, MAX_ENTRANCE_MS, MAX_SPREAD_MS, STAGGER_MS, ZONE_STAGGER_MS, zoneKey, applyEntranceFrame, computeEntranceDelays, entranceEndMs } from "./nodeEntrance";
import { makeNode } from "../test/fixtures";

describe("computeEntranceDelays", () => {
  it("brings nodes in the order they were made, oldest first", () => {
    const delays = computeEntranceDelays([
      makeNode({ nodeId: "late", createdAt: "2026-03-01T00:00:00Z" }),
      makeNode({ nodeId: "early", createdAt: "2026-01-01T00:00:00Z" }),
      makeNode({ nodeId: "mid", createdAt: "2026-02-01T00:00:00Z" }),
    ]);
    expect(delays.get("early")).toBe(LEAD_MS);
    // Unhurried: one thought at a time, like the map was written.
    expect(delays.get("mid")).toBe(LEAD_MS + STAGGER_MS);
    expect(delays.get("late")!).toBeGreaterThan(delays.get("mid")!);
  });

  it("brings every node in first, then draws the zones one by one in their parent's order", () => {
    const nodes = [
      makeNode({ nodeId: "kid", createdAt: "2026-01-03T00:00:00Z" }),
      makeNode({ nodeId: "castle", createdAt: "2026-01-02T00:00:00Z" }),
      makeNode({ nodeId: "king", createdAt: "2026-01-01T00:00:00Z" }),
    ];
    const delays = computeEntranceDelays(nodes, ["castle", "king"]);
    expect(Array.from(delays.keys())).toEqual(["king", "castle", "kid", zoneKey("king"), zoneKey("castle")]);
    expect(delays.get("king")).toBe(LEAD_MS);
    // The first zone waits for the last node to be fully in.
    expect(delays.get(zoneKey("king"))).toBe(delays.get("kid")! + APPEAR_MS);
    expect(delays.get(zoneKey("castle"))).toBe(delays.get("kid")! + APPEAR_MS + ZONE_STAGGER_MS);
  });

  it("keeps list order for nodes made at the same time or with no date", () => {
    const delays = computeEntranceDelays([makeNode({ nodeId: "a" }), makeNode({ nodeId: "b" })].map((n) => ({ ...n, createdAt: undefined })));
    expect(delays.get("a")).toBeLessThan(delays.get("b")!);
  });

  it("starts the last node within a bounded time however big the map is", () => {
    const many = Array.from({ length: 500 }, (_, i) => makeNode({ nodeId: `n${i}` }));
    expect(entranceEndMs(computeEntranceDelays(many))).toBeLessThanOrEqual(LEAD_MS + MAX_SPREAD_MS + APPEAR_MS);
  });

  it("is over within about two and a half seconds, zones included, however big the map is", () => {
    const many = Array.from({ length: 500 }, (_, i) => makeNode({ nodeId: `n${i}` }));
    const zones = many.slice(0, 80).map((n) => n.nodeId);
    const end = entranceEndMs(computeEntranceDelays(many, zones));
    expect(end).toBeLessThanOrEqual(MAX_ENTRANCE_MS);
    expect(MAX_ENTRANCE_MS).toBeLessThanOrEqual(2500);
  });
});

describe("hasSeenEntrance", () => {
  it("is remembered per map in this browser", () => {
    localStorage.clear();
    expect(hasSeenEntrance("m1")).toBe(false);
    markEntranceSeen("m1");
    expect(hasSeenEntrance("m1")).toBe(true);
    expect(hasSeenEntrance("m2")).toBe(false);
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

  it("brings a whole zone in at once, in its own turn, apart from its parent node", () => {
    const root = document.createElement("div");
    root.innerHTML =
      `<svg><g data-reveal-zone="p" opacity="0.5"><polygon></polygon></g>` +
      `<polygon data-reveal-zone="p"></polygon></svg><div data-reveal-node="kid"></div>`;
    applyEntranceFrame(root, (id) => (id === zoneKey("p") ? 0.5 : id === "kid" ? 0 : null));
    expect((root.querySelector("g") as SVGElement).style.opacity).toBe("0.25");
    expect((root.querySelector("svg > polygon") as SVGElement).style.opacity).toBe("0.5");
    expect((root.querySelector('[data-reveal-node="kid"]') as HTMLElement).style.opacity).toBe("0");
    applyEntranceFrame(root, () => null);
    expect((root.querySelector("g") as SVGElement).style.opacity).toBe("");
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
