import { useEffect, useMemo, useRef, useState } from "react";
import { computeDominantSentiment, computeMajoritySwap } from "../utils/canvasLayout";
import type { NodeGroup } from "../utils/canvasLayout";
import { sleep } from "../utils/sleep";
import type { NodeDoc, NodeType } from "../types";

type Pt = { x: number; y: number };

// Same staggered-hop shape as the group-drag catch-up (see
// onNodePointerDown), just slower/more spread out: this is a rare,
// dramatic, whole-map event rather than the tail end of a quick drag
// release, so it reads better drawn out rather than snapped through as fast
// as possible. Staggered between units (each solo node or whole circle
// group is one unit — see computeMajoritySwap's own doc comment), never
// within one: every id inside a single unit shares the exact same
// step/timing, moving in lockstep so a circle's own shape never distorts
// mid-animation.
const MAJORITY_SWAP_STEPS = 5;
const MAJORITY_SWAP_STEP_DELAY_MS = 160;
const MAJORITY_SWAP_STAGGER_MS = 70;

interface Params {
  nodes: NodeDoc[];
  positions: Map<string, Pt>;
  nodeGroups: NodeGroup[];
  // The type currently armed on an open pending-create card, if any — folded
  // into the sentiment tally live as a lightweight { type } entry (not a
  // real NodeDoc, since it isn't one yet), so the map reacts the instant
  // someone cycles a draft's type, without waiting for them to actually
  // confirm it into a real node first. Only ever affects the tally itself:
  // computeMajoritySwap below is still handed the real `nodes` array alone,
  // so the not-yet-created draft is never a move target, only ever the
  // thing that can tip real nodes into moving.
  draftType: NodeType | undefined;
  showPoints: (pts: Pt[]) => void;
  showNotice: (message: string) => void;
  positiveMajorityNotice: string;
  negativeMajorityNotice: string;
}

// Majority-swap auto-reposition: whenever the map's own negative-vs-positive
// sentiment tally (computeDominantSentiment) swings to a new decisive side,
// every unit on that side glides toward the canvas's own center and every
// unit on the losing side glides toward the edge (computeMajoritySwap) —
// purely a render-time overlay (majoritySwapState, consumed by MapPage's own
// posFor), never written back to a node's real, stored x/y. Preempted
// outright by a real user gesture on any node — see cancelMajoritySwap,
// called from onNodePointerDown before every other drag branch.
export function useMajoritySwap({
  nodes,
  positions,
  nodeGroups,
  draftType,
  showPoints,
  showNotice,
  positiveMajorityNotice,
  negativeMajorityNotice,
}: Params) {
  // Purely a render overlay: real node.x/y is never touched by this hook —
  // a node's stored position stays exactly where the user actually left it,
  // so this can stay showing indefinitely without ever costing the user
  // anything.
  const [majoritySwapState, setMajoritySwapState] = useState<Map<string, Pt> | null>(null);
  // Mirrors majoritySwapState for the effect below to read synchronously —
  // the effect only depends on [dominantSentiment], so closing back over the
  // state variable itself would see a stale snapshot from whenever the
  // effect was last (re)created, not whatever the in-flight animation has
  // actually drawn since. Needed so a sentiment swing that arrives while an
  // earlier swap animation is still easing in starts from wherever the node
  // visually is right now, not from its true stored position — jumping back
  // to storage first, then back out to the new target, would read as a
  // stutter instead of one continuous glide.
  const majoritySwapStateRef = useRef<Map<string, Pt> | null>(null);
  useEffect(() => {
    majoritySwapStateRef.current = majoritySwapState;
  }, [majoritySwapState]);
  // Cancellation token — bumped (and majoritySwapState cleared) the moment
  // any node is pointer-downed (see cancelMajoritySwap), so a real user
  // gesture always preempts this effect outright rather than the two
  // fighting over the same nodes.
  const majoritySwapToken = useRef(0);

  const dominantSentiment = useMemo(() => {
    const tally = draftType ? [...nodes, { type: draftType }] : nodes;
    return computeDominantSentiment(tally);
  }, [nodes, draftType]);
  // Seeded with "tie" (not the initial value) — a map that already opens
  // with one side ahead now plays the reveal animation on open too, same as
  // any later swing does. Purely visual and repeatable (nothing is ever
  // persisted here), so there's no downside to it running every time the
  // map is opened — that's the point, it's meant to be pleasant to watch
  // settle in each time you look at it.
  const prevDominantSentimentRef = useRef<"positive" | "negative" | "tie">("tie");

  useEffect(() => {
    const prev = prevDominantSentimentRef.current;
    prevDominantSentimentRef.current = dominantSentiment;
    if (dominantSentiment === prev) return;

    const token = ++majoritySwapToken.current;

    if (dominantSentiment === "tie") {
      // Swinging back to a tie: glide every currently-displaced node back to
      // its real stored position, then drop the overlay entirely. Nothing to
      // persist either way — the stored position never moved.
      const current = majoritySwapStateRef.current;
      if (!current || current.size === 0) return;
      const ids = Array.from(current.keys());
      const starts = new Map(current);
      void (async () => {
        for (let step = 1; step <= MAJORITY_SWAP_STEPS; step++) {
          if (majoritySwapToken.current !== token) return;
          const frac = step / MAJORITY_SWAP_STEPS;
          setMajoritySwapState((prevState) => {
            const next = new Map(prevState ?? []);
            for (const id of ids) {
              const start = starts.get(id)!;
              const real = positions.get(id);
              if (!real) continue;
              next.set(id, { x: start.x + (real.x - start.x) * frac, y: start.y + (real.y - start.y) * frac });
            }
            return next;
          });
          if (step < MAJORITY_SWAP_STEPS) await sleep(MAJORITY_SWAP_STEP_DELAY_MS);
        }
        if (majoritySwapToken.current === token) setMajoritySwapState(null);
      })();
      return;
    }

    const majoritySentiment = dominantSentiment;
    const { targets, units } = computeMajoritySwap(nodes, positions, nodeGroups, majoritySentiment);
    if (targets.size === 0) return;

    // The whole point of this being visual is watching it happen — on a
    // narrow phone viewport, whatever the user happened to be scrolled to
    // before the sentiment flipped can easily be nowhere near the affected
    // nodes' start *or* end spot, so the glide plays entirely off-screen and
    // reads as "nothing happened." Both endpoints of every moving unit go
    // in, not just the targets, so the camera settles somewhere the whole
    // glide stays visible rather than just where it lands.
    showPoints(Array.from(targets.entries()).flatMap(([id, target]) => [positions.get(id)!, target]));
    showNotice(majoritySentiment === "negative" ? negativeMajorityNotice : positiveMajorityNotice);
    // Seeded with every affected node's own current position (not yet its
    // target) so posFor has a stable value to return the instant this
    // starts, same as the group-drag catch-up's own startPositions seed. An
    // id already showing mid-flight from a still-unwinding earlier swap
    // keeps its current visual spot rather than being reset to storage.
    setMajoritySwapState((prevState) => {
      const seeded = new Map(prevState ?? []);
      for (const id of targets.keys()) {
        if (!seeded.has(id)) seeded.set(id, positions.get(id)!);
      }
      return seeded;
    });

    void (async () => {
      await Promise.all(
        // One entry in `units` per movement unit (a solo node's own single
        // id, or a whole circle's root+members) — staggered against each
        // other, same as the group-drag follow's own per-node stagger, but
        // every id *inside* one unit shares the exact same step/timing
        // (one setMajoritySwapState call per step, covering the whole
        // unit at once) so a circle's own shape never distorts mid-flight.
        units.map(async (ids, i) => {
          if (i > 0) await sleep(i * MAJORITY_SWAP_STAGGER_MS);
          if (majoritySwapToken.current !== token) return;
          // Starts from wherever the node visually is right now (an
          // in-flight earlier swap, or its real position) rather than always
          // its real stored position — see majoritySwapStateRef's own
          // comment for why that avoids a stutter on a fast double-swing.
          const starts = new Map(ids.map((id) => [id, majoritySwapStateRef.current?.get(id) ?? positions.get(id)!]));
          for (let step = 1; step <= MAJORITY_SWAP_STEPS; step++) {
            if (majoritySwapToken.current !== token) return;
            const frac = step / MAJORITY_SWAP_STEPS;
            setMajoritySwapState((prev) => {
              const next = new Map(prev ?? []);
              for (const id of ids) {
                const start = starts.get(id)!;
                const target = targets.get(id)!;
                next.set(id, { x: start.x + (target.x - start.x) * frac, y: start.y + (target.y - start.y) * frac });
              }
              return next;
            });
            if (step < MAJORITY_SWAP_STEPS) await sleep(MAJORITY_SWAP_STEP_DELAY_MS);
          }
        }),
      );
      // Deliberately left set (not nulled) — the swapped layout is purely a
      // render overlay (posFor), so it stays showing for as long as this
      // sentiment keeps its majority. Real node.x/y was never touched, so
      // there's nothing to reconcile: it unwinds only via the "tie" branch
      // above, or gets preempted outright by a real user gesture (see
      // cancelMajoritySwap).
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dominantSentiment]);

  // A real interaction with any node always preempts this effect outright —
  // called unconditionally, ahead of every other early return in
  // onNodePointerDown: the effect fighting a user's own gesture for the same
  // node(s) would be far worse than just stopping early there. No-op if
  // nothing is currently animating.
  function cancelMajoritySwap() {
    if (!majoritySwapState) return;
    majoritySwapToken.current++;
    setMajoritySwapState(null);
  }

  return { majoritySwapState, cancelMajoritySwap };
}
