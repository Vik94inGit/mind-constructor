// A selection dragged as a group moves like a creature: the node under the
// finger leads, and every other member walks the path the leader took, each a
// few ticks behind the one before it and in small hops, so the group strings
// out behind the finger and gathers back up when it stops (useNodeDragAndDrop).

type Pt = { x: number; y: number };

/** How often the followers take a step. */
export const TRAIL_TICK_MS = 40;
/** Ticks each follower trails the one in front of it. */
export const TRAIL_LAG_TICKS = 3;
/** The last follower never trails the leader by more than this many ticks, however long the line. */
export const TRAIL_MAX_LAG_TICKS = 30;
/** The farthest a follower moves in one tick, in canvas units, so a long way is covered in many small hops. */
export const TRAIL_STEP = 22;

/**
 * The order the followers line up in behind the leader: the one nearest the
 * leader first, then each next one nearest the one before it, like a chain.
 */
export function trailOrder(leaderId: string, starts: Map<string, Pt>): string[] {
  const left = new Set(Array.from(starts.keys()).filter((id) => id !== leaderId));
  const order: string[] = [];
  let from = starts.get(leaderId);
  while (from && left.size) {
    let best: string | null = null;
    let bestDist = Infinity;
    for (const id of left) {
      const p = starts.get(id)!;
      const d = Math.hypot(p.x - from.x, p.y - from.y);
      if (d < bestDist) {
        best = id;
        bestDist = d;
      }
    }
    order.push(best!);
    left.delete(best!);
    from = starts.get(best!);
  }
  return order;
}

/** How many ticks the follower at place `index` (0 = right behind the leader) of `count` trails the leader. */
export function trailLag(index: number, count: number): number {
  const perStep = Math.min(TRAIL_LAG_TICKS, TRAIL_MAX_LAG_TICKS / Math.max(1, count));
  return Math.max(1, Math.round((index + 1) * perStep));
}

/** The leader's shift as it was `lag` ticks ago; `history` is oldest first, one entry per tick. */
export function shiftAt(history: Pt[], lag: number): Pt {
  return history[Math.max(0, history.length - 1 - lag)];
}

/** One hop from `from` toward `to`, no longer than `step`. */
export function stepToward(from: Pt, to: Pt, step: number): Pt {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d <= step) return { x: to.x, y: to.y };
  return { x: from.x + (dx / d) * step, y: from.y + (dy / d) * step };
}
