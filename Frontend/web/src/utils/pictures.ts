import { CANVAS_H, CANVAS_W } from "./canvasLayout";
import type { Obstacle } from "./canvasLayout";
import { clearOf } from "./freeSpots";
import type { NodeDoc } from "../types";

// "Draw a picture": a picture laid out on the map as ghost nodes, one per
// dot, like a connect-the-dots page. Each dot's line to its neighbours is
// drawn once both ends are written in, so the picture fills in as the user
// answers its ghosts, and how much of it is drawn (on the canvas and on the
// minimap) shows how far along they are. A node knows which dot it is
// through Node.picture ({ id, kind, dot }); everything else about a picture
// lives here.

type Pt = { x: number; y: number };

export const PICTURE_KINDS = ["heart", "star", "house", "tree", "fish", "smile"] as const;
export type PictureKind = (typeof PICTURE_KINDS)[number];

export interface PictureDef {
  /** Each dot, in units round the picture's middle (screen y grows downward). */
  dots: Pt[];
  /** Lines through the dots, by index. A path that ends where it starts is closed and gets a fill. */
  paths: number[][];
  /** The ink the drawn lines take. */
  color: string;
}

function ring(count: number, radius: number, startDeg: number): Pt[] {
  return Array.from({ length: count }, (_, i) => {
    const a = ((startDeg + (i * 360) / count) * Math.PI) / 180;
    return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
  });
}

const loop = (count: number, from = 0) => [...Array.from({ length: count }, (_, i) => from + i), from];

export const PICTURES: Record<PictureKind, PictureDef> = {
  heart: {
    dots: [
      { x: 0, y: -0.45 },
      { x: 0.4, y: -0.9 },
      { x: 0.95, y: -0.7 },
      { x: 1, y: -0.1 },
      { x: 0.55, y: 0.45 },
      { x: 0, y: 1 },
      { x: -0.55, y: 0.45 },
      { x: -1, y: -0.1 },
      { x: -0.95, y: -0.7 },
      { x: -0.4, y: -0.9 },
    ],
    paths: [loop(10)],
    color: "#e0457b",
  },
  star: {
    // Points and the notches between them, in turn.
    dots: ring(10, 1, -90).map((p, i) => (i % 2 === 0 ? p : { x: p.x * 0.5, y: p.y * 0.5 })),
    paths: [loop(10)],
    color: "#e7a614",
  },
  house: {
    dots: [
      { x: -0.8, y: 1 },
      { x: 0.8, y: 1 },
      { x: 0.8, y: 0 },
      { x: 0, y: -1 },
      { x: -0.8, y: 0 },
      { x: -0.25, y: 1 },
      { x: -0.25, y: 0.35 },
      { x: 0.25, y: 0.35 },
      { x: 0.25, y: 1 },
    ],
    paths: [
      [0, 5],
      [8, 1, 2, 3, 4, 0],
      [4, 2],
      [5, 6, 7, 8],
    ],
    color: "#c0703a",
  },
  tree: {
    dots: [
      { x: 0, y: -1 },
      { x: 0.85, y: 0.25 },
      { x: 0.22, y: 0.25 },
      { x: 0.22, y: 1 },
      { x: -0.22, y: 1 },
      { x: -0.22, y: 0.25 },
      { x: -0.85, y: 0.25 },
    ],
    paths: [loop(7)],
    color: "#2f9e5b",
  },
  fish: {
    dots: [
      { x: -1, y: 0 },
      { x: -0.45, y: -0.6 },
      { x: 0.3, y: -0.5 },
      { x: 0.7, y: 0 },
      { x: 1.15, y: -0.6 },
      { x: 1.15, y: 0.6 },
      { x: 0.3, y: 0.5 },
      { x: -0.45, y: 0.6 },
    ],
    paths: [
      [0, 1, 2, 3, 6, 7, 0],
      [3, 4, 5, 3],
    ],
    color: "#2f86d6",
  },
  smile: {
    dots: [
      ...ring(8, 1, -90),
      { x: -0.38, y: -0.3 },
      { x: 0.38, y: -0.3 },
      { x: -0.42, y: 0.32 },
      { x: 0, y: 0.55 },
      { x: 0.42, y: 0.32 },
    ],
    paths: [loop(8), [10, 11, 12]],
    color: "#f08a24",
  },
};

export function isPictureKind(kind: unknown): kind is PictureKind {
  return typeof kind === "string" && (PICTURE_KINDS as readonly string[]).includes(kind);
}

// Two dots must sit at least this far apart on one axis or the other, so the
// node cards drawn on them (NODE_FOOTPRINT, 148 x 90, plus air for a zoomed-out view)
// never overlap.
const DOT_GAP = { x: 196, y: 128 };

// A picture is drawn at least this wide (or tall, whichever is longer), so a
// squat one still reads as a picture rather than a cluster of cards.
const MIN_SPAN = 600;

/**
 * Canvas units per picture unit: the smallest scale at which no two dots'
 * cards touch, and the picture spans at least MIN_SPAN.
 */
export function pictureScale(def: PictureDef): number {
  const span = (axis: "x" | "y") =>
    Math.max(...def.dots.map((d) => d[axis])) - Math.min(...def.dots.map((d) => d[axis]));
  let scale = MIN_SPAN / Math.max(span("x"), span("y"));
  for (let i = 0; i < def.dots.length; i++) {
    for (let j = i + 1; j < def.dots.length; j++) {
      const dx = Math.abs(def.dots[i].x - def.dots[j].x);
      const dy = Math.abs(def.dots[i].y - def.dots[j].y);
      const need = Math.min(dx > 0 ? DOT_GAP.x / dx : Infinity, dy > 0 ? DOT_GAP.y / dy : Infinity);
      scale = Math.max(scale, need);
    }
  }
  return scale;
}

/** Where each dot of `kind` lands when its middle is at `center`. */
export function pictureDots(kind: PictureKind, center: Pt): Pt[] {
  const def = PICTURES[kind];
  const s = pictureScale(def);
  return def.dots.map((d) => ({ x: Math.round(center.x + d.x * s), y: Math.round(center.y + d.y * s) }));
}

const EDGE = 120;
const SEARCH_STEP = 60;

/**
 * Where a picture's dots go: centered as near `desired` as the map allows,
 * fully on the canvas and with every dot clear of `obstacles` (whatever is
 * already on the map). The picture is never squeezed or bent to fit, so it
 * stays the picture; when nowhere is clear it goes where the fewest of its
 * dots land on something, nearest `desired` among those.
 */
export function layoutPicture(kind: PictureKind, desired: Pt, obstacles: Obstacle[] = []): Pt[] {
  const unit = pictureDots(kind, { x: 0, y: 0 });
  const minX = EDGE - Math.min(...unit.map((p) => p.x));
  const maxX = CANVAS_W - EDGE - Math.max(...unit.map((p) => p.x));
  const minY = EDGE - Math.min(...unit.map((p) => p.y));
  const maxY = CANVAS_H - EDGE - Math.max(...unit.map((p) => p.y));
  const clampTo = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  const start = { x: clampTo(desired.x, minX, maxX), y: clampTo(desired.y, minY, maxY) };
  const blocked = (c: Pt) => unit.filter((p) => !clearOf({ x: c.x + p.x, y: c.y + p.y }, obstacles)).length;
  const shift = (c: Pt) => unit.map((p) => ({ x: Math.round(c.x + p.x), y: Math.round(c.y + p.y) }));

  // Rings of candidate middles round the start, nearest first. A full map
  // may have no clear spot at all; then the nearest spot with the fewest
  // dots on something already there, rather than straight on top of it.
  let best = { at: start, blocked: Infinity };
  const reach = Math.ceil(Math.max(CANVAS_W, CANVAS_H) / SEARCH_STEP);
  for (let r = 0; r <= reach; r++) {
    const ringPts: Pt[] = [];
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const c = { x: start.x + i * SEARCH_STEP, y: start.y + j * SEARCH_STEP };
        if (c.x < minX || c.x > maxX || c.y < minY || c.y > maxY) continue;
        ringPts.push(c);
      }
    }
    ringPts.sort((a, b) => Math.hypot(a.x - start.x, a.y - start.y) - Math.hypot(b.x - start.x, b.y - start.y));
    for (const c of ringPts) {
      const n = blocked(c);
      if (n === 0) return shift(c);
      if (n < best.blocked) best = { at: c, blocked: n };
    }
  }
  return shift(best.at);
}

export interface PictureGroup {
  id: string;
  kind: PictureKind;
  def: PictureDef;
  /** The node on each dot that is still on the map. */
  byDot: Map<number, NodeDoc>;
  /** Dots written in. */
  filled: number;
  total: number;
  /** 0..100, rounded. */
  percent: number;
}

/** A dot counts as drawn once its node has been written in (no longer a ghost). */
export function isDotDrawn(node: NodeDoc | undefined): boolean {
  return !!node && !node.ghost;
}

/** Every picture on the map, in the order its first dot appears in `nodes`. */
export function pictureGroups(nodes: NodeDoc[]): PictureGroup[] {
  const groups = new Map<string, PictureGroup>();
  for (const n of nodes) {
    const p = n.picture;
    if (!p || !isPictureKind(p.kind)) continue;
    const def = PICTURES[p.kind];
    if (p.dot < 0 || p.dot >= def.dots.length) continue;
    let g = groups.get(p.id);
    if (!g) {
      g = { id: p.id, kind: p.kind, def, byDot: new Map(), filled: 0, total: def.dots.length, percent: 0 };
      groups.set(p.id, g);
    }
    if (!g.byDot.has(p.dot)) g.byDot.set(p.dot, n);
  }
  for (const g of groups.values()) {
    g.filled = [...g.byDot.values()].filter(isDotDrawn).length;
    g.percent = Math.round((100 * g.filled) / g.total);
  }
  return [...groups.values()];
}

/** How much of every picture on the map is drawn, all together: 0..100, or null with no picture. */
export function overallPercent(groups: PictureGroup[]): number | null {
  const total = groups.reduce((s, g) => s + g.total, 0);
  if (total === 0) return null;
  return Math.round((100 * groups.reduce((s, g) => s + g.filled, 0)) / total);
}

export interface PictureSegment {
  key: string;
  from: NodeDoc;
  to: NodeDoc;
  /** Both ends written in. */
  drawn: boolean;
}

/** Every line of a picture whose two dots are still on the map. */
export function pictureSegments(g: PictureGroup): PictureSegment[] {
  const out: PictureSegment[] = [];
  g.def.paths.forEach((path, pi) => {
    for (let i = 0; i + 1 < path.length; i++) {
      const from = g.byDot.get(path[i]);
      const to = g.byDot.get(path[i + 1]);
      if (!from || !to) continue;
      out.push({ key: `${g.id}:${pi}:${i}`, from, to, drawn: isDotDrawn(from) && isDotDrawn(to) });
    }
  });
  return out;
}

/** The closed paths of a picture whose every dot is still on the map, as their nodes in order. */
export function pictureFills(g: PictureGroup): NodeDoc[][] {
  return g.def.paths
    .filter((path) => path.length > 3 && path[0] === path[path.length - 1])
    .map((path) => path.slice(0, -1).map((d) => g.byDot.get(d)))
    .filter((ns): ns is NodeDoc[] => ns.every(Boolean));
}

/** A fresh id for one picture on the map — its dots share it. */
export function newPictureId(): string {
  return `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
