import { useEffect, useRef, useState } from "react";
import type { NodeDoc } from "../types";
import { sentimentOf } from "../utils/nodeType";

type Pt = { x: number; y: number };

// How much of the way toward the canvas center a positive node migrates on
// open, and how much of the way toward the nearest canvas edge a negative
// one migrates — a fraction of the real distance involved, not a fixed
// pixel amount, so a node already near the center/edge barely moves while
// one at the opposite extreme gets the full dramatic journey. Well short of
// 1 on purpose: full convergence would pile every positive node on the
// exact same point, and full divergence would push negative ones flush
// against the canvas edge.
const IN_FRACTION = 0.55;
const OUT_FRACTION = 0.5;
// Kept clear of the canvas edge outright, same margin EDGE_MARGIN-style
// values elsewhere in this app use — a negative node's target never lands
// exactly on the boundary.
const EDGE_CLEARANCE = 40;

const OUT_DURATION_S = 1.7;
const DWELL_S = 0.5;
const RETURN_DURATION_S = 1.3;
const TOTAL_DURATION_S = OUT_DURATION_S + DWELL_S + RETURN_DURATION_S;
// How long a user-triggered skip takes to settle back to real positions —
// short and snappy, not the reveal's own unhurried return leg.
const SKIP_RETURN_S = 0.4;
// Reveal offsets feed straight into posFor, which every node/zone/edge on
// the canvas renders from — updating that at a throttled ~30fps (half of a
// typical 60Hz display) instead of every single animation frame keeps a
// several-second, whole-map re-render bearable without being a visibly
// choppier migration than the full frame rate would have looked.
const UPDATE_INTERVAL_MS = 1000 / 30;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

// The distance from `from`, heading along the unit vector `dir`, to the
// canvas boundary (minus EDGE_CLEARANCE) — standard ray/box slab method.
// Assumes `from` is already inside the box and `dir` is non-zero.
function distanceToEdge(from: Pt, dir: Pt, canvasW: number, canvasH: number): number {
  const candidates: number[] = [];
  if (dir.x > 0) candidates.push((canvasW - EDGE_CLEARANCE - from.x) / dir.x);
  if (dir.x < 0) candidates.push((EDGE_CLEARANCE - from.x) / dir.x);
  if (dir.y > 0) candidates.push((canvasH - EDGE_CLEARANCE - from.y) / dir.y);
  if (dir.y < 0) candidates.push((EDGE_CLEARANCE - from.y) / dir.y);
  const positive = candidates.filter((v) => v > 0);
  return positive.length > 0 ? Math.min(...positive) : 0;
}

/**
 * The map's own one-time "reveal" on open: every node (positive types
 * pulled toward the canvas center, negative types pushed toward the
 * nearest edge, "unknown"/neutral left alone — see sentimentOf) drifts out
 * from its real position, dwells, and eases back — once, not a loop. Zones
 * and edges never get their own copy of this: they're drawn straight off
 * `posFor` elsewhere in MapPage, so feeding this hook's offsets into that
 * same function is what makes a zone polygon visibly stretch/migrate along
 * with whichever of its members are mid-reveal, entirely as a side effect
 * of the member positions it was already computed from — no separate
 * zone-specific animation of any kind, on purpose (see this feature's own
 * "discard zone movement, move zones only when nodes moving... in sync
 * with nodes" request).
 *
 * A single shared clock drives every node's offset together (`s`, 0..1: how
 * far along its own migration a node currently is) rather than each node
 * independently timed — multiplied by that node's own precomputed target
 * offset, so everything moves out and back in the same rhythm instead of a
 * staggered drift.
 */
export function useMapReveal(
  visibleNodes: NodeDoc[],
  positions: Map<string, Pt>,
  canvasW: number,
  canvasH: number,
  skipTick: number,
) {
  const center = { x: canvasW / 2, y: canvasH / 2 };

  // Each node's target *offset* (not target position) — computed once, off
  // the real positions/sentiments present the first time this hook sees any
  // nodes at all, and never touched again. A node created or dragged
  // mid-reveal (vanishingly rare — this plays for well under
  // TOTAL_DURATION_S right after a map opens) simply won't have an entry
  // and stays put, same as one whose sentiment is neutral.
  const targetsRef = useRef<Map<string, Pt> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const [offsets, setOffsets] = useState<Map<string, Pt>>(new Map());
  const [active, setActive] = useState(false);

  // MapPage calls this hook unconditionally (Rules of Hooks), so its very
  // first render(s) happen before the map's own data has loaded — targets
  // can only be computed, and the reveal only started, once visibleNodes
  // actually has something in it. Runs once (targetsRef.current's own
  // null-check is the real guard — visibleNodes.length is just what wakes
  // this effect back up to check it, not depended on for correctness).
  useEffect(() => {
    if (targetsRef.current !== null || visibleNodes.length === 0) return;
    const targets = new Map<string, Pt>();
    for (const node of visibleNodes) {
      const sentiment = sentimentOf(node.type);
      if (!sentiment) continue;
      const pos = positions.get(node.nodeId);
      if (!pos) continue;
      if (sentiment === "positive") {
        targets.set(node.nodeId, { x: (center.x - pos.x) * IN_FRACTION, y: (center.y - pos.y) * IN_FRACTION });
      } else {
        const dx = pos.x - center.x;
        const dy = pos.y - center.y;
        const dist = Math.hypot(dx, dy) || 1;
        const dir = { x: dx / dist, y: dy / dist };
        const edgeDist = distanceToEdge(pos, dir, canvasW, canvasH);
        targets.set(node.nodeId, { x: dir.x * edgeDist * OUT_FRACTION, y: dir.y * edgeDist * OUT_FRACTION });
      }
    }
    targetsRef.current = targets;
    if (targets.size > 0) {
      startedAtRef.current = performance.now() / 1000;
      setActive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNodes.length]);

  const skippedAtRef = useRef<{ realNow: number; sAtSkip: number } | null>(null);
  // The last skipTick this effect actually reacted to — not just "was this
  // the first render," since this effect's own deps include `active`,
  // which flips true the moment the reveal starts *without* skipTick
  // itself changing. Comparing against the previous skipTick specifically
  // (rather than an isFirstTick-style flag) is what keeps that transition
  // from reading as a click nobody made.
  const lastHandledSkipTick = useRef(skipTick);

  useEffect(() => {
    if (skipTick === lastHandledSkipTick.current) return; // this run wasn't a real click
    lastHandledSkipTick.current = skipTick;
    if (!active || skippedAtRef.current) return; // nothing playing, or already skipping
    const now = performance.now() / 1000;
    // active only ever turns true right after startedAtRef.current is set,
    // in the same effect — never null by the time anything else observes
    // active === true.
    const t = now - startedAtRef.current!;
    skippedAtRef.current = { realNow: now, sAtSkip: revealAmountAt(t) };
  }, [skipTick, active]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let lastUpdateMs = 0;

    function tick(nowMs: number) {
      raf = requestAnimationFrame(tick);
      if (nowMs - lastUpdateMs < UPDATE_INTERVAL_MS) return;
      lastUpdateMs = nowMs;
      const now = nowMs / 1000;

      let s: number;
      const skip = skippedAtRef.current;
      if (skip) {
        const skipT = Math.min(1, (now - skip.realNow) / SKIP_RETURN_S);
        s = skip.sAtSkip * (1 - easeInOutCubic(skipT));
        if (skipT >= 1) {
          setActive(false);
          setOffsets(new Map());
          return;
        }
      } else {
        const t = now - startedAtRef.current!; // see the skip effect's own comment above
        s = revealAmountAt(t);
        if (t >= TOTAL_DURATION_S) {
          setActive(false);
          setOffsets(new Map());
          return;
        }
      }

      const targets = targetsRef.current!;
      const next = new Map<string, Pt>();
      for (const [nodeId, target] of targets) next.set(nodeId, { x: target.x * s, y: target.y * s });
      setOffsets(next);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // active flips false exactly once (this effect's own tick sets it, and
    // never back to true) — intentionally no other dependency, this is a
    // one-shot loop, not a re-startable one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return {
    /** This node's current reveal offset, or null once the reveal is done/wasn't applicable to it. */
    offsetFor: (nodeId: string) => offsets.get(nodeId) ?? null,
    active,
  };
}

function revealAmountAt(t: number): number {
  if (t < OUT_DURATION_S) return easeInOutCubic(t / OUT_DURATION_S);
  if (t < OUT_DURATION_S + DWELL_S) return 1;
  if (t < TOTAL_DURATION_S) return 1 - easeInOutCubic((t - OUT_DURATION_S - DWELL_S) / RETURN_DURATION_S);
  return 0;
}
