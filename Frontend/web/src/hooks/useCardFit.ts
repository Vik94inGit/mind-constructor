import { useEffect, useRef, useState } from "react";
import { branchParentIds, foldAway } from "../utils/autoPack";
import type { FoldedParents } from "../utils/autoPack";
import { cardsFitScreen, openOnly, planCardFit, zoneSteps } from "../utils/cardFit";
import type { Screen } from "../utils/cardFit";
import { readingOrder } from "../utils/nodeOrder";
import type { NodeDoc } from "../types";

// A card not drawn yet (packed into its parent) is guessed at the others' size.
const DEFAULT_CARD = { w: 200, h: 60 };

/** The cards view stepping zone by zone: the top ideas first (TOP_ZONE), then each parent's zone. */
export const TOP_ZONE = "";

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
  /** The zone shown on its own while stepping (TOP_ZONE, or its parent's id), or null when not stepping — MapPage holds it, since what it draws reads it. */
  zone: string | null;
  setZone: (zone: string | null) => void;
}

/**
 * Keeps the cards view to what fits the screen (utils/cardFit.ts). On opening
 * it, and whenever the number of cards changes there, cards that don't fit
 * at a readable size are shown one zone at a time, in the order the outline
 * reads: the top ideas first, then each parent with the cards hanging from it,
 * stepped through with back and next (and a card's +N jumps to its zone);
 * if even the top ideas don't fit, the warning names the ones past what fits
 * so they can go to another map. Outside stepping, a +N opens just that
 * branch and packs the rest, when opening it alone wouldn't fit.
 */
export function useCardFit({ active, ready, nodes, folded, setFolded, toggleFold, viewportRef, onRefolded, zone, setZone }: Params) {
  const [warning, setWarning] = useState<CardFitWarning | null>(null);
  // The card count last checked, so the viewer's own opening of a branch isn't undone.
  const checkedCount = useRef<number | null>(null);

  // Every zone in reading order, the top ideas first.
  const steps = zoneSteps(nodes);
  const allSteps = [TOP_ZONE, ...steps];

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
      if (zone !== null) setZone(null);
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
      if (zone !== null) setZone(null);
      return setWarning(null);
    }
    setWarning(plan.kind === "packed" ? { kind: "packed" } : { kind: "tooMany", extraRootIds: plan.extraRootIds });
    showZone(zone !== null && (zone === TOP_ZONE || steps.includes(zone)) ? zone : TOP_ZONE);
  });

  /** Shows one zone on its own: the top ideas, or a parent and the cards hanging from it. */
  function showZone(next: string) {
    const parents = branchParentIds(nodes);
    if (next !== TOP_ZONE) parents.delete(next);
    setFolded(parents);
    setZone(next);
    onRefolded?.();
  }

  /** Steps to the zone before (-1) or after (1) the one shown. */
  function step(dir: -1 | 1) {
    const i = zone === null ? 0 : allSteps.indexOf(zone);
    const next = allSteps[Math.max(0, Math.min(allSteps.length - 1, i + dir))];
    if (next !== undefined && next !== zone) showZone(next);
  }

  /** Stops stepping: every branch stays packed, the whole board in view. */
  function stopStepping() {
    setWarning(null);
    if (zone === null) return;
    setFolded(branchParentIds(nodes));
    setZone(null);
    onRefolded?.();
  }

  /**
   * A card's +N: while stepping, shows that branch's zone; otherwise opens it
   * alone when that fits, else it and its parents only. The cards are laid
   * close again.
   */
  function openBranch(parentId: string) {
    if (active && zone !== null && steps.includes(parentId)) return showZone(parentId);
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

  return {
    warning,
    dismissWarning: stopStepping,
    openBranch,
    stepping: zone !== null,
    /** Which zone is shown (0 = the top ideas) out of how many. */
    stepAt: zone === null ? 0 : Math.max(0, allSteps.indexOf(zone)),
    stepCount: allSteps.length,
    step,
  };
}
