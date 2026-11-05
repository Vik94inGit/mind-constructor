import { NODE_FOOTPRINT } from "./canvasLayout";
import type { Obstacle } from "./canvasLayout";

type Pt = { x: number; y: number };

/** A box on the canvas, by its center. */
export interface CanvasBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * What a node really covers on the canvas right now, in canvas units: the
 * union of its element's and every descendant's screen boxes (its icon or
 * card, caption and badges), turned into canvas points by `toCanvas`. A node
 * drawn as a wide card covers far more than NODE_FOOTPRINT, which is all the
 * placement rules assume. Null when it isn't on screen.
 */
export function drawnBox(nodeId: string, toCanvas: (clientX: number, clientY: number) => Pt): CanvasBox | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(`[data-reveal-node="${CSS.escape(nodeId)}"]`);
  if (!el) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const part of [el, ...Array.from(el.querySelectorAll("*"))]) {
    const r = part.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  if (!Number.isFinite(left)) return null;
  const a = toCanvas(left, top);
  const b = toCanvas(right, bottom);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, w: b.x - a.x, h: b.y - a.y };
}

/** An obstacle that keeps a new node's whole footprint, plus `gap`, off `box`. */
export function boxObstacle(box: CanvasBox, gap: number): Obstacle {
  return {
    x: box.x,
    y: box.y,
    minDist: 0,
    footprint: { w: (box.w + NODE_FOOTPRINT.w) / 2 + gap, h: (box.h + NODE_FOOTPRINT.h) / 2 + gap },
  };
}
