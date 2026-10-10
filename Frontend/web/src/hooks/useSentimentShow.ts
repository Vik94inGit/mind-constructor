import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { computeDominantSentiment } from "../utils/canvasLayout";
import {
  applyRevealFrame,
  computeSentimentShowPlan,
  easeOutCubic,
  revealAmount,
  showEndMs,
  SKIP_MS,
} from "../utils/sentimentShow";
import type { ShowPlan } from "../utils/sentimentShow";
import type { NodeDoc, NodeType } from "../types";

type Pt = { x: number; y: number };

interface Params {
  nodes: NodeDoc[];
  visibleNodes: NodeDoc[];
  positions: Map<string, Pt>;
  // An open pending-create card's armed type counts toward the tally live,
  // so cycling a draft's type can tip the map's majority on its own.
  draftType: NodeType | undefined;
  /** The canvas element every node/zone/link is rendered inside. */
  canvasRef: RefObject<HTMLElement | null>;
  showPoints: (pts: Pt[]) => void;
  showNotice: (message: string) => void;
  positiveMajorityNotice: string;
  negativeMajorityNotice: string;
  /** Off on a Personal map: no majority notice and no show, the map just sits still. Defaults to on. */
  enabled?: boolean;
}

interface Running {
  plan: ShowPlan;
  startedAt: number;
  skip: { at: number; from: Map<string, number> } | null;
}

/**
 * The map's sentiment show: when a map opens (and whenever its majority
 * swings to the other side), every node of the majority type travels toward
 * the center and every node of the minority type toward the edge, one after
 * another; they hold, then from 4s come back one after another. Zones and
 * links are drawn through their nodes, so they stretch and shrink as the
 * nodes go and end in exactly their original shape. Nothing is persisted.
 *
 * Driven like the attack arrows — smooth eased motion at the display's own
 * frame rate — by a requestAnimationFrame loop that writes each frame
 * straight onto the canvas DOM (applyRevealFrame), never through React
 * state, so there are no stepped hops and no whole-map re-renders.
 */
export function useSentimentShow({
  nodes,
  visibleNodes,
  positions,
  draftType,
  canvasRef,
  showPoints,
  showNotice,
  positiveMajorityNotice,
  negativeMajorityNotice,
  enabled = true,
}: Params) {
  const [active, setActive] = useState(false);
  const running = useRef<Running | null>(null);
  const raf = useRef(0);

  function amount(r: Running, id: string, now: number): number {
    if (r.skip) {
      const tau = Math.min(1, (now - r.skip.at) / SKIP_MS);
      return (r.skip.from.get(id) ?? 0) * (1 - easeOutCubic(tau));
    }
    return revealAmount(now - r.startedAt, r.plan.delays.get(id) ?? 0);
  }

  function stop() {
    cancelAnimationFrame(raf.current);
    const root = canvasRef.current;
    if (root) applyRevealFrame(root, () => null);
    running.current = null;
    setActive(false);
  }

  function tick() {
    const r = running.current;
    const root = canvasRef.current;
    if (!r || !root) return;
    const now = performance.now();
    applyRevealFrame(root, (id) => {
      const v = r.plan.vectors.get(id);
      if (!v) return null;
      const s = amount(r, id, now);
      return s > 0 ? { x: v.x * s, y: v.y * s } : null;
    });
    const done = r.skip ? now - r.skip.at >= SKIP_MS : now - r.startedAt >= showEndMs(r.plan);
    if (done) stop();
    else raf.current = requestAnimationFrame(tick);
  }

  /** Cut the show short: every node settles home quickly from wherever it is. */
  function skip() {
    const r = running.current;
    if (!r || r.skip) return;
    const now = performance.now();
    const from = new Map<string, number>();
    for (const id of r.plan.vectors.keys()) from.set(id, amount(r, id, now));
    r.skip = { at: now, from };
  }

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      running.current = null;
    },
    [],
  );

  const dominantSentiment = useMemo(
    () => computeDominantSentiment(draftType ? [...nodes, { type: draftType }] : nodes),
    [nodes, draftType],
  );
  const loaded = visibleNodes.length > 0;
  const openedRef = useRef(false);
  const prevSentimentRef = useRef<"positive" | "negative" | "tie">("tie");

  useEffect(() => {
    if (!loaded) return;
    const prev = prevSentimentRef.current;
    prevSentimentRef.current = dominantSentiment;
    const opening = !openedRef.current;
    openedRef.current = true;
    if (!enabled) return;
    if (dominantSentiment === "tie") return; // no majority, nothing to show
    if (!opening && dominantSentiment === prev) return;
    showNotice(dominantSentiment === "negative" ? negativeMajorityNotice : positiveMajorityNotice);
    if (running.current) return;
    const plan = computeSentimentShowPlan(visibleNodes, positions, dominantSentiment);
    if (plan.vectors.size === 0) return;
    // Both ends of every trip in view, so the show never plays off-screen.
    showPoints(
      Array.from(plan.vectors.entries()).flatMap(([id, v]) => {
        const p = positions.get(id)!;
        return [p, { x: p.x + v.x, y: p.y + v.y }];
      }),
    );
    running.current = { plan, startedAt: performance.now(), skip: null };
    setActive(true);
    raf.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dominantSentiment, loaded]);

  return { skip, active };
}
