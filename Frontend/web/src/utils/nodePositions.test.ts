import { describe, expect, it } from "vitest";
import { computeBasePositions } from "./nodePositions";
import { CANVAS_H, CANVAS_W, getNodeMinDist, spiralPoint } from "./canvasLayout";
import { makeNode } from "../test/fixtures";

describe("computeBasePositions", () => {
  it("keeps every node's own stored x/y untouched", () => {
    const nodes = [makeNode({ nodeId: "a", x: 123, y: 456 })];
    const positions = computeBasePositions(nodes);
    expect(positions.get("a")).toEqual({ x: 123, y: 456 });
  });

  it("places a lone position-less node on the sunflower spiral with nothing to avoid", () => {
    const nodes = [makeNode({ nodeId: "a", x: undefined, y: undefined })];
    const positions = computeBasePositions(nodes);
    const center = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    expect(positions.get("a")).toEqual(spiralPoint(0, center));
  });

  it("nudges a fresh node clear of an existing one that happens to sit on its own naive spiral spot", () => {
    const center = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    // Where the second regular node's own naive fallback spot would be
    // (index 1 — see computeBasePositions' own regular.forEach) — placed
    // here deliberately so the fix has something to actually avoid.
    const collision = spiralPoint(1, center);
    const nodes = [
      makeNode({ nodeId: "a", x: collision.x, y: collision.y }),
      makeNode({ nodeId: "b", x: undefined, y: undefined }),
    ];
    const positions = computeBasePositions(nodes);
    const a = positions.get("a")!;
    const b = positions.get("b")!;
    // Without the fix, b lands exactly on a (same spiralPoint(1, center)
    // call, blind to a's own stored position). With it, b is nudged clear
    // by at least the real spacing floor every other placement enforces.
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(getNodeMinDist() - 1);
  });

  it("keeps multiple position-less nodes clear of each other too, not just of stored ones", () => {
    const nodes = [
      makeNode({ nodeId: "a", x: undefined, y: undefined }),
      makeNode({ nodeId: "b", x: undefined, y: undefined }),
      makeNode({ nodeId: "c", x: undefined, y: undefined }),
    ];
    const positions = computeBasePositions(nodes);
    const pts = ["a", "b", "c"].map((id) => positions.get(id)!);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)).toBeGreaterThanOrEqual(getNodeMinDist() - 1);
      }
    }
  });
});
