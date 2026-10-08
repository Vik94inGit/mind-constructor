import { CANVAS_H, CANVAS_W, FULL_CANVAS_BOUNDS } from "./canvasLayout";
import type { Obstacle, ViewportBounds } from "./canvasLayout";

type Pt = { x: number; y: number };

// Where a batch of new nodes can go without landing on anything already on
// the map — and so how many of them the map has room for at all. Used by
// "Text → nodes" (map/TextToNodesModal.tsx) to tell up front when a text has
// more pieces than fit, so the user can choose which ones to pack instead.
//
// The canvas is a fixed CANVAS_W x CANVAS_H, so room really does run out.
// Candidate spots sit on a hexagonal grid `spacing` apart (the tightest
// layout that keeps every pair at least `spacing` apart); the ones clear of
// every obstacle are taken nearest-to-`center` first, so the batch forms one
// compact group around where the user asked for it.

/** Spots kept clear of the canvas edge — same margin pickNonOverlappingPosition uses. */
const EDGE_MARGIN = 120;

function clearOf(p: Pt, obstacles: Obstacle[]): boolean {
  return obstacles.every((o) => {
    if (o.footprint) {
      return Math.abs(p.x - o.x) >= o.footprint.w || Math.abs(p.y - o.y) >= o.footprint.h;
    }
    return Math.hypot(p.x - o.x, p.y - o.y) >= o.minDist;
  });
}

/**
 * Up to `count` free spots, nearest `center` first, each at least `spacing`
 * from the others and clear of `obstacles`. Fewer come back when the map
 * doesn't have room for `count` — the length is how many fit.
 */
export function findFreeSpots(
  center: Pt,
  count: number,
  obstacles: Obstacle[],
  spacing: number,
  bounds: ViewportBounds = FULL_CANVAS_BOUNDS,
): Pt[] {
  if (count <= 0) return [];
  const minX = Math.max(EDGE_MARGIN, bounds.minX);
  const maxX = Math.min(CANVAS_W - EDGE_MARGIN, bounds.maxX);
  const minY = Math.max(EDGE_MARGIN, bounds.minY);
  const maxY = Math.min(CANVAS_H - EDGE_MARGIN, bounds.maxY);
  const rowH = (spacing * Math.sqrt(3)) / 2;
  // Anchor the grid on the center itself, so the first spot is exactly there
  // when it's free.
  const firstRow = Math.ceil((minY - center.y) / rowH);
  const lastRow = Math.floor((maxY - center.y) / rowH);
  const candidates: Pt[] = [];
  for (let r = firstRow; r <= lastRow; r++) {
    const y = center.y + r * rowH;
    const shift = Math.abs(r) % 2 === 1 ? spacing / 2 : 0;
    const firstCol = Math.ceil((minX - center.x - shift) / spacing);
    const lastCol = Math.floor((maxX - center.x - shift) / spacing);
    for (let c = firstCol; c <= lastCol; c++) {
      const p = { x: center.x + shift + c * spacing, y };
      if (clearOf(p, obstacles)) candidates.push(p);
    }
  }
  candidates.sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y));
  return candidates.slice(0, count);
}
