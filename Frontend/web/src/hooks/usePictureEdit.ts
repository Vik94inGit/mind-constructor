import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import { ApiRequestError } from "../api/client";
import {
  drawingSpots,
  pictureCardOffsets,
  pictureSizeLimits,
  pictureSpots,
  resizePicture,
  PICTURE_RESIZE_STEP,
} from "../utils/pictures";
import type { PictureGroup } from "../utils/pictures";
import type { NodeDoc, ZonePaletteColor } from "../types";

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

  /**
   * Where the open picture's dots would go one step bigger (1) or smaller
   * (-1), and the drawing's new size for a picture drawn on its own; null
   * when it can't. A picture drawn on its own grows or shrinks its drawing,
   * and its cards are laid round it afresh (docs/gestures/picture-projection.md).
   */
  function nextSize(direction: 1 | -1): { spots: Pt[]; size?: number } | null {
    if (!open) return null;
    const factor = direction > 0 ? PICTURE_RESIZE_STEP : 1 / PICTURE_RESIZE_STEP;
    if (open.size) {
      const size = Math.round(open.size * factor * 10) / 10;
      const { min, max } = pictureSizeLimits(open.def);
      if (size < min || size > max) return null;
      const drawn = drawingSpots(open.def, { x: 0, y: 0 }, open.size);
      // The drawing's own middle, back from where its dots are drawn.
      const [dot0, at0] = [...pictureSpots(open, posFor).entries()][0];
      const middle = { x: at0.x - drawn[dot0].x, y: at0.y - drawn[dot0].y };
      const offsets = pictureCardOffsets(open.def, size);
      const spots = dotsOf(open).map((n) => {
        const o = offsets[n.picture?.dot ?? 0];
        return { x: Math.round(middle.x + o.x), y: Math.round(middle.y + o.y) };
      });
      return { spots, size };
    }
    const spots = resizePicture(spotsOf(open), factor);
    return spots ? { spots } : null;
  }

  async function resize(direction: 1 | -1) {
    const g = open;
    const step = nextSize(direction);
    if (!g || !step) return;
    const { spots: next, size } = step;
    const dots = dotsOf(g);
    setActionError(null);
    // Undo only puts spots back, not a drawing's size, so a picture drawn on
    // its own is put back with the other button instead.
    if (!size) recordMove(dots);
    // Shown straight away; each dot glides there (usePositionGlide).
    dots.forEach((n, i) =>
      upsertNode({
        ...n,
        x: next[i].x,
        y: next[i].y,
        ...(size && n.picture ? { picture: { ...n.picture, size } } : {}),
      }),
    );
    try {
      const saved = await Promise.all(
        dots.map((n, i) => nodesApi.updateNode(n.nodeId, { x: next[i].x, y: next[i].y, ...(size ? { pictureSize: size } : {}) })),
      );
      saved.forEach((n) => upsertNode(n));
    } catch (err) {
      dots.forEach((n) => upsertNode(n));
      setActionError(err instanceof ApiRequestError ? err.message : errorMessage);
    }
  }

  // The picture's fill (Node.picture.color), saved on every dot so each one
  // carries it, the way the dots already share the picture's id.
  async function setColor(color: ZonePaletteColor | null) {
    const g = open;
    if (!g || g.color === color) return;
    const dots = dotsOf(g);
    setActionError(null);
    dots.forEach((n) => upsertNode({ ...n, picture: n.picture ? { ...n.picture, color } : n.picture }));
    try {
      const saved = await Promise.all(dots.map((n) => nodesApi.updateNode(n.nodeId, { pictureColor: color })));
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
    setPictureColor: setColor,
  };
}
