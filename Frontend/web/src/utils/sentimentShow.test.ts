import { describe, expect, it } from "vitest";
import { computeSentimentShowVectors, revealSegmentStyle } from "./sentimentShow";
import { CANVAS_H, CANVAS_W, computeNodeGroups } from "./canvasLayout";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };
const center = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function run(nodes: NodeDoc[]) {
  const positions = new Map<string, Pt>(nodes.map((n) => [n.nodeId, { x: n.x!, y: n.y! }]));
  const groups = computeNodeGroups(nodes, nodes, positions);
  const vectors = computeSentimentShowVectors(nodes, positions, groups);
  const target = (id: string) => {
    const p = positions.get(id)!;
    const v = vectors.get(id) ?? { x: 0, y: 0 };
    return { x: p.x + v.x, y: p.y + v.y };
  };
  return { positions, vectors, target };
}

// Evaluates the CSS matrix() produced by revealSegmentStyle at a given
// value of the animated number, then applies it to a point.
function applyAt(style: ReturnType<typeof revealSegmentStyle>, sv: number, p: Pt): Pt {
  const expr = String(style!.transform).split("var(--reveal-s, 0)").join(String(sv));
  const fn = expr.slice(0, expr.indexOf("("));
  const inner = expr.slice(fn.length + 1, -1).split("px").join("").split("calc").join("");
  const args = new Function(`return [${inner}]`)() as number[];
  if (fn === "translate") return { x: p.x + args[0], y: p.y + args[1] };
  const [a, b, c, d, e, f] = args;
  return { x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f };
}

describe("computeSentimentShowVectors", () => {
  it("pulls a positive node toward the center, pushes a negative one toward the edge, leaves a neutral one alone", () => {
    const pos = makeNode({ nodeId: "pos", type: "Success", x: 300, y: 300 });
    const neg = makeNode({ nodeId: "neg", type: "Fail", x: 1900, y: 1200 });
    const neu = makeNode({ nodeId: "neu", type: "unknown", x: 300, y: 1300 });
    const { positions, vectors, target } = run([pos, neg, neu]);
    expect(dist(target("pos"), center)).toBeLessThan(dist(positions.get("pos")!, center));
    expect(dist(target("neg"), center)).toBeGreaterThan(dist(positions.get("neg")!, center));
    expect(vectors.has("neu")).toBe(false);
  });

  it("keeps every body clear of every other at the peak — no stacking at the center", () => {
    // A ring of positive nodes all converging on the center used to pile up.
    const nodes = Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return makeNode({ nodeId: `n${i}`, type: "Success", x: center.x + 600 * Math.cos(a), y: center.y + 500 * Math.sin(a) });
    });
    const { target } = run(nodes);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        // Two lone nodes: NODE_PAD (90) each plus GAP (40).
        expect(dist(target(`n${i}`), target(`n${j}`))).toBeGreaterThanOrEqual(219);
      }
    }
  });

  it("moves a whole circle rigidly — every member shares one vector, so its zone keeps its shape", () => {
    const nodes = [
      makeNode({ nodeId: "root", type: "Success", x: 400, y: 400 }),
      makeNode({ nodeId: "c1", type: "Success", parentId: "root", x: 550, y: 400 }),
      makeNode({ nodeId: "c2", type: "Option", parentId: "root", x: 400, y: 550 }),
    ];
    const { vectors } = run(nodes);
    const v = vectors.get("root")!;
    expect(v).toBeDefined();
    expect(vectors.get("c1")).toEqual(v);
    expect(vectors.get("c2")).toEqual(v);
  });

  it("merges a nested circle into its parent circle's body, and carries a weapon with its target", () => {
    const nodes = [
      makeNode({ nodeId: "outer", type: "Success", x: 400, y: 400 }),
      makeNode({ nodeId: "inner", type: "Success", parentId: "outer", x: 550, y: 400 }),
      makeNode({ nodeId: "o2", type: "Option", parentId: "outer", x: 400, y: 550 }),
      makeNode({ nodeId: "i1", type: "Success", parentId: "inner", x: 700, y: 400 }),
      makeNode({ nodeId: "i2", type: "Success", parentId: "inner", x: 700, y: 550 }),
      makeNode({ nodeId: "bow", type: "Fail", isWeapon: true, targetNodeId: "i1", x: 850, y: 300 }),
    ];
    const { vectors } = run(nodes);
    const v = vectors.get("outer")!;
    for (const id of ["inner", "o2", "i1", "i2", "bow"]) expect(vectors.get(id)).toEqual(v);
  });
});

describe("revealSegmentStyle", () => {
  it("keeps both ends of a link glued to their own moving nodes at every point of the show", () => {
    const a = { x: 100, y: 200 };
    const b = { x: 700, y: 500 };
    const va = { x: 300, y: 50 };
    const vb = { x: -150, y: -220 };
    const style = revealSegmentStyle(a, va, b, vb);
    for (const sv of [0, 0.25, 0.5, 1]) {
      const pa = applyAt(style, sv, a);
      const pb = applyAt(style, sv, b);
      expect(pa.x).toBeCloseTo(a.x + sv * va.x, 1);
      expect(pa.y).toBeCloseTo(a.y + sv * va.y, 1);
      expect(pb.x).toBeCloseTo(b.x + sv * vb.x, 1);
      expect(pb.y).toBeCloseTo(b.y + sv * vb.y, 1);
    }
  });

  it("is a plain translate when both ends move together", () => {
    const style = revealSegmentStyle({ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 50, y: 50 }, { x: 10, y: 20 });
    expect(String(style!.transform).startsWith("translate(")).toBe(true);
  });

  it("returns nothing when neither end moves", () => {
    expect(revealSegmentStyle({ x: 0, y: 0 }, null, { x: 50, y: 50 }, null)).toBeUndefined();
  });
});
