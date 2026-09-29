import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { computeDominantSentiment } from "../utils/canvasLayout";
import type { NodeGroup } from "../utils/canvasLayout";
import { computeSentimentShowVectors, REVEAL_VAR } from "../utils/sentimentShow";
import type { NodeDoc, NodeType } from "../types";

type Pt = { x: number; y: number };

// Travel out, then hold at the peak until HOLD_UNTIL_MS after the start,
// then travel home — about five seconds end to end.
export const OUT_S = 1.8;
export const HOLD_UNTIL_MS = 4000;
export const BACK_S = 1.2;
// A click anywhere cuts it short with a quick settle home instead.
export const SKIP_S = 0.45;
// Gentle launch, soft landing — the whole trip stays visible rather than
// front-loading the motion into the first few frames.
const EASE = "cubic-bezier(0.45, 0, 0.25, 1)";
const SKIP_EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

type Phase = "idle" | "prep" | "out" | "back" | "skip";

interface Params {
  nodes: NodeDoc[];
  visibleNodes: NodeDoc[];
  positions: Map<string, Pt>;
  nodeGroups: NodeGroup[];
  // An open pending-create card's armed type counts toward the tally live,
  // so cycling a draft's type can tip the map's majority on its own.
  draftType: NodeType | undefined;
  showPoints: (pts: Pt[]) => void;
  showNotice: (message: string) => void;
  positiveMajorityNotice: string;
  negativeMajorityNotice: string;
}

/**
 * The map's sentiment show: when a map opens (and again whenever its
 * positive-vs-negative majority swings), positive bodies travel toward the
 * center and negative ones toward the edge, hold there, then return to
 * exactly where they really are — nothing is ever persisted.
 *
 * Same technique the attack arrows use (weapon-arrow-fly/weapon-fly-in in
 * index.css): a CSS animation of `transform`, eased by the browser itself,
 * not React state stepped through a few discrete hops. Here it's a single
 * registered custom property (REVEAL_VAR) transitioned on the canvas, which
 * every node, zone, ring, link and bow reads through calc() — so all of them
 * move on one clock, frame-perfectly in sync, with no per-frame JS at all.
 * This hook only flips that one number at four moments (start, out, back,
 * done) and hands out each node's travel vector.
 */
export function useSentimentShow({
  nodes,
  visibleNodes,
  positions,
  nodeGroups,
  draftType,
  showPoints,
  showNotice,
  positiveMajorityNotice,
  negativeMajorityNotice,
}: Params) {
  const [vectors, setVectors] = useState<Map<string, Pt> | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafs = useRef<number[]>([]);

  function go(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function clearScheduled() {
    timers.current.forEach(clearTimeout);
    rafs.current.forEach(cancelAnimationFrame);
    timers.current = [];
    rafs.current = [];
  }

  function finish() {
    clearScheduled();
    setVectors(null);
    go("idle");
  }

  function start(next: Map<string, Pt>) {
    if (phaseRef.current !== "idle") return;
    setVectors(next);
    // Vectors land first with the number still at 0 (nothing visibly moves),
    // then it flips to 1 two frames later — the transition needs a committed
    // "before" value to animate from.
    go("prep");
    const startedAt = performance.now();
    rafs.current.push(
      requestAnimationFrame(() => {
        rafs.current.push(
          requestAnimationFrame(() => {
            go("out");
            const backIn = Math.max(0, HOLD_UNTIL_MS - (performance.now() - startedAt));
            timers.current.push(
              setTimeout(() => {
                go("back");
                timers.current.push(setTimeout(finish, BACK_S * 1000 + 50));
              }, backIn),
            );
          }),
        );
      }),
    );
  }

  /** Cut the show short: everything settles home quickly from wherever it is. */
  function skip() {
    const p = phaseRef.current;
    if (p === "idle" || p === "skip") return;
    clearScheduled();
    if (p === "prep") {
      finish();
      return;
    }
    go("skip");
    timers.current.push(setTimeout(finish, SKIP_S * 1000 + 50));
  }

  useEffect(() => () => clearScheduled(), []);

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
    const swung = dominantSentiment !== prev && dominantSentiment !== "tie";
    if (!opening && !swung) return;
    if (swung) showNotice(dominantSentiment === "negative" ? negativeMajorityNotice : positiveMajorityNotice);
    if (phaseRef.current !== "idle") return;
    const next = computeSentimentShowVectors(visibleNodes, positions, nodeGroups);
    if (next.size === 0) return;
    // Both ends of every trip in view, so the show never plays off-screen.
    showPoints(
      Array.from(next.entries()).flatMap(([id, v]) => {
        const p = positions.get(id)!;
        return [p, { x: p.x + v.x, y: p.y + v.y }];
      }),
    );
    start(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dominantSentiment, loaded]);

  const canvasStyle = useMemo<CSSProperties>(() => {
    const value = phase === "out" ? 1 : 0;
    const transition =
      phase === "out"
        ? `${REVEAL_VAR} ${OUT_S}s ${EASE}`
        : phase === "back"
          ? `${REVEAL_VAR} ${BACK_S}s ${EASE}`
          : phase === "skip"
            ? `${REVEAL_VAR} ${SKIP_S}s ${SKIP_EASE}`
            : "none";
    return { [REVEAL_VAR]: value, transition } as CSSProperties;
  }, [phase]);

  return {
    /** This node's travel vector for the running show, or null when it isn't moving. */
    vectorFor: (nodeId: string): Pt | null => vectors?.get(nodeId) ?? null,
    canvasStyle,
    skip,
    active: phase !== "idle",
  };
}
