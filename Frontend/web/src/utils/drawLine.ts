import { CANVAS_W, CANVAS_H, CAPTION_WIDTH } from "./canvasLayout";

type Pt = { x: number; y: number };

// Where a separator line's points may go: any spot that is not covered by a
// node or by a zone. A line's points are what the user chooses, so only they
// are checked — a segment between two free points may still pass over
// something, that is the user's call.

// A node's clickable/visible footprint around its position: the icon, with its
// crown above and its caption below. Wider and taller in the classic mind-map
// reading mode, where a node is a text box. Deliberately a little generous, so
// a point never lands right against a node's edge.
function nodeBox(classic: boolean) {
  return classic
    ? { left: 135, right: 135, top: 55, bottom: 95 }
    : { left: CAPTION_WIDTH / 2 + 10, right: CAPTION_WIDTH / 2 + 10, top: 42, bottom: 78 };
}

// Manual zone rings are a fixed 55-unit circle around their node (see
// CanvasBackdrop); a little margin keeps points off the ring itself.
const MANUAL_ZONE_RADIUS = 55 + 8;
const EDGE_MARGIN = 20;

// Even-odd ray casting — true when `p` is inside the polygon `poly`.
export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export interface DrawObstacles {
  /** Every visible node's position. */
  nodes: Pt[];
  /** Filled areas: circle zones (their outlines) and closed link figures. */
  polygons: Pt[][];
  /** Manually placed zone rings, centered on their node. */
  circles: Pt[];
  classic: boolean;
}

export function isPointFree(p: Pt, obstacles: DrawObstacles): boolean {
  if (p.x < EDGE_MARGIN || p.y < EDGE_MARGIN || p.x > CANVAS_W - EDGE_MARGIN || p.y > CANVAS_H - EDGE_MARGIN) return false;
  const box = nodeBox(obstacles.classic);
  for (const n of obstacles.nodes) {
    if (p.x >= n.x - box.left && p.x <= n.x + box.right && p.y >= n.y - box.top && p.y <= n.y + box.bottom) return false;
  }
  for (const c of obstacles.circles) {
    if (Math.hypot(p.x - c.x, p.y - c.y) <= MANUAL_ZONE_RADIUS) return false;
  }
  for (const poly of obstacles.polygons) {
    if (poly.length >= 3 && pointInPolygon(p, poly)) return false;
  }
  return true;
}

// How much each corner of a finished line is rounded, in canvas units — "just
// a little": a gentle bend instead of a sharp angle, never a swoop. The stored
// points stay exactly what was clicked; this only shapes how they are drawn.
export const LINE_CORNER_RADIUS = 24;

// An SVG path through `points` with every interior corner rounded by up to
// `radius`: each corner is replaced by a quadratic curve that starts and ends
// `radius` short of the corner along its two segments, with the corner itself
// as the control point. The rounding never reaches past the middle of a
// segment, so a short segment simply gets a tighter bend rather than the
// curves overlapping. A two-point line is just a straight segment.
export function roundedPath(points: Pt[], radius: number = LINE_CORNER_RADIUS): string {
  if (points.length === 0) return "";
  if (points.length < 3) return "M" + points.map((p) => `${p.x} ${p.y}`).join(" L");
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const corner = points[i];
    const next = points[i + 1];
    const lenIn = Math.hypot(corner.x - prev.x, corner.y - prev.y);
    const lenOut = Math.hypot(next.x - corner.x, next.y - corner.y);
    // A repeated point has no direction to round — just pass through it.
    if (lenIn === 0 || lenOut === 0) {
      d += ` L${corner.x} ${corner.y}`;
      continue;
    }
    const r = Math.min(radius, lenIn / 2, lenOut / 2);
    const startX = corner.x + ((prev.x - corner.x) / lenIn) * r;
    const startY = corner.y + ((prev.y - corner.y) / lenIn) * r;
    const endX = corner.x + ((next.x - corner.x) / lenOut) * r;
    const endY = corner.y + ((next.y - corner.y) / lenOut) * r;
    d += ` L${startX} ${startY} Q${corner.x} ${corner.y} ${endX} ${endY}`;
  }
  const last = points[points.length - 1];
  return d + ` L${last.x} ${last.y}`;
}

// Would a straight stretch from `a` to `b` stay clear of every node and zone?
// Checked by looking along it every few units — obstacles are far bigger than
// the step — so a stretch between two free points that still cuts across a
// node or a zone is refused too. Other lines are not obstacles: lines may
// cross and join each other.
export function isSegmentFree(a: Pt, b: Pt, obstacles: DrawObstacles): boolean {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(length / 8));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (!isPointFree({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, obstacles)) return false;
  }
  return true;
}

const SNAP_VERTEX = 16;
const SNAP_SEGMENT = 12;

// Lets a new point join an existing line: within a few units of one of its
// corners it lands exactly on that corner, otherwise within a few units of one
// of its stretches it lands on the nearest spot along it. Anything farther away
// is left as clicked.
export function snapToLines(p: Pt, lines: { points: Pt[] }[]): Pt {
  let bestVertex: Pt | null = null;
  let bestVertexDist = SNAP_VERTEX;
  let bestSpot: Pt | null = null;
  let bestSpotDist = SNAP_SEGMENT;
  for (const line of lines) {
    const pts = line.points;
    for (let i = 0; i < pts.length; i++) {
      const dv = Math.hypot(p.x - pts[i].x, p.y - pts[i].y);
      if (dv <= bestVertexDist) {
        bestVertexDist = dv;
        bestVertex = pts[i];
      }
      if (i === pts.length - 1) continue;
      const a = pts[i];
      const b = pts[i + 1];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const lenSq = abx * abx + aby * aby;
      if (lenSq === 0) continue;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq));
      const spot = { x: a.x + abx * t, y: a.y + aby * t };
      const ds = Math.hypot(p.x - spot.x, p.y - spot.y);
      if (ds <= bestSpotDist) {
        bestSpotDist = ds;
        bestSpot = spot;
      }
    }
  }
  return bestVertex ?? bestSpot ?? p;
}
