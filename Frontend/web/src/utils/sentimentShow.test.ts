import { describe, expect, it } from "vitest";
import {
  applyRevealFrame,
  BACK_AT_MS,
  BACK_MS,
  computeSentimentShowPlan,
  OUT_MS,
  revealAmount,
  segmentMatrix,
  showEndMs,
} from "./sentimentShow";
import { CANVAS_H, CANVAS_W } from "./canvasLayout";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };
const center = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function plan(nodes: NodeDoc[], majority: "positive" | "negative") {
  const positions = new Map<string, Pt>(nodes.map((n) => [n.nodeId, { x: n.x!, y: n.y! }]));
  const p = computeSentimentShowPlan(nodes, positions, majority);
  const target = (id: string) => {
    const base = positions.get(id)!;
    const v = p.vectors.get(id) ?? { x: 0, y: 0 };
    return { x: base.x + v.x, y: base.y + v.y };
  };
  return { ...p, positions, target };
}

describe("computeSentimentShowPlan", () => {
  const nodes = () => [
    makeNode({ nodeId: "pos", type: "Success", x: 300, y: 300 }),
    makeNode({ nodeId: "neg", type: "Fail", x: 1900, y: 1200 }),
    makeNode({ nodeId: "neu", type: "unknown", x: 300, y: 1300 }),
  ];

  it("sends the majority type to the center and the minority toward the edge", () => {
    const pos = plan(nodes(), "positive");
    expect(dist(pos.target("pos"), center)).toBeLessThan(dist(pos.positions.get("pos")!, center));
    expect(dist(pos.target("neg"), center)).toBeGreaterThan(dist(pos.positions.get("neg")!, center));

    // Same map, other majority: the roles swap.
    const neg = plan(nodes(), "negative");
    expect(dist(neg.target("neg"), center)).toBeLessThan(dist(neg.positions.get("neg")!, center));
    expect(dist(neg.target("pos"), center)).toBeGreaterThan(dist(neg.positions.get("pos")!, center));
  });

  it("leaves unknown-type nodes where they are", () => {
    expect(plan(nodes(), "positive").vectors.has("neu")).toBe(false);
  });

  it("moves each node on its own, so a zone's members can pull it apart", () => {
    const circle = [
      makeNode({ nodeId: "root", type: "Success", x: 400, y: 400 }),
      makeNode({ nodeId: "c1", type: "Success", parentId: "root", x: 550, y: 400 }),
      makeNode({ nodeId: "c2", type: "Fail", parentId: "root", x: 400, y: 550 }),
    ];
    const p = plan(circle, "positive");
    expect(p.vectors.get("root")).not.toEqual(p.vectors.get("c2"));
  });

  it("sends nodes off one after another, nearest the center first", () => {
    const p = plan(
      [
        makeNode({ nodeId: "far", type: "Success", x: 100, y: 100 }),
        makeNode({ nodeId: "near", type: "Success", x: 1000, y: 700 }),
        makeNode({ nodeId: "mid", type: "Success", x: 500, y: 400 }),
      ],
      "positive",
    );
    expect(p.delays.get("near")).toBe(0);
    expect(p.delays.get("mid")!).toBeGreaterThan(0);
    expect(p.delays.get("far")!).toBeGreaterThan(p.delays.get("mid")!);
  });

  it("keeps every node clear of every other at the peak — no stacking at the center", () => {
    const ring = Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return makeNode({ nodeId: `n${i}`, type: "Success", x: center.x + 600 * Math.cos(a), y: center.y + 500 * Math.sin(a) });
    });
    const p = plan(ring, "positive");
    for (let i = 0; i < ring.length; i++) {
      for (let j = i + 1; j < ring.length; j++) {
        expect(dist(p.target(`n${i}`), p.target(`n${j}`))).toBeGreaterThanOrEqual(177);
      }
    }
  });

  it("carries a weapon with its target — same vector, same departure", () => {
    const p = plan(
      [
        makeNode({ nodeId: "t", type: "Success", x: 400, y: 400 }),
        makeNode({ nodeId: "bow", type: "Fail", isWeapon: true, targetNodeId: "t", x: 550, y: 300 }),
      ],
      "positive",
    );
    expect(p.vectors.get("bow")).toEqual(p.vectors.get("t"));
    expect(p.delays.get("bow")).toEqual(p.delays.get("t"));
  });
});

describe("revealAmount", () => {
  it("waits for its own delay, travels out, holds, comes back from 4s, and ends exactly home", () => {
    const delay = 300;
    expect(revealAmount(200, delay)).toBe(0);
    expect(revealAmount(delay + OUT_MS / 2, delay)).toBeCloseTo(0.5, 5);
    expect(revealAmount(delay + OUT_MS + 10, delay)).toBe(1);
    expect(revealAmount(BACK_AT_MS - 1, delay)).toBe(1);
    expect(revealAmount(BACK_AT_MS + delay + BACK_MS / 2, delay)).toBeCloseTo(0.5, 5);
    expect(revealAmount(BACK_AT_MS + delay + BACK_MS, delay)).toBe(0);
  });

  it("finishes the whole show once the last node is home", () => {
    const end = showEndMs({ vectors: new Map(), delays: new Map([["a", 0], ["b", 700]]) });
    expect(end).toBe(BACK_AT_MS + 700 + BACK_MS);
  });
});

describe("segmentMatrix", () => {
  it("moves each end of a segment by its own node's displacement", () => {
    const a = { x: 100, y: 200 };
    const b = { x: 700, y: 500 };
    const da = { x: 300, y: 50 };
    const db = { x: -150, y: -220 };
    const [m0, m1, m2, m3, m4, m5] = segmentMatrix(a, da, b, db);
    const apply = (p: Pt) => ({ x: m0 * p.x + m2 * p.y + m4, y: m1 * p.x + m3 * p.y + m5 });
    expect(apply(a).x).toBeCloseTo(a.x + da.x, 6);
    expect(apply(a).y).toBeCloseTo(a.y + da.y, 6);
    expect(apply(b).x).toBeCloseTo(b.x + db.x, 6);
    expect(apply(b).y).toBeCloseTo(b.y + db.y, 6);
  });
});

describe("applyRevealFrame", () => {
  function canvas() {
    const root = document.createElement("div");
    root.innerHTML = `
      <div data-reveal-node="a"></div>
      <svg>
        <polygon data-reveal-points="a b c" data-base="0,0 100,0 0,100" points="0,0 100,0 0,100"></polygon>
        <line data-reveal-line="a b" data-base="0 0 100 0" x1="0" y1="0" x2="100" y2="0"></line>
        <circle data-reveal-at="c" data-base="0 100" cx="0" cy="100"></circle>
      </svg>`;
    return root;
  }

  it("stretches a zone and its links with each node's own displacement", () => {
    const root = canvas();
    const moves: Record<string, Pt> = { a: { x: 10, y: 20 }, c: { x: -5, y: 0 } };
    applyRevealFrame(root, (id) => moves[id] ?? null);
    expect((root.querySelector("[data-reveal-node]") as HTMLElement).style.translate).toBe("10px 20px");
    expect(root.querySelector("polygon")!.getAttribute("points")).toBe("10,20 100,0 -5,100");
    const line = root.querySelector("line")!;
    expect([line.getAttribute("x1"), line.getAttribute("y1"), line.getAttribute("x2")]).toEqual(["10", "20", "100"]);
    expect(root.querySelector("circle")!.getAttribute("cx")).toBe("-5");
  });

  it("writes every real position back exactly once nothing is displaced", () => {
    const root = canvas();
    applyRevealFrame(root, () => ({ x: 33, y: 44 }));
    applyRevealFrame(root, () => null);
    expect((root.querySelector("[data-reveal-node]") as HTMLElement).style.translate).toBe("");
    expect(root.querySelector("polygon")!.getAttribute("points")).toBe("0,0 100,0 0,100");
    expect(root.querySelector("line")!.getAttribute("x2")).toBe("100");
    expect(root.querySelector("circle")!.getAttribute("cy")).toBe("100");
  });
});
