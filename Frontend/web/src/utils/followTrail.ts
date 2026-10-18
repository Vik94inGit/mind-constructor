// A selection dragged as a group moves like a creature: the node under the
// finger leads, and every other member walks the path the leader took, each a
// few ticks behind the one before it and in small hops, so the group strings
// out behind the finger and gathers back up when it stops (useNodeDragAndDrop).
// Used for a dragged selection (a zone picked whole, or any group) and for
// cards glued together.

type Pt = { x: number; y: number };

/** How often the followers take a step. */
export const TRAIL_TICK_MS = 40;
/** Ticks each follower trails the one in front of it. */
export const TRAIL_LAG_TICKS = 5;
/** The last follower never trails the leader by more than this many ticks, however long the line. */
export const TRAIL_MAX_LAG_TICKS = 40;
/** The farthest a follower moves in one tick, in canvas units, so a long way is covered in many small hops. */
export const TRAIL_STEP = 26;

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

/** Followers hop on one tick in this many, each on its own beat, so the line moves in a ripple of small jumps rather than a glide. */
export const TRAIL_HOP_EVERY = 3;

/** Whether the follower at place `index` hops on tick number `tick`. */
export function hopsOn(tick: number, index: number): boolean {
  return (tick + index) % TRAIL_HOP_EVERY === 0;
}

export interface Trail {
  /** The leader has moved this far from where it started; it is drawn there at once. */
  lead(shift: Pt): void;
  /** The drop: the leader sits at `leaderShift`, and each follower walks on to its own spot in `targets`. Resolves once all of them are there. */
  land(leaderShift: Pt, targets: Map<string, Pt>): Promise<void>;
  /** Stop at once, wherever everyone is (a cancelled drag, an unmount, a new drag). */
  stop(): void;
}

/**
 * Runs the follow-the-leader walk for a group whose members start at
 * `starts`: `onFrame` gets every member's drawn spot each time it changes.
 * With `smooth` off (reduced motion) the followers keep their place against
 * the leader rigidly instead.
 */
export function startTrail(leaderId: string, starts: Map<string, Pt>, smooth: boolean, onFrame: (shown: Map<string, Pt>) => void): Trail {
  const leaderStart = starts.get(leaderId)!;
  const followers = trailOrder(leaderId, starts);
  const lags = new Map(followers.map((id, i) => [id, smooth ? trailLag(i, followers.length) : 0]));
  const maxLag = Math.max(0, ...lags.values());
  let leaderShift: Pt = { x: 0, y: 0 };
  const history: Pt[] = [leaderShift];
  const shown = new Map(starts);
  let targets: Map<string, Pt> | null = null;
  let settled: (() => void) | null = null;
  let tickNo = 0;
  const frame = () => onFrame(new Map(shown));

  function tick() {
    tickNo++;
    history.push(leaderShift);
    if (history.length > maxLag + 2) history.shift();
    let done = true;
    followers.forEach((id, i) => {
      const start = starts.get(id)!;
      const lagged = shiftAt(history, lags.get(id)!);
      // Caught up with the drop: head for its own landing spot, which the
      // overlap nudge may have moved off the plain shape.
      const goal = targets && lagged === leaderShift ? targets.get(id)! : { x: start.x + lagged.x, y: start.y + lagged.y };
      const from = shown.get(id)!;
      const at = !smooth ? goal : hopsOn(tickNo, i) ? stepToward(from, goal, TRAIL_STEP) : from;
      shown.set(id, at);
      if (at.x !== goal.x || at.y !== goal.y || goal !== targets?.get(id)) done = false;
    });
    frame();
    if (targets && done) stop();
  }
  const timer = setInterval(tick, TRAIL_TICK_MS);

  function stop() {
    clearInterval(timer);
    settled?.();
    settled = null;
  }

  return {
    lead(shift) {
      leaderShift = shift;
      shown.set(leaderId, { x: leaderStart.x + shift.x, y: leaderStart.y + shift.y });
      frame();
    },
    land(shift, finalTargets) {
      return new Promise<void>((resolve) => {
        settled = resolve;
        leaderShift = shift;
        targets = finalTargets;
        shown.set(leaderId, finalTargets.get(leaderId) ?? { x: leaderStart.x + shift.x, y: leaderStart.y + shift.y });
        frame();
        if (!followers.length) stop();
      });
    },
    stop,
  };
}
