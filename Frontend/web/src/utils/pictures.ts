import { CANVAS_H, CANVAS_W } from "./canvasLayout";
import type { Obstacle } from "./canvasLayout";
import { clearOf } from "./freeSpots";
import type { NodeDoc, NodeType, ZonePaletteColor } from "../types";

// "Draw a picture": a picture laid out on the map as ghost nodes, one per
// dot, like a connect-the-dots page. Each dot's line to its neighbours is
// drawn once both ends are written in, so the picture fills in as the user
// answers its ghosts, and how much of it is drawn (on the canvas and on the
// minimap) shows how far along they are. A node knows which dot it is
// through Node.picture ({ id, kind, dot }); everything else about a picture
// lives here.

type Pt = { x: number; y: number };

// One picture for each node type (a bulb for an Idea, a stop sign for a
// Problem…), whose dots arrive as ghosts of that type, then the pictures
// drawn just for fun, whose dots are Ideas.
export const TYPE_PICTURE_KINDS = ["bulb", "stop", "warning", "key", "fork", "flag", "cloud", "question"] as const;
export const FUN_PICTURE_KINDS = ["heart", "star", "house", "tree", "fish", "smile"] as const;
export const PICTURE_KINDS = [...TYPE_PICTURE_KINDS, ...FUN_PICTURE_KINDS] as const;
export type PictureKind = (typeof PICTURE_KINDS)[number];

export interface PictureDef {
  /** Each dot, in units round the picture's middle (screen y grows downward). */
  dots: Pt[];
  /** Lines through the dots, by index. A path that ends where it starts is closed and gets a fill. */
  paths: number[][];
  /** The ink the drawn lines take. */
  color: string;
  /** The node type this picture stands for; its dots are made as that type. Absent: a picture for fun, made of Ideas. */
  type?: NodeType;
}

function ring(count: number, radius: number, startDeg: number): Pt[] {
  return Array.from({ length: count }, (_, i) => {
    const a = ((startDeg + (i * 360) / count) * Math.PI) / 180;
    return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
  });
}

const loop = (count: number, from = 0) => [...Array.from({ length: count }, (_, i) => from + i), from];

export const PICTURES: Record<PictureKind, PictureDef> = {
  bulb: {
    // The glass round the top, then the screw base under its neck.
    dots: [
      { x: -0.35, y: 0.35 },
      { x: -0.7, y: -0.05 },
      { x: -0.75, y: -0.55 },
      { x: -0.35, y: -0.95 },
      { x: 0.35, y: -0.95 },
      { x: 0.75, y: -0.55 },
      { x: 0.7, y: -0.05 },
      { x: 0.35, y: 0.35 },
      { x: 0.35, y: 0.95 },
      { x: -0.35, y: 0.95 },
    ],
    paths: [loop(10), [0, 7]],
    color: "#e7a614",
    type: "Idea",
  },
  stop: {
    // An octagon, flat on top like the road sign.
    dots: ring(8, 1, -112.5),
    paths: [loop(8)],
    color: "#d93a3a",
    type: "Problem",
  },
  warning: {
    // A warning triangle with an exclamation stroke inside.
    dots: [
      { x: 0, y: -1 },
      { x: 0.55, y: -0.05 },
      { x: 1.05, y: 0.85 },
      { x: 0, y: 0.85 },
      { x: -1.05, y: 0.85 },
      { x: -0.55, y: -0.05 },
      { x: 0, y: -0.45 },
      { x: 0, y: 0.3 },
    ],
    paths: [loop(6), [6, 7]],
    color: "#e08a00",
    type: "Problematic option",
  },
  key: {
    // A round bow on the left, the shaft to the right and one tooth.
    dots: [
      ...ring(6, 0.55, 0).map((p) => ({ x: p.x - 0.55, y: p.y })),
      { x: 0.6, y: 0 },
      { x: 1.2, y: 0 },
      { x: 1.2, y: 0.5 },
      { x: 0.6, y: 0.5 },
    ],
    paths: [loop(6), [0, 6, 7, 8], [6, 9]],
    color: "#1f9d8a",
    type: "Solution",
  },
  fork: {
    // A road that splits two ways.
    dots: [
      { x: 0, y: 1 },
      { x: 0, y: 0.35 },
      { x: -0.5, y: -0.2 },
      { x: -1, y: -0.8 },
      { x: 0.5, y: -0.2 },
      { x: 1, y: -0.8 },
    ],
    paths: [
      [0, 1, 2, 3],
      [1, 4, 5],
    ],
    color: "#7a5cd6",
    type: "Option",
  },
  flag: {
    // A flag planted on the ground: the pole, its pennant and the ground.
    dots: [
      { x: -0.6, y: 1 },
      { x: -0.6, y: 0.3 },
      { x: -0.6, y: -0.3 },
      { x: -0.6, y: -1 },
      { x: 0.9, y: -0.65 },
      { x: -1.2, y: 1 },
      { x: 0, y: 1 },
    ],
    paths: [
      [0, 1, 2],
      [2, 3, 4, 2],
      [5, 0, 6],
    ],
    color: "#2f9e5b",
    type: "Success",
  },
  cloud: {
    // A rain cloud: its bumpy top, a flat bottom and two streaks of rain.
    dots: [
      { x: -1, y: 0.25 },
      { x: -0.85, y: -0.35 },
      { x: -0.3, y: -0.65 },
      { x: 0.25, y: -0.85 },
      { x: 0.8, y: -0.45 },
      { x: 1, y: 0.25 },
      { x: 0.4, y: 0.25 },
      { x: -0.4, y: 0.25 },
      { x: -0.6, y: 0.95 },
      { x: 0.2, y: 0.95 },
    ],
    paths: [loop(8), [7, 8], [6, 9]],
    color: "#6b7a90",
    type: "Fail",
  },
  question: {
    // A question mark: the hook, then its dot on its own.
    dots: [
      { x: -0.6, y: -0.4 },
      { x: -0.35, y: -0.95 },
      { x: 0.3, y: -1 },
      { x: 0.7, y: -0.5 },
      { x: 0.3, y: 0 },
      { x: 0, y: 0.4 },
      { x: 0, y: 1 },
    ],
    paths: [[0, 1, 2, 3, 4, 5]],
    color: "#8a8f98",
    type: "unknown",
  },
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

/** The node type a picture's dots are made as: its own type, or Idea for a picture drawn for fun. */
export function pictureNodeType(kind: PictureKind): NodeType {
  return PICTURES[kind].type ?? "Idea";
}

/** The picture that stands for a node type (a bulb for an Idea, a stop sign for a Problem…). */
export function pictureForType(type: NodeType): PictureKind {
  return TYPE_PICTURE_KINDS.find((k) => PICTURES[k].type === type) ?? "bulb";
}

// Two dots must sit at least this far apart on one axis or the other, so the
// node cards drawn on them (NODE_FOOTPRINT, 148 x 90, plus a little air)
// never overlap. Kept tight so a picture stays small on the map.
const DOT_GAP = { x: 170, y: 110 };

// A picture is drawn at least this wide (or tall, whichever is longer), so a
// squat one still reads as a picture rather than a cluster of cards.
const MIN_SPAN = 400;

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

// ---------------------------------------------------------------------------
// A picture drawn on its own (Node.picture.size set): the drawing is small
// enough to see whole at 100% zoom, and its cards sit round it on their own
// spots, each joined to its numbered dot by a thin line
// (docs/gestures/picture-projection.md). Where the drawing sits follows from
// its cards' spots (pictureSpots), so moving the whole picture moves the
// drawing, and dragging one card only nudges it instead of bending it.

/** A picture's dots, in picture units, round the middle of the box they fill. */
function centeredDots(def: PictureDef): Pt[] {
  const xs = def.dots.map((d) => d.x);
  const ys = def.dots.map((d) => d.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return def.dots.map((d) => ({ x: d.x - cx, y: d.y - cy }));
}

/** How wide and tall a picture is, in picture units. */
function unitSpan(def: PictureDef): { w: number; h: number } {
  const xs = def.dots.map((d) => d.x);
  const ys = def.dots.map((d) => d.y);
  return { w: Math.max(...xs) - Math.min(...xs) || 1, h: Math.max(...ys) - Math.min(...ys) || 1 };
}

/** The share of the screen a new drawing may take, and its limits in canvas units. */
const FIT_SHARE = 0.6;
const DRAWING_MAX = 600;
const DRAWING_MIN = 160;

/**
 * The size (canvas units per picture unit) at which a picture's drawing fits
 * a screen of `view` pixels at 100% zoom: FIT_SHARE of it, never longer than
 * DRAWING_MAX nor shorter than DRAWING_MIN on its longer side.
 */
export function pictureFitSize(def: PictureDef, view: { w: number; h: number }): number {
  const { w, h } = unitSpan(def);
  const longer = Math.max(w, h);
  const fit = Math.min((view.w * FIT_SHARE) / w, (view.h * FIT_SHARE) / h, DRAWING_MAX / longer);
  return Math.round(Math.max(fit, DRAWING_MIN / longer) * 10) / 10;
}

/** The smallest and largest size − / + may take a picture's drawing to. */
export function pictureSizeLimits(def: PictureDef): { min: number; max: number } {
  const longer = Math.max(unitSpan(def).w, unitSpan(def).h);
  return { min: DRAWING_MIN / longer, max: (DRAWING_MAX * 2) / longer };
}

/** Where each dot of the drawing sits when the drawing's middle is at `center`. */
export function drawingSpots(def: PictureDef, center: Pt, size: number): Pt[] {
  return centeredDots(def).map((d) => ({ x: center.x + d.x * size, y: center.y + d.y * size }));
}

// Cards go on a rectangle round the drawing, this far clear of it (on top of
// half a card), spaced at least CARD_STEP apart along it, so no two cards
// touch (DOT_GAP) and none covers the drawing.
const CARD_CLEARANCE = 28;
const CARD_STEP = 230;

/** A point on the rectangle of half-width hw and half-height hh, `s` along its edge from its top-left corner, clockwise. */
function rectPointAt(s: number, hw: number, hh: number): Pt {
  const per = 4 * (hw + hh);
  let t = ((s % per) + per) % per;
  if (t < 2 * hw) return { x: -hw + t, y: -hh };
  t -= 2 * hw;
  if (t < 2 * hh) return { x: hw, y: -hh + t };
  t -= 2 * hh;
  if (t < 2 * hw) return { x: hw - t, y: hh };
  t -= 2 * hw;
  return { x: -hw, y: hh - t };
}

/** How far along the rectangle's edge (as rectPointAt counts) the ray from its middle through `p` meets it. */
function rectArcOf(p: Pt, hw: number, hh: number): number {
  const ax = Math.abs(p.x);
  const ay = Math.abs(p.y);
  if (ax < 1e-9 && ay < 1e-9) return 0;
  const k = Math.min(ax > 0 ? hw / ax : Infinity, ay > 0 ? hh / ay : Infinity);
  const x = p.x * k;
  const y = p.y * k;
  if (Math.abs(y + hh) < 1e-6 && x < hw) return x + hw; // top
  if (Math.abs(x - hw) < 1e-6 && y < hh) return 2 * hw + (y + hh); // right
  if (Math.abs(y - hh) < 1e-6 && x > -hw) return 2 * hw + 2 * hh + (hw - x); // bottom
  return 4 * hw + 2 * hh + (hh - y); // left
}

/**
 * Where a picture's cards go round its drawing, as offsets from the drawing's
 * middle: each on the side of the drawing its dot is on, spread along a
 * rectangle round the drawing so none touches another or covers the drawing,
 * then all shifted so their mean is the drawing's middle.
 */
export function pictureCardOffsets(def: PictureDef, size: number): Pt[] {
  let cached = cardOffsetCache.get(def)?.get(size);
  if (!cached) {
    cached = layCards(def, size);
    if (!cardOffsetCache.has(def)) cardOffsetCache.set(def, new Map());
    cardOffsetCache.get(def)!.set(size, cached);
  }
  return cached.map((p) => ({ ...p }));
}

const cardOffsetCache = new WeakMap<PictureDef, Map<number, Pt[]>>();

function layCards(def: PictureDef, size: number): Pt[] {
  const dots = centeredDots(def).map((d) => ({ x: d.x * size, y: d.y * size }));
  const { w, h } = unitSpan(def);
  const n = dots.length;
  let hw = (w * size) / 2 + DOT_GAP.x / 2 + CARD_CLEARANCE;
  let hh = (h * size) / 2 + DOT_GAP.y / 2 + CARD_CLEARANCE;
  for (let attempt = 0; attempt < 30; attempt++) {
    const per = 4 * (hw + hh);
    if (per < n * CARD_STEP) {
      const grow = (n * CARD_STEP - per) / 8 + 1;
      hw += grow;
      hh += grow;
      continue;
    }
    // Each card where the ray from the middle through its dot meets the
    // rectangle, then pushed apart along it, keeping their order round it.
    const order = dots.map((d, i) => ({ i, at: rectArcOf(d, hw, hh) })).sort((a, b) => a.at - b.at);
    const at = order.map((o) => o.at);
    for (let iter = 0; iter < 400; iter++) {
      let moved = false;
      for (let k = 0; k < n; k++) {
        const next = k + 1 < n ? at[k + 1] : at[0] + per;
        const gap = next - at[k];
        if (n > 1 && gap < CARD_STEP - 0.01) {
          const push = (CARD_STEP - gap) / 2;
          at[k] -= push;
          if (k + 1 < n) at[k + 1] += push;
          else at[0] += push;
          moved = true;
        }
      }
      if (!moved) break;
    }
    const spots: Pt[] = new Array(n);
    order.forEach((o, k) => (spots[o.i] = rectPointAt(at[k], hw, hh)));
    const mean = {
      x: spots.reduce((s, p) => s + p.x, 0) / n,
      y: spots.reduce((s, p) => s + p.y, 0) / n,
    };
    const out = spots.map((p) => ({ x: Math.round(p.x - mean.x), y: Math.round(p.y - mean.y) }));
    // Shifting by the mean must not slide a card onto the drawing.
    const offDrawing = out.every(
      (p) => Math.abs(p.x) >= (w * size) / 2 + DOT_GAP.x / 2 || Math.abs(p.y) >= (h * size) / 2 + DOT_GAP.y / 2,
    );
    if (cardsClear(out) && offDrawing) return out;
    hw += 30;
    hh += 30;
  }
  // Never reached for the pictures there are; the old layout as a fallback.
  return dots.map((d) => ({ x: Math.round((d.x / size) * pictureScale(def)), y: Math.round((d.y / size) * pictureScale(def)) }));
}

/** The mean of these spots. */
export function pictureCenter(spots: Pt[]): Pt {
  return {
    x: spots.reduce((s, p) => s + p.x, 0) / spots.length,
    y: spots.reduce((s, p) => s + p.y, 0) / spots.length,
  };
}

/**
 * Where each of a picture's dots is drawn, by dot: on the picture's own
 * drawing when it has one (size set), otherwise on its node, as pictures
 * were drawn before. `posOf` gives a node's spot, or undefined to leave it out.
 */
export function pictureSpots(g: PictureGroup, posOf: (node: NodeDoc) => Pt | undefined): Map<number, Pt> {
  const out = new Map<number, Pt>();
  const cards = new Map<number, Pt>();
  g.byDot.forEach((n, dot) => {
    const p = posOf(n);
    if (p) cards.set(dot, p);
  });
  if (!g.size || cards.size === 0) return cards;
  // Each card puts the middle where it would be had the card stayed on its
  // laid-out spot; the drawing goes to the mean of those. So it stays put
  // while its cards arrive one by one or one is deleted, follows the whole
  // picture when it moves, and moves only a fraction with one dragged card.
  const offsets = pictureCardOffsets(g.def, g.size);
  const center = pictureCenter([...cards.entries()].map(([dot, p]) => ({ x: p.x - offsets[dot].x, y: p.y - offsets[dot].y })));
  const drawn = drawingSpots(g.def, center, g.size);
  g.byDot.forEach((_, dot) => out.set(dot, drawn[dot]));
  return out;
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
 * dots land on something, nearest `desired` among those. With `size`, the
 * picture is drawn on its own at that size and these are its cards' spots
 * round the drawing (pictureCardOffsets).
 */
export function layoutPicture(kind: PictureKind, desired: Pt, obstacles: Obstacle[] = [], size?: number): Pt[] {
  // A picture drawn on its own: its cards round the drawing, and the
  // drawing's own dots kept clear of the map too.
  const cards = size ? pictureCardOffsets(PICTURES[kind], size) : pictureDots(kind, { x: 0, y: 0 });
  const drawing = size ? drawingSpots(PICTURES[kind], { x: 0, y: 0 }, size) : [];
  const unit = [...cards, ...drawing];
  const minX = EDGE - Math.min(...unit.map((p) => p.x));
  const maxX = CANVAS_W - EDGE - Math.max(...unit.map((p) => p.x));
  const minY = EDGE - Math.min(...unit.map((p) => p.y));
  const maxY = CANVAS_H - EDGE - Math.max(...unit.map((p) => p.y));
  const clampTo = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  const start = { x: clampTo(desired.x, minX, maxX), y: clampTo(desired.y, minY, maxY) };
  const blocked = (c: Pt) => unit.filter((p) => !clearOf({ x: c.x + p.x, y: c.y + p.y }, obstacles)).length;
  const shift = (c: Pt) => cards.map((p) => ({ x: Math.round(c.x + p.x), y: Math.round(c.y + p.y) }));

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

/** How much one − / + changes a picture's size. */
export const PICTURE_RESIZE_STEP = 1.15;

/** Whether no two of these spots are closer than two node cards allow. */
function cardsClear(pts: Pt[]): boolean {
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (Math.abs(pts[i].x - pts[j].x) < DOT_GAP.x && Math.abs(pts[i].y - pts[j].y) < DOT_GAP.y) return false;
    }
  }
  return true;
}

/**
 * A picture's dots `factor` times bigger (or smaller, under 1), around the
 * middle of the box they fill. null when the new size can't be had: shrunk
 * until two dots' cards would touch, or grown past the canvas. A picture whose
 * dots were already crowded (moved there by hand) may still grow.
 */
export function resizePicture(pts: Pt[], factor: number): Pt[] | null {
  if (pts.length === 0) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const out = pts.map((p) => ({ x: Math.round(cx + (p.x - cx) * factor), y: Math.round(cy + (p.y - cy) * factor) }));
  if (factor < 1 && !cardsClear(out)) return null;
  const nx = out.map((p) => p.x);
  const ny = out.map((p) => p.y);
  const w = Math.max(...nx) - Math.min(...nx);
  const h = Math.max(...ny) - Math.min(...ny);
  if (factor > 1 && (w > CANVAS_W - 2 * EDGE || h > CANVAS_H - 2 * EDGE)) return null;
  // Slid back inside the canvas if growing pushed an edge out.
  const dx = Math.max(0, EDGE - Math.min(...nx)) - Math.max(0, Math.max(...nx) - (CANVAS_W - EDGE));
  const dy = Math.max(0, EDGE - Math.min(...ny)) - Math.max(0, Math.max(...ny) - (CANVAS_H - EDGE));
  return out.map((p) => ({ x: p.x + dx, y: p.y + dy }));
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
  /** The fill colour picked for it (Node.picture.color, the same on every dot), or null for its own. */
  color: ZonePaletteColor | null;
  /** Canvas units per picture unit of its own drawing (Node.picture.size), or null for an older picture drawn through its cards. */
  size: number | null;
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
      g = { id: p.id, kind: p.kind, def, byDot: new Map(), filled: 0, total: def.dots.length, percent: 0, color: null, size: null };
      groups.set(p.id, g);
    }
    if (!g.byDot.has(p.dot)) g.byDot.set(p.dot, n);
    if (p.color && !g.color) g.color = p.color;
    if (typeof p.size === "number" && p.size > 0 && !g.size) g.size = p.size;
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
