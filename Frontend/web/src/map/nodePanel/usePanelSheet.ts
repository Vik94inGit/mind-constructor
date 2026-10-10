import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

// How much of the panel's own width/height must stay on screen while it's
// being dragged (see the grip handle below) — small enough to shove the
// bulk of the sheet out of the way (e.g. to uncover the bottom-left corner
// it docks over — see ZoneNames), but never so far it can be dragged
// somewhere the user can't grab it again to bring it back.
const PANEL_DRAG_MIN_VISIBLE_PX = 48;

// A person-chosen panel height (see the resize handle/onResizeHandlePointerDown
// below). Not remembered: every chosen node opens the sheet at its default
// half of the screen again (the panel resets it, like dragOffset).
const MIN_PANEL_HEIGHT_PX = 200;
// The Info tab's text box grows and shrinks with the panel while it's being
// resized, and keeps that size — remembered the same way as the panel's.
const TEXT_HEIGHT_STORAGE_KEY = "mc_node_panel_text_height_px";
const MIN_TEXT_HEIGHT_PX = 128; // min-h-[8rem]

function readStoredPx(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
// Left clear at the bottom so the resize handle (and whatever's behind it)
// never becomes fully unreachable by dragging the sheet to fill the screen.
const PANEL_RESIZE_EDGE_MARGIN_PX = 72;

interface Params {
  /** The Info tab's text box — owner's textarea or anyone else's read-only block — which grows and shrinks with the panel. */
  textareaRef: RefObject<HTMLTextAreaElement>;
  readonlyTextRef: RefObject<HTMLDivElement>;
}

// NodePanel's top sheet as something you can move and size: the grip drags it
// off its dock and the bottom edge resizes it — both reset per node by the
// panel itself (setDragOffset, setPanelHeight).
export function usePanelSheet({ textareaRef, readonlyTextRef }: Params) {
  // Lets the whole sheet be dragged off its default bottom-dock, via the
  // grip handle in the JSX below — a plain translate on top of PANEL_CLASS's
  // own fixed inset-x-0 bottom-0 positioning, not a replacement for it (so
  // the sheet still opens docked at the bottom every time, same as before
  // this existed). Reset to {0,0} on every node change, same as every other
  // per-node draft in the effect below — a leftover offset from the last
  // node would otherwise make the sheet reopen already shoved out of the
  // way for a node the user never dragged it for.
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const draggingPanelRef = useRef(false);

  // null means "no override yet" — PANEL_CLASS's own responsive max-height
  // (34dvh/50dvh) still applies, same as before this existed. Once someone
  // drags the resize handle, this becomes a literal height that replaces
  // that cap and sticks around (see the storage effect right below).
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  // null until the panel is first resized with the Info tab open; the box's
  // own CSS size (min-h-[8rem], capped at 40vh) applies until then.
  const [textHeight, setTextHeight] = useState<number | null>(() => readStoredPx(TEXT_HEIGHT_STORAGE_KEY));
  const draggingHeightRef = useRef(false);

  function onResizeHandlePointerDown(e: ReactPointerEvent) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    draggingHeightRef.current = true;
    const startClientY = e.clientY;
    const startHeight = panelRef.current?.getBoundingClientRect().height ?? MIN_PANEL_HEIGHT_PX;
    const maxHeight = window.innerHeight - PANEL_RESIZE_EDGE_MARGIN_PX;
    // The text box (when the Info tab is showing) takes every pixel the
    // panel gains or gives up, so the extra room goes to the text.
    const textBox = textareaRef.current ?? readonlyTextRef.current;
    const startText = textBox?.offsetHeight ?? null;

    function onMove(ev: PointerEvent) {
      if (!draggingHeightRef.current) return;
      // The sheet is top-docked, so dragging its bottom edge down grows it.
      const next = Math.min(maxHeight, Math.max(MIN_PANEL_HEIGHT_PX, startHeight + (ev.clientY - startClientY)));
      setPanelHeight(next);
      if (startText != null) setTextHeight(Math.max(MIN_TEXT_HEIGHT_PX, startText + (next - startHeight)));
    }
    function onUp() {
      draggingHeightRef.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  useEffect(() => {
    if (textHeight == null) return;
    try {
      localStorage.setItem(TEXT_HEIGHT_STORAGE_KEY, String(textHeight));
    } catch {
      // Same as the panel height: the size just won't survive a reload.
    }
  }, [textHeight]);

  function onGripPointerDown(e: ReactPointerEvent) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    draggingPanelRef.current = true;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startOffset = dragOffset;
    // Bounds computed once, off the panel's own untransformed box (offsetWidth/
    // offsetHeight aren't affected by the transform this drag itself applies) —
    // a live measurement per move would be redundant work for a size that
    // never changes mid-drag.
    const panelW = panelRef.current?.offsetWidth ?? 0;
    const panelH = panelRef.current?.offsetHeight ?? 0;
    const minX = PANEL_DRAG_MIN_VISIBLE_PX - panelW;
    const maxX = window.innerWidth - PANEL_DRAG_MIN_VISIBLE_PX;
    // Base (untransformed) top is top-docked: 0. dy is relative to that
    // dock, so its own bounds are expressed the same way maxX/minX are for
    // the left-anchored x axis above.
    const baseTop = 0;
    const minY = PANEL_DRAG_MIN_VISIBLE_PX - panelH - baseTop;
    const maxY = window.innerHeight - PANEL_DRAG_MIN_VISIBLE_PX - baseTop;

    function onMove(ev: PointerEvent) {
      if (!draggingPanelRef.current) return;
      const nextX = Math.min(maxX, Math.max(minX, startOffset.x + (ev.clientX - startClientX)));
      const nextY = Math.min(maxY, Math.max(minY, startOffset.y + (ev.clientY - startClientY)));
      setDragOffset({ x: nextX, y: nextY });
    }
    function onUp() {
      draggingPanelRef.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return { panelRef, dragOffset, setDragOffset, panelHeight, setPanelHeight, textHeight, onResizeHandlePointerDown, onGripPointerDown };
}
