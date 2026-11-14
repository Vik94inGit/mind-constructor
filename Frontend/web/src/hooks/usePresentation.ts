import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CanvasModeAction } from "./useCanvasMode";
import { applySlideOrder, computeSlideGroups, computeSlideOrder } from "../utils/presentation";
import { filterByTypes } from "../utils/mapSummary";
import { collectDescendants } from "../utils/mapGraph";
import type { NodeDoc, NodeType } from "../types";
import { feature } from "../utils/usage";

interface Params {
  visibleNodes: NodeDoc[];
  hiddenBranchIds: Set<string>;
  multiSelectIds: Set<string>;
  /** The stabilized zone/circle's own members, if one is chosen. */
  selectedCircleNodeIds: string[] | undefined;
  ensureNodeText: (ids: string[]) => Promise<Record<string, string>>;
  // Entering clears whatever else is going on — see enterPresentation.
  setMultiSelectIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  dispatchMode: Dispatch<CanvasModeAction>;
  setActionError: (message: string | null) => void;
  emptyMessage: string;
  /** The slide order the map's owner chose (Map.slideOrder); empty / absent: the automatic one. */
  slideOrder?: string[];
}

export function usePresentation({
  visibleNodes,
  hiddenBranchIds,
  multiSelectIds,
  selectedCircleNodeIds,
  ensureNodeText,
  setMultiSelectIds,
  setSelectedId,
  dispatchMode,
  setActionError,
  emptyMessage,
  slideOrder,
}: Params) {
  // Presentation mode: steps through the map's own nodes as slides (see
  // computeSlideOrder/utils/presentation.ts) in a full-screen overlay
  // (map/PresentationOverlay.tsx). The canvas under it is left exactly as
  // it was: no tidying of nodes and no camera moves while presenting, so
  // leaving the presentation lands back on the very view it was started
  // from. (It used to tidy the hidden canvas into an org chart and follow
  // the slides with the camera; on exit the user saw every node slide back
  // from that chart, with the camera parked on a spot that was now empty.)
  // Personal to this viewer/session, not map data.
  const [presenting, setPresenting] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  // Which nodes a presentation is scoped to — null means the whole map.
  // Captured once, in enterPresentation, from whatever was chosen at that
  // moment (multiSelectIds or a stabilized zone/circle — see its own doc
  // comment) rather than read live off that selection state throughout the
  // presentation: entering also clears the selection UI itself (so its own
  // bottom bar doesn't render behind the presentation overlay), which would
  // otherwise erase the very scope slideNodes needs to keep filtering by.
  const [presentationScopeIds, setPresentationScopeIds] = useState<Set<string> | null>(null);
  // The node types the viewer picked in the overlay's type chips: only those
  // show, in the slides and in the summary. Empty means every type.
  const [typeFilter, setTypeFilterState] = useState<NodeType[]>([]);
  function setTypeFilter(types: NodeType[]) {
    setTypeFilterState(types);
    setSlideIndex(0);
  }

  // Everything in the presentation's scope, unanswered ghosts included: the
  // Summary tab (utils/mapSummary.ts) lists a template's questions whether
  // they're answered yet or not, so it reads this rather than slideNodes.
  const scopedNodes = useMemo(() => {
    if (!presenting) return [];
    return visibleNodes.filter(
      (n) =>
        !n.isWeapon &&
        !n.isProtection &&
        !hiddenBranchIds.has(n.nodeId) &&
        (!presentationScopeIds || presentationScopeIds.has(n.nodeId)) &&
        (n.title || n.text || n.prompt),
    );
  }, [presenting, visibleNodes, hiddenBranchIds, presentationScopeIds]);

  // Presentation mode's own slide order and org-chart target positions —
  // see computeSlideOrder/computeGeometrizedPositions (utils/presentation.ts)
  // and the enter/exitPresentation functions below. `visibleNodes` already
  // strips packed-away members; also drops weapon/protection decorator
  // nodes, anything the owner has hidden from members (a presentation is for
  // showing, not attack/defense bookkeeping or a branch deliberately kept
  // out of sight), and — since GET /:mapId/nodes omits a node's own `text`
  // until something backfills it (see ensureNodeText) — any node whose
  // caption is still genuinely empty (no title either) once that backfill
  // has run: a slide with nothing to read on it is worse than not showing
  // it at all. presentationScopeIds (see its own doc comment) narrows the
  // whole map down to a chosen node selection or zone when set. Empty (not
  // just skipped) while `presenting` is false, so nothing here does real
  // work between presentations.
  const slideNodes = useMemo(() => {
    const eligible = filterByTypes(
      scopedNodes.filter((n) => n.title || n.text),
      typeFilter,
    );
    return computeSlideOrder(eligible);
  }, [scopedNodes, typeFilter]);

  // What the overlay steps through: one slide per parent, with its children
  // on the same slide (utils/presentation.ts computeSlideGroups). slideIndex
  // counts these. In the order the owner chose, when they chose one
  // (applySlideOrder: a slide it doesn't name keeps its automatic place).
  const slideGroups = useMemo(() => applySlideOrder(computeSlideGroups(slideNodes), slideOrder), [slideNodes, slideOrder]);

  // Guards an empty selection (nothing eligible to present) rather than
  // entering a blank slideshow; computes the eligible set eagerly, on the
  // toolbar click itself, well before `presenting` flips true and
  // slideNodes' own memo would otherwise recompute it. Also the one place
  // that decides *what* a presentation is scoped to (see
  // presentationScopeIds' own doc comment): whatever's multi-selected wins
  // first, then a stabilized zone/circle, else the whole map — the same
  // "nodes or zones" choice the canvas' own selection tools already offer,
  // reused here rather than inventing a separate picker.
  function enterPresentation() {
    const scopeIds =
      multiSelectIds.size > 0
        ? multiSelectIds
        : selectedCircleNodeIds?.length
          ? collectDescendants(new Set(selectedCircleNodeIds), visibleNodes)
          : null;
    startPresentation(scopeIds);
  }
  // A zone's own menu ("Present this zone"): only that zone, from its parent
  // down through every node below it, castles inside it included, whatever
  // else happens to be selected.
  function presentZone(rootId: string) {
    startPresentation(collectDescendants(new Set([rootId]), visibleNodes));
  }
  function startPresentation(scopeIds: Set<string> | null) {
    feature("presentation");
    const eligible = visibleNodes.filter(
      (n) =>
        !n.isWeapon &&
        !n.isProtection &&
        !hiddenBranchIds.has(n.nodeId) &&
        (!scopeIds || scopeIds.has(n.nodeId)),
    );
    if (eligible.length === 0) {
      setActionError(emptyMessage);
      return;
    }
    // Text is lazily backfilled (see ensureNodeText) — a node the caption
    // list never happened to show yet would otherwise arrive here with an
    // empty n.text, reading as a blank slide until this resolves. Awaited
    // before presenting flips on, so slideNodes' own memo never computes
    // against half-loaded data.
    void ensureNodeText(eligible.map((n) => n.nodeId)).then(() => {
      setPresentationScopeIds(scopeIds);
      setMultiSelectIds(new Set());
      setSlideIndex(0);
      setSelectedId(null);
      dispatchMode({ type: "reset" });
      setPresenting(true);
    });
  }
  function exitPresentation() {
    setPresenting(false);
    setSlideIndex(0);
    setPresentationScopeIds(null);
    setTypeFilterState([]);
  }

  return {
    presenting,
    slideIndex,
    setSlideIndex,
    slideNodes,
    slideGroups,
    summaryNodes: scopedNodes,
    typeFilter,
    setTypeFilter,
    enterPresentation,
    presentZone,
    exitPresentation,
  };
}
