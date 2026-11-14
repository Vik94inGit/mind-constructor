import { useEffect, useMemo, useRef } from "react";
import { hiddenLevelIds, levelLocks, revealedRound } from "../utils/templateLevels";
import type { LevelLock } from "../utils/templateLevels";
import type { NodeDoc } from "../types";

// A leveled template's rounds (utils/templateLevels.ts) as the canvas shows
// them: a later round stays off the map until the one before it is done, and
// when it comes up the user is told (`onReveal`), so answering the last
// question of a round is met with the next one rather than with nothing.
// The first look at a map tells nothing: only a round opening while it's open.
export function useLevelReveal(
  nodes: NodeDoc[],
  onReveal: (round: { level: number; count: number }) => void,
): { locks: Map<string, LevelLock>; hidden: Set<string> } {
  const locks = useMemo(() => levelLocks(nodes), [nodes]);
  const hidden = useMemo(() => hiddenLevelIds(nodes, locks), [nodes, locks]);
  const before = useRef<Set<string> | null>(null);
  const reveal = useRef(onReveal);
  reveal.current = onReveal;
  useEffect(() => {
    const was = before.current;
    before.current = hidden;
    if (!was) return;
    const round = revealedRound(was, hidden, nodes);
    if (round) reveal.current(round);
    // `hidden` changes whenever what's hidden does; `nodes` alone doesn't matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);
  return { locks, hidden };
}
