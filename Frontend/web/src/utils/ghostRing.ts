// Where a quick-add ghost sits on its ring (map/QuickAddGhosts.tsx) when the
// chosen node is bigger than a round icon: a picture card or a puzzle card.
// The ring keeps its radius wherever that already clears the node; on the
// angles where it doesn't, the ghost walks straight out along its own ray
// until neither its circle nor the name hanging under it touches the node.
// So the ring stays round around a round icon and hugs a card's outline
// instead of lying on top of it.

/** A box relative to the ring's center, in canvas units. */
export interface RingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A ghost's own size, in canvas units: its circle's radius and the name chip under it. */
export interface GhostShape {
  /** Half the ghost circle's width, plus the gap to keep from the node. */
  half: number;
  /** How far the name chip reaches below the ghost's center. */
  labelBelow: number;
  /** Half the name chip's width. */
  labelHalfWidth: number;
}

function overlaps(a: RingBox, b: RingBox): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** Whether a ghost centered at (x, y) touches `node`, its name chip included. */
export function ghostTouches(x: number, y: number, node: RingBox, ghost: GhostShape): boolean {
  const icon = { left: x - ghost.half, right: x + ghost.half, top: y - ghost.half, bottom: y + ghost.half };
  const label = { left: x - ghost.labelHalfWidth, right: x + ghost.labelHalfWidth, top: y, bottom: y + ghost.labelBelow };
  return overlaps(icon, node) || overlaps(label, node);
}

/**
 * How far from the ring's center the ghost at `angle` goes: `radius`, or
 * further out along the same ray until it clears `node`. Without a node box
 * (nothing measured yet) it is just `radius`.
 */
export function ghostDistance(angle: number, radius: number, node: RingBox | null, ghost: GhostShape): number {
  if (!node) return radius;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // A small step against the node's own size: a few hundred steps at most,
  // and the ghost ends within a step of where it first clears.
  const step = Math.max(1, Math.max(node.right - node.left, node.bottom - node.top) / 100);
  const limit = radius + (node.right - node.left) + (node.bottom - node.top) + ghost.half * 2 + ghost.labelBelow + ghost.labelHalfWidth * 2;
  let d = radius;
  while (d < limit && ghostTouches(cos * d, sin * d, node, ghost)) d += step;
  return d;
}
