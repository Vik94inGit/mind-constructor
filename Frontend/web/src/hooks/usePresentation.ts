import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useRadialBlend } from "./useRadialBlend";
import type { CanvasModeAction, Pt } from "./useCanvasMode";
import { computeSlideOrder, computeGeometrizedPositions } from "../utils/presentation";
import { collectDescendants } from "../utils/mapGraph";
import type { NodeDoc } from "../types";

interface Params {
  visibleNodes: NodeDoc[];
  hiddenBranchIds: Set<string>;
  multiSelectIds: Set<string>;
  /** The stabilized zone/circle's own members, if one is chosen. */
  selectedCircleNodeIds: string[] | undefined;
  posFor: (node: NodeDoc) => Pt;
  centerOnPoint: (x: number, y: number) => void;
  ensureNodeText: (ids: string[]) => Promise<Record<string, string>>;
  // Entering clears whatever else is going on — see enterPresentation.
  setMultiSelectIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  dispatchMode: Dispatch<CanvasModeAction>;
  setActionError: (message: string | null) => void;
  emptyMessage: string;
}

export function usePresentation({
  visibleNodes,
  hiddenBranchIds,
  multiSelectIds,
  selectedCircleNodeIds,
  posFor,
  centerOnPoint,
  ensureNodeText,
  setMultiSelectIds,
  setSelectedId,
  dispatchMode,
  setActionError,
  emptyMessage,
}: Params) {
  // Presentation mode: steps through the map's own nodes as slides (see
  // computeSlideOrder/utils/presentation.ts), with the canvas auto-tidied
  // into a clean org-chart shape for the duration (computeGeometrizedPositions
  // — a display override only, never written back to a node's own stored
  // x/y, same "never touches positions/backend" contract radialPositions
  // below already follows). Personal to this viewer/session, not map data —
  // deliberately NOT the Map.discussionMode server-persisted pattern, and
  // not folded into the useCanvasMode reducer above either: that one is
  // purpose-built for canvas click-interaction semantics (choose/pack/draw),
  // not a full-screen takeover with its own slide index.
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
    if (!presenting) return [];
    const eligible = visibleNodes.filter(
      (n) =>
        !n.isWeapon &&
        !n.isProtection &&
        !hiddenBranchIds.has(n.nodeId) &&
        (!presentationScopeIds || presentationScopeIds.has(n.nodeId)) &&
        (n.title || n.text),
    );
    return computeSlideOrder(eligible);
  }, [presenting, visibleNodes, hiddenBranchIds, presentationScopeIds]);

  const geometrizedPositions = useMemo(
    () => (presenting && slideNodes.length > 0 ? computeGeometrizedPositions(slideNodes) : null),
    [presenting, slideNodes],
  );
  // Same glide-toward-a-target-map-or-back-to-nothing mechanism the radial
  // selection ring already uses (useRadialBlend is fully general — nothing
  // about it is ring/neighbor-specific), reused here as a second,
  // independent instance for the org-chart shape.
  const geometrizeBlend = useRadialBlend(geometrizedPositions);

  // Keeps the camera on the current slide while presenting — including
  // while it's still gliding into its own org-chart spot (this effect
  // re-fires on every geometrizeBlend.blend tick, so it re-centers on the
  // node's own live, still-moving posFor position rather than jump-cutting
  // to the final spot only once the glide finishes). centerOnPoint (not
  // centerOnNode, which deliberately reads a node's raw *stored* position —
  // see its own doc comment) is the right primitive here since there's no
  // single stored position to key off during the glide.
  useEffect(() => {
    if (!presenting || slideNodes.length === 0) return;
    const current = slideNodes[Math.min(slideIndex, slideNodes.length - 1)];
    const p = posFor(current);
    centerOnPoint(p.x, p.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenting, slideIndex, slideNodes, geometrizeBlend.blend]);

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
  }

  return {
    presenting,
    slideIndex,
    setSlideIndex,
    slideNodes,
    geometrizeBlend,
    enterPresentation,
    exitPresentation,
  };
}
