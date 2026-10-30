import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import { ApiRequestError } from "../api/client";
import { resizePicture, PICTURE_RESIZE_STEP } from "../utils/pictures";
import type { PictureGroup } from "../utils/pictures";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

interface Params {
  pictures: PictureGroup[];
  posFor: (node: NodeDoc) => Pt;
  upsertNode: (node: NodeDoc) => void;
  /** Puts the dots' old spots on the undo stack (hooks/useMoveUndo.ts). */
  recordMove: (before: NodeDoc[]) => void;
  setMultiSelectIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setMoveMode: Dispatch<SetStateAction<boolean>>;
  setActionError: (message: string | null) => void;
  errorMessage: string;
}

// A drawn picture handled as one thing (docs/gestures/picture-resize.md): a
// tap on its caption opens a small bar to make the whole picture bigger or
// smaller, or to pick all its dots so a drag moves it as one.
export function usePictureEdit({
  pictures,
  posFor,
  upsertNode,
  recordMove,
  setMultiSelectIds,
  setSelectedId,
  setMoveMode,
  setActionError,
  errorMessage,
}: Params) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = pictures.find((g) => g.id === openId) ?? null;
  // The picture went away (its dots deleted, or the view changed): the bar goes with it.
  useEffect(() => {
    if (openId && !open) setOpenId(null);
  }, [openId, open]);

  // Escape, or a press anywhere but the caption and its bar, closes the bar.
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("[data-picture-caption]")) setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [openId]);

  const dotsOf = (g: PictureGroup) => [...g.byDot.values()];
  const spotsOf = (g: PictureGroup) => dotsOf(g).map(posFor);

  /** Where the open picture's dots would go one step bigger (1) or smaller (-1); null when it can't. */
  function nextSize(direction: 1 | -1): Pt[] | null {
    if (!open) return null;
    return resizePicture(spotsOf(open), direction > 0 ? PICTURE_RESIZE_STEP : 1 / PICTURE_RESIZE_STEP);
  }

  async function resize(direction: 1 | -1) {
    const g = open;
    const next = nextSize(direction);
    if (!g || !next) return;
    const dots = dotsOf(g);
    setActionError(null);
    recordMove(dots);
    // Shown straight away; each dot glides there (usePositionGlide).
    dots.forEach((n, i) => upsertNode({ ...n, x: next[i].x, y: next[i].y }));
    try {
      const saved = await Promise.all(dots.map((n, i) => nodesApi.updateNode(n.nodeId, { x: next[i].x, y: next[i].y })));
      saved.forEach((n) => upsertNode(n));
    } catch (err) {
      dots.forEach((n) => upsertNode(n));
      setActionError(err instanceof ApiRequestError ? err.message : errorMessage);
    }
  }

  // Picks every dot, in Move mode, so dragging any one moves the whole
  // picture along (the group drag in useNodeDragAndDrop).
  function moveWhole() {
    if (!open) return;
    setSelectedId(null);
    setMultiSelectIds(new Set(dotsOf(open).map((n) => n.nodeId)));
    setMoveMode(true);
    setOpenId(null);
  }

  return {
    openPicture: open,
    openPictureBar: (id: string) => setOpenId(id),
    closePictureBar: () => setOpenId(null),
    canGrow: !!nextSize(1),
    canShrink: !!nextSize(-1),
    resizePicture: resize,
    movePicture: moveWhole,
  };
}
