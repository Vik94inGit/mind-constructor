import { describe, expect, it } from "vitest";
import {
  PICTURES,
  FUN_PICTURE_KINDS,
  PICTURE_KINDS,
  TYPE_PICTURE_KINDS,
  isPictureKind,
  pictureForType,
  pictureNodeType,
  layoutPicture,
  overallPercent,
  pictureDots,
  pictureFills,
  pictureGroups,
  pictureSegments,
  resizePicture,
  pictureFitSize,
  pictureCardOffsets,
  drawingSpots,
  pictureSpots,
  pictureCenter,
} from "./pictures";
import { CANVAS_H, CANVAS_W } from "./canvasLayout";
import { makeNode } from "../test/fixtures";
import { NODE_TYPES } from "../types";
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

  it("has one picture for each node type, made of that type", () => {
    expect(TYPE_PICTURE_KINDS.map((k) => PICTURES[k].type).sort()).toEqual([...NODE_TYPES].sort());
    for (const type of NODE_TYPES) expect(pictureNodeType(pictureForType(type))).toBe(type);
    expect(pictureForType("Idea")).toBe("bulb");
    expect(pictureForType("Problem")).toBe("stop");
  });

  it("makes a picture for fun of Ideas", () => {
    for (const kind of FUN_PICTURE_KINDS) expect(pictureNodeType(kind)).toBe("Idea");
  });

  it("keeps every kind a valid Node.picture.kind (1-20 lowercase letters)", () => {
    for (const kind of PICTURE_KINDS) expect(kind).toMatch(/^[a-z]{1,20}$/);
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

describe("resizePicture", () => {
  const heart = pictureDots("heart", { x: 1200, y: 800 });

  it("grows the picture round its middle, keeping its shape", () => {
    const big = resizePicture(heart, 1.15)!;
    expect(big).not.toBeNull();
    const span = (pts: { x: number }[]) => Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
    expect(span(big) / span(heart)).toBeCloseTo(1.15, 1);
    const mid = (pts: { x: number }[]) => (Math.max(...pts.map((p) => p.x)) + Math.min(...pts.map((p) => p.x))) / 2;
    expect(Math.abs(mid(big) - mid(heart))).toBeLessThanOrEqual(1);
  });

  it("won't shrink a picture already at its smallest, where cards would touch", () => {
    expect(resizePicture(heart, 1 / 1.15)).toBeNull();
    expect(resizePicture(resizePicture(heart, 1.5)!, 1 / 1.15)).not.toBeNull();
  });

  it("won't grow past the canvas, and slides a grown picture back inside it", () => {
    expect(resizePicture(heart, 10)).toBeNull();
    const nearEdge = pictureDots("heart", { x: 450, y: 800 });
    for (const p of resizePicture(nearEdge, 1.3)!) {
      expect(p.x).toBeGreaterThanOrEqual(120);
      expect(p.x).toBeLessThanOrEqual(CANVAS_W - 120);
    }
  });
});

describe("a picture drawn on its own", () => {
  const span = (pts: { x: number; y: number }[]) => ({
    w: Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)),
    h: Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y)),
  });

  it.each(PICTURE_KINDS)("%s fits a phone and a desktop screen at 100%%", (kind) => {
    for (const view of [
      { w: 360, h: 640 },
      { w: 1280, h: 720 },
    ]) {
      const size = pictureFitSize(PICTURES[kind], view);
      const s = span(drawingSpots(PICTURES[kind], { x: 0, y: 0 }, size));
      expect(s.w).toBeLessThanOrEqual(view.w * 0.6 + 1);
      expect(s.h).toBeLessThanOrEqual(view.h * 0.6 + 1);
    }
  });

  it.each(PICTURE_KINDS)("%s lays its cards round the drawing, none touching another or the drawing", (kind) => {
    for (const view of [
      { w: 360, h: 640 },
      { w: 1280, h: 720 },
    ]) {
      const def = PICTURES[kind];
      const size = pictureFitSize(def, view);
      const cards = pictureCardOffsets(def, size);
      expect(cards).toHaveLength(def.dots.length);
      for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
          const clear = Math.abs(cards[i].x - cards[j].x) >= 170 || Math.abs(cards[i].y - cards[j].y) >= 110;
          expect(clear, `${kind} cards ${i} and ${j}`).toBe(true);
        }
      }
      const center = pictureCenter(cards);
      expect(Math.abs(center.x)).toBeLessThan(1);
      expect(Math.abs(center.y)).toBeLessThan(1);
      const d = span(drawingSpots(def, center, size));
      for (const c of cards) {
        expect(Math.abs(c.x) >= d.w / 2 + 74 || Math.abs(c.y) >= d.h / 2 + 45, `${kind} card on the drawing`).toBe(true);
      }
    }
  });

  it("draws the dots on the drawing, round the middle of the cards, and follows a whole move", () => {
    const size = 100;
    const cards = pictureCardOffsets(PICTURES.heart, size).map((p) => ({ x: p.x + 1800, y: p.y + 1200 }));
    const nodes = cards.map((c, i) => makeNode({ nodeId: `n${i}`, x: c.x, y: c.y, picture: { id: "p1", kind: "heart", dot: i, size } }));
    const [g] = pictureGroups(nodes);
    expect(g.size).toBe(size);
    const spots = pictureSpots(g, (n) => ({ x: n.x!, y: n.y! }));
    const expected = drawingSpots(PICTURES.heart, pictureCenter(cards), size)[0];
    expect(spots.get(0)!.x).toBeCloseTo(expected.x, 0);
    expect(spots.get(0)!.y).toBeCloseTo(expected.y, 0);
    // One card gone (deleted): the drawing stays where it was.
    const [partial] = pictureGroups(nodes.slice(1));
    const without = pictureSpots(partial, (n) => ({ x: n.x!, y: n.y! }));
    expect(without.get(3)!.x).toBeCloseTo(spots.get(3)!.x, 0);
    expect(without.get(3)!.y).toBeCloseTo(spots.get(3)!.y, 0);
    const moved = pictureSpots(g, (n) => ({ x: n.x! + 50, y: n.y! }));
    expect(moved.get(0)!.x - spots.get(0)!.x).toBeCloseTo(50);
  });

  it("keeps an older picture's lines on its cards", () => {
    const nodes = [0, 1].map((i) => makeNode({ nodeId: `n${i}`, x: 100 * i, y: 50, picture: { id: "p1", kind: "heart", dot: i } }));
    const [g] = pictureGroups(nodes);
    expect(g.size).toBeNull();
    expect(pictureSpots(g, (n) => ({ x: n.x!, y: n.y! })).get(1)).toEqual({ x: 100, y: 50 });
  });

  it("places a sized picture's cards on the canvas", () => {
    const size = pictureFitSize(PICTURES.smile, { w: 1280, h: 720 });
    const cards = layoutPicture("smile", { x: 1800, y: 1200 }, [], size);
    expect(cards).toHaveLength(PICTURES.smile.dots.length);
    for (const c of cards) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(CANVAS_W);
      expect(c.y).toBeLessThanOrEqual(CANVAS_H);
    }
  });
});
