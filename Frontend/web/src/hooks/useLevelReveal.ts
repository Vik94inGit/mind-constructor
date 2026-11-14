import { useEffect, useMemo, useRef } from "react";
import { hiddenLevelIds, levelLocks, revealedRound, templateProgress } from "../utils/templateLevels";
import type { LevelLock, TemplateProgress } from "../utils/templateLevels";
import { track } from "../utils/usage";
import type { NodeDoc } from "../types";

// A leveled template's rounds (utils/templateLevels.ts) as the canvas shows
// them: a later round stays off the map until the one before it is done, and
// when it comes up the user is told (`onReveal`), so answering the last
// question of a round is met with the next one rather than with nothing.
// Answering the very last round is met too (`onFinished`).
// The first look at a map tells nothing: only a change while it's open.
export function useLevelReveal(
  nodes: NodeDoc[],
  onReveal: (round: { level: number; count: number }) => void,
  onFinished?: (levels: number) => void,
): { locks: Map<string, LevelLock>; hidden: Set<string>; progress: Map<string, TemplateProgress> } {
  const locks = useMemo(() => levelLocks(nodes), [nodes]);
  const hidden = useMemo(() => hiddenLevelIds(nodes, locks), [nodes, locks]);
  const progress = useMemo(() => templateProgress(nodes), [nodes]);
  const before = useRef<Set<string> | null>(null);
  const wasDone = useRef<Map<string, boolean> | null>(null);
  const reveal = useRef(onReveal);
  reveal.current = onReveal;
  const finished = useRef(onFinished);
  finished.current = onFinished;

  useEffect(() => {
    const was = before.current;
    before.current = hidden;
    if (!was) return;
    const round = revealedRound(was, hidden, nodes);
    if (!round) return;
    track({ name: "template_level_opened", props: { level: String(round.level) } });
    reveal.current(round);
    // `hidden` changes whenever what's hidden does; `nodes` alone doesn't matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);

  useEffect(() => {
    const was = wasDone.current;
    wasDone.current = new Map([...progress].map(([root, p]) => [root, p.done]));
    if (!was) return;
    for (const [root, p] of progress) {
      // Only a template seen unfinished a moment ago: not one grown already done, nor one just loaded.
      if (!p.done || was.get(root) !== false) continue;
      track({ name: "template_finished", props: { levels: String(p.levels) } });
      finished.current?.(p.levels);
      return;
    }
  }, [progress]);

  return { locks, hidden, progress };
}
