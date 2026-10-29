import { useMemo, useRef, useState } from "react";
import { chompAim, chompersFor, chompMove, chompTargets } from "../utils/pacman";
import type { ChompMove } from "../utils/pacman";
import { nodeSizeMultiplier } from "../utils/nodePriority";
import { nodeZoomScale } from "../utils/canvasLayout";
import { useTapChomp } from "./useTapChomp";
import type { NodeDoc } from "../types";

interface Params {
  visibleNodes: NodeDoc[];
  selectedId: string | null;
  /** The node the ← / → arrows last stepped to: stepping onto an attack doesn't run it. */
  steppedToId: string | null;
  /** Zoomed out to dots: nothing runs. */
  dotZoom: boolean;
  zoom: number;
  compact: boolean;
  isCircleParent: (nodeId: string) => boolean;
  posFor: (node: NodeDoc) => { x: number; y: number };
}

// Pac-Man runs (utils/pacman.ts): a strong attack, or a node a strong attack
// hit, runs its attackers out to what they hit while the pointer rests on it.
export function useChompRuns({ visibleNodes, selectedId, steppedToId, dotZoom, zoom, compact, isCircleParent, posFor }: Params) {
  // The node the pointer rests on, when it starts a run.
  const [chompHoverId, setChompHoverId] = useState<string | null>(null);
  const chompSpots = useMemo(() => chompTargets(visibleNodes), [visibleNodes]);
  // The mouse's hover wins; on a phone, a tap on a strong attack runs it once.
  const tapChompId = useTapChomp(selectedId, steppedToId, visibleNodes);
  const chompIds = useMemo(
    () => chompersFor(chompHoverId ?? tapChompId, visibleNodes),
    [chompHoverId, tapChompId, visibleNodes],
  );
  // Each running attack's way out to what it hit, from where both are drawn
  // now. Sizes are icon radii in canvas units at this zoom. A run whose
  // numbers didn't change keeps its object, so its card isn't redrawn.
  const chompMoveCache = useRef(new Map<string, ChompMove>());
  const chompMoves = new Map<string, ChompMove>();
  if (!dotZoom) {
    const radius = (n: NodeDoc) => 24 * nodeSizeMultiplier(n, isCircleParent(n.nodeId), compact) * nodeZoomScale(zoom);
    for (const id of chompIds) {
      const attack = visibleNodes.find((n) => n.nodeId === id);
      const aim = attack && chompAim(attack, visibleNodes);
      if (!attack || !aim) continue;
      const move = chompMove(posFor(attack), posFor(aim), radius(attack), radius(aim));
      const prev = chompMoveCache.current.get(id);
      const same = prev && (Object.keys(move) as (keyof ChompMove)[]).every((k) => prev[k] === move[k]);
      chompMoves.set(id, same ? prev : move);
    }
  }
  chompMoveCache.current = chompMoves;

  // A card's icon hovered (on) or left (off).
  function hoverChomp(nodeId: string, on: boolean) {
    setChompHoverId((cur) => (on ? nodeId : cur === nodeId ? null : cur));
  }

  return { chompSpots, chompMoves, hoverChomp };
}
