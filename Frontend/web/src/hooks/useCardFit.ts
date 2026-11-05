import { useEffect, useRef, useState } from "react";
import { foldAway } from "../utils/autoPack";
import type { FoldedParents } from "../utils/autoPack";
import { cardsFitScreen, openOnly, planCardFit } from "../utils/cardFit";
import type { Screen } from "../utils/cardFit";
import { readingOrder } from "../utils/nodeOrder";
import type { NodeDoc } from "../types";

// A card not drawn yet (packed into its parent) is guessed at the others' size.
const DEFAULT_CARD = { w: 200, h: 60 };

export type CardFitWarning = { kind: "packed" } | { kind: "tooMany"; extraRootIds: string[] };

interface Params {
  /** The whole map is in the cards view. */
  active: boolean;
  /** Its cards are drawn and measurable (not mid-entrance, replay or presentation). */
  ready: boolean;
  /** The map's nodes that can be cards (no weapons or shields, nothing packed into a container). */
  nodes: NodeDoc[];
  folded: FoldedParents;
  setFolded: (next: FoldedParents) => void;
  toggleFold: (parentId: string) => void;
  /** The scrolling viewport the cards are seen through. */
  viewportRef: { current: HTMLElement | null };
  /** Branches were packed or opened here: the camera can take in what's left. */
  onRefolded?: () => void;
}

/**
 * Keeps the cards view to what fits the screen (utils/cardFit.ts). On opening
 * it, and whenever the number of cards changes there, cards that don't fit
 * at a readable size pack their branches into their parents, with a warning;
 * if even the top cards don't fit, the warning names the ones past what fits
 * so they can go to another map. Opening a packed branch there (its +N) opens
 * just that one and packs the rest, when opening it alone wouldn't fit.
 */
export function useCardFit({ active, ready, nodes, folded, setFolded, toggleFold, viewportRef, onRefolded }: Params) {
  const [warning, setWarning] = useState<CardFitWarning | null>(null);
  // The card count last checked, so the viewer's own opening of a branch isn't undone.
  const checkedCount = useRef<number | null>(null);

  function screen(): Screen | null {
    const el = viewportRef.current;
    if (!el || el.clientWidth === 0 || el.clientHeight === 0) return null;
    return { w: el.clientWidth, h: el.clientHeight };
  }

  function sizer(): (n: NodeDoc) => { w: number; h: number } {
    const measured = new Map<string, { w: number; h: number }>();
    for (const n of nodes) {
      const el = document.querySelector<HTMLElement>(`[data-reveal-node="${CSS.escape(n.nodeId)}"] [data-puzzle-card]`);
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) measured.set(n.nodeId, { w: el.offsetWidth, h: el.offsetHeight });
    }
    const sizes = [...measured.values()];
    const mid = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    const guess = sizes.length ? { w: mid(sizes.map((s) => s.w)), h: mid(sizes.map((s) => s.h)) } : DEFAULT_CARD;
    return (n) => measured.get(n.nodeId) ?? guess;
  }

  useEffect(() => {
    if (!active) {
      checkedCount.current = null;
      setWarning(null);
      return;
    }
    if (!ready || checkedCount.current === nodes.length) return;
    const sc = screen();
    if (!sc || nodes.length === 0) return;
    checkedCount.current = nodes.length;
    const plan = planCardFit(readingOrder(nodes), folded, sizer(), sc);
    if (plan.kind === "fits") {
      // Cards moved off to another map: the ones left are laid close again.
      if (warning) onRefolded?.();
      return setWarning(null);
    }
    setFolded(plan.folded);
    onRefolded?.();
    setWarning(plan.kind === "packed" ? { kind: "packed" } : { kind: "tooMany", extraRootIds: plan.extraRootIds });
  });

  /** Opens a packed branch (its +N): alone when that fits, else it and its parents only; the cards are laid close again. */
  function openBranch(parentId: string) {
    const sc = screen();
    if (!active || !sc || !folded.has(parentId)) return toggleFold(parentId);
    const next = new Set(folded);
    next.delete(parentId);
    const { hidden } = foldAway(nodes, next);
    const sizeOf = sizer();
    const shown = nodes.filter((n) => !hidden.has(n.nodeId)).map((n) => ({ id: n.nodeId, ...sizeOf(n) }));
    setFolded(cardsFitScreen(shown, sc) ? next : openOnly(nodes, parentId));
    onRefolded?.();
  }

  return { warning, dismissWarning: () => setWarning(null), openBranch };
}
