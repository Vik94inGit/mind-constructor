import { describe, expect, it } from "vitest";
import {
  PICTURES,
  PICTURE_KINDS,
  isPictureKind,
  layoutPicture,
  overallPercent,
  pictureDots,
  pictureFills,
  pictureGroups,
  pictureSegments,
} from "./pictures";
import { CANVAS_H, CANVAS_W } from "./canvasLayout";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

function dotNode(id: string, dot: number, written: boolean, kind = "tree", pictureId = "p1"): NodeDoc {
  return makeNode({ nodeId: id, ghost: !written, text: written ? "x" : "", picture: { id: pictureId, kind, dot } });
}

describe("PICTURES", () => {
  it.each(PICTURE_KINDS)("%s only joins dots it has, and fits Node.picture.dot", (kind) => {
    const def = PICTURES[kind];
    expect(def.dots.length).toBeLessThanOrEqual(64);
    for (const path of def.paths) {
      expect(path.length).toBeGreaterThanOrEqual(2);
      for (const i of path) expect(i).toBeLessThan(def.dots.length);
    }
  });

  it.each(PICTURE_KINDS)("%s is drawn big enough that no two dots' cards overlap", (kind) => {
    const dots = pictureDots(kind, { x: 0, y: 0 });
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const clear = Math.abs(dots[i].x - dots[j].x) >= 170 || Math.abs(dots[i].y - dots[j].y) >= 110;
        expect(clear, `${kind} dots ${i} and ${j}`).toBe(true);
      }
    }
  });

  it("knows its own kinds only", () => {
    expect(isPictureKind("heart")).toBe(true);
    expect(isPictureKind("dragon")).toBe(false);
    expect(isPictureKind(undefined)).toBe(false);
  });
});

describe("layoutPicture", () => {
  it("centers the picture on the asked spot when it is free, unbent", () => {
    const dots = layoutPicture("heart", { x: 1200, y: 800 });
    expect(dots).toEqual(pictureDots("heart", { x: 1200, y: 800 }));
  });

  it("keeps the whole picture on the canvas near an edge", () => {
    const dots = layoutPicture("smile", { x: 0, y: CANVAS_H });
    for (const p of dots) {
      expect(p.x).toBeGreaterThanOrEqual(120);
      expect(p.x).toBeLessThanOrEqual(CANVAS_W - 120);
      expect(p.y).toBeGreaterThanOrEqual(120);
      expect(p.y).toBeLessThanOrEqual(CANVAS_H - 120);
    }
  });

  it("moves the picture off what is already on the map, keeping its shape", () => {
    const blocker = { x: 1200, y: 800, minDist: 200 };
    const dots = layoutPicture("star", { x: 1200, y: 800 }, [blocker]);
    for (const p of dots) expect(Math.hypot(p.x - blocker.x, p.y - blocker.y)).toBeGreaterThanOrEqual(200);
    const unit = pictureDots("star", { x: 0, y: 0 });
    const dx = dots[0].x - unit[0].x;
    const dy = dots[0].y - unit[0].y;
    dots.forEach((p, i) => {
      expect(Math.abs(p.x - (unit[i].x + dx))).toBeLessThanOrEqual(1);
      expect(Math.abs(p.y - (unit[i].y + dy))).toBeLessThanOrEqual(1);
    });
  });
});

describe("layoutPicture on a full map", () => {
  it("lands where the fewest dots cover something, not on top of what is there", () => {
    // Everything blocked except a band along the bottom: no clear spot exists.
    const obstacles: { x: number; y: number; minDist: number }[] = [];
    for (let x = 0; x <= CANVAS_W; x += 100) for (let y = 0; y <= CANVAS_H - 500; y += 100) obstacles.push({ x, y, minDist: 60 });
    const dots = layoutPicture("house", { x: 1200, y: 300 }, obstacles);
    const covered = (pts: { x: number; y: number }[]) =>
      pts.filter((p) => obstacles.some((o) => Math.hypot(p.x - o.x, p.y - o.y) < o.minDist)).length;
    expect(covered(dots)).toBeLessThan(covered(pictureDots("house", { x: 1200, y: 520 })));
  });
});

describe("pictureGroups", () => {
  it("counts how much of each picture is drawn", () => {
    const nodes = [
      dotNode("a", 0, true),
      dotNode("b", 1, true),
      dotNode("c", 2, false),
      dotNode("d", 0, false, "heart", "p2"),
      makeNode({ nodeId: "plain" }),
      makeNode({ nodeId: "odd", picture: { id: "p3", kind: "dragon", dot: 0 } }),
    ];
    const groups = pictureGroups(nodes);
    expect(groups.map((g) => [g.id, g.kind, g.filled, g.total, g.percent])).toEqual([
      ["p1", "tree", 2, 7, 29],
      ["p2", "heart", 0, 10, 0],
    ]);
    expect(overallPercent(groups)).toBe(12);
    expect(overallPercent([])).toBeNull();
  });

  it("inks a line only once both of its dots are written in, and skips lines to deleted dots", () => {
    // Tree: one closed path 0-1-2-3-4-5-6-0; dot 4 deleted.
    const nodes = [0, 1, 2, 3, 5, 6].map((d) => dotNode(`n${d}`, d, d <= 2));
    const [g] = pictureGroups(nodes);
    const segs = pictureSegments(g);
    expect(segs.map((s) => [s.from.nodeId, s.to.nodeId, s.drawn])).toEqual([
      ["n0", "n1", true],
      ["n1", "n2", true],
      ["n2", "n3", false],
      ["n5", "n6", false],
      ["n6", "n0", false],
    ]);
    // A shape with a dot missing has no fill.
    expect(pictureFills(g)).toEqual([]);
  });

  it("fills a closed shape whose dots are all there", () => {
    const nodes = PICTURES.tree.dots.map((_, d) => dotNode(`n${d}`, d, true));
    const [g] = pictureGroups(nodes);
    expect(g.percent).toBe(100);
    expect(pictureFills(g)).toHaveLength(1);
    expect(pictureFills(g)[0].map((n) => n.nodeId)).toEqual(["n0", "n1", "n2", "n3", "n4", "n5", "n6"]);
  });
});
