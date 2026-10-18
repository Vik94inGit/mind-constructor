// Starter structures laid out as plain geometry: the thoughts hanging straight
// from the center sit evenly round a circle, a square or an equilateral
// triangle (60° / 60° / 60°) about it, and each deeper level steps one further
// out from its own parent, fanned away from the center. Worked out in "step"
// units (one step = the gap between a node and its child), so the same shape
// can be drawn small in a preview (components/ThoughtPreview.tsx) and full
// size on the canvas (utils/templates.ts layoutTemplate, utils/thoughtFlow.ts
// layoutThoughts) and look the same in both.

type Pt = { x: number; y: number };

/**
 * One step on the canvas, from the pack spacing (canvasLayout
 * getCirclePackSpacing). A node's footprint is a wide box (its caption), not a
 * circle, so a step a little longer than the spacing keeps two nodes a step
 * apart clear of each other in any direction, and the shape lands as drawn
 * instead of being nudged out of true.
 */
export function shapeStep(spacing: number): number {
  return spacing * 1.12;
}

export type RingShape = "circle" | "square" | "triangle";

/**
 * The shape a ring of `count` nodes takes: three, or any multiple of three,
 * makes a triangle (its corners filled first); four or a multiple of four a
 * square; anything else a circle.
 */
export function shapeFor(count: number): RingShape {
  if (count >= 3 && count % 3 === 0) return "triangle";
  if (count >= 4 && count % 4 === 0) return "square";
  return "circle";
}

const SQRT2 = Math.SQRT2;
const SQRT3 = Math.sqrt(3);

// The shape's corners, on a circle of radius 1, in order round it starting at
// the top (screen y grows downward).
function corners(shape: RingShape): Pt[] {
  if (shape === "triangle") {
    return [-90, 30, 150].map((deg) => ({ x: Math.cos((deg * Math.PI) / 180), y: Math.sin((deg * Math.PI) / 180) }));
  }
  const h = 1 / SQRT2;
  return [
    { x: -h, y: -h },
    { x: h, y: -h },
    { x: h, y: h },
    { x: -h, y: h },
  ];
}

/** How long the shape's outline is, for a radius of 1. */
function perimeter(shape: RingShape): number {
  if (shape === "triangle") return 3 * SQRT3;
  if (shape === "square") return 4 * SQRT2;
  return 2 * Math.PI;
}

/**
 * `count` points spread evenly along the outline of `shape` (radius 1 round
 * the origin), starting at its first corner (the top for a circle or a
 * triangle, the top-left for a square) and going clockwise on screen.
 */
export function outlinePoints(count: number, shape: RingShape = shapeFor(count)): Pt[] {
  if (count <= 0) return [];
  if (shape === "circle") {
    return Array.from({ length: count }, (_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / count;
      return { x: Math.cos(a), y: Math.sin(a) };
    });
  }
  const cs = corners(shape);
  const side = perimeter(shape) / cs.length;
  return Array.from({ length: count }, (_, i) => {
    const along = (i * perimeter(shape)) / count;
    const k = Math.min(cs.length - 1, Math.floor(along / side + 1e-9));
    const f = along / side - k;
    const a = cs[k];
    const b = cs[(k + 1) % cs.length];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  });
}

/**
 * The first ring never grows past this many steps from the center: a zone
 * reaches two pack spacings round its parent (canvasLayout getZoneReach), so a
 * long ring stays inside it and the zone rules spread out what crowds.
 */
const MAX_RING = 1.6;

/** Widest fan of siblings round their parent's outward direction, in radians. */
const MAX_FAN = (4 * Math.PI) / 3;
// 60° between siblings keeps them a full step apart from each other too.
const FAN_STEP = Math.PI / 3;

export interface ShapeItem {
  id: string;
  /** The item this one hangs from; the root's id (or an unknown id) for the first ring. */
  parentId: string;
}

/**
 * Where every item sits, in step units round the root at (0, 0). The first
 * ring is drawn on its shape at a radius just big enough that neighbours on
 * the outline stay at least one step apart (never less than one step), and
 * every child sits one step out from its parent, its siblings fanned round the
 * direction away from the center. `items` must list parents before children.
 */
export function shapeTree(items: ShapeItem[], rootId: string): Map<string, Pt> {
  const ids = new Set(items.map((t) => t.id));
  const parentOf = (t: ShapeItem) => (ids.has(t.parentId) ? t.parentId : rootId);
  const kids = new Map<string, ShapeItem[]>();
  for (const t of items) kids.set(parentOf(t), [...(kids.get(parentOf(t)) ?? []), t]);

  const out = new Map<string, Pt>();
  const ring = kids.get(rootId) ?? [];
  const shape = shapeFor(ring.length);
  const radius = Math.min(MAX_RING, Math.max(1, ring.length / perimeter(shape)));
  outlinePoints(ring.length, shape).forEach((p, i) => out.set(ring[i].id, { x: p.x * radius, y: p.y * radius }));

  for (const t of items) {
    const children = kids.get(t.id);
    const at = out.get(t.id);
    if (!children || !at) continue;
    const outward = Math.atan2(at.y, at.x);
    const n = children.length;
    // A fan pointing away from the center, 60° between siblings; a big family
    // spreads wider (never back toward the center) and, once that runs out,
    // a little further out, so neighbours stay about a step apart.
    const fan = Math.min(MAX_FAN, FAN_STEP * (n - 1));
    const gap = n > 1 ? fan / (n - 1) : 0;
    const reach = n > 1 ? Math.min(MAX_RING, Math.max(1, 1 / (2 * Math.sin(gap / 2)))) : 1;
    children.forEach((c, i) => {
      const a = n === 1 ? outward : outward - fan / 2 + gap * i;
      out.set(c.id, { x: at.x + reach * Math.cos(a), y: at.y + reach * Math.sin(a) });
    });
  }
  return out;
}
