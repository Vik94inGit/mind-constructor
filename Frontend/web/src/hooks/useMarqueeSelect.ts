import { useState } from "react";
import type { Dispatch, MutableRefObject, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

export interface Marquee {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Params {
  /** Choosing, packing or drawing own the canvas clicks — no marquee then. */
  disabled: boolean;
  screenToCanvas: (clientX: number, clientY: number) => Pt;
  nodes: NodeDoc[];
  positions: Map<string, Pt>;
  isOwnNode: (node: NodeDoc) => boolean;
  /** Swallows the trailing native click a finished drag leaves behind. */
  suppressNextClick: MutableRefObject<boolean>;
  setMultiSelectIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
}

export function useMarqueeSelect({
  disabled,
  screenToCanvas,
  nodes,
  positions,
  isOwnNode,
  suppressNextClick,
  setMultiSelectIds,
  setSelectedId,
}: Params) {
  // The rectangle being swept (canvas coordinates) — null outside of an
  // active marquee drag.
  const [marquee, setMarquee] = useState<Marquee | null>(null);

  // Rubber-band (marquee) select: a plain left-button drag started on empty
  // canvas (free to claim — panning is native scroll/trackpad, not a
  // click-drag) sweeps a rectangle and, on release, replaces
  // multiSelectIds with every own, non-weapon node whose position falls
  // inside it. Mirrors onNodePointerDown's own screenToCanvas-based
  // tracking, just for a rectangle instead of a single point.
  function onCanvasPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    // pointerType "touch": a finger-drag on empty canvas is how mobile pans
    // the map at all (the wrap div's own native touch-scroll — there's no
    // trackpad/scrollbar to do it otherwise) — bail out before capturing
    // the pointer so that native scroll can happen, same as this handler
    // simply not existing. Marquee-select is a mouse-drag idea (a
    // rubber-band rectangle) that was only ever "free" to claim on desktop
    // because click-drag on empty canvas did nothing there before (real
    // panning is trackpad/scrollbar-driven); on mobile that same gesture
    // is already spoken for. Tap-to-select/center/ghosts and double-tap-
    // to-edit are unaffected either way — those go through NodeCard's own
    // onClick/onDoubleClick, not this handler, which only ever fires for
    // empty canvas.
    if (disabled || e.button !== 0 || e.pointerType === "touch") return;
    const start = screenToCanvas(e.clientX, e.clientY);
    let moved = false;
    // Read directly off the raw pointer event in onUp, same as
    // onNodePointerDown's own onMove/onUp — React state from onMove's
    // setMarquee calls isn't guaranteed to have flushed by the time onUp
    // runs, so onUp recomputes the final point itself rather than trusting
    // `marquee` state.
    let last = start;
    (e.target as Element).setPointerCapture(e.pointerId);
    setMarquee({ x0: start.x, y0: start.y, x1: start.x, y1: start.y });

    function onMove(ev: PointerEvent) {
      const p = screenToCanvas(ev.clientX, ev.clientY);
      last = p;
      if (Math.hypot(p.x - start.x, p.y - start.y) > 4) moved = true;
      setMarquee({ x0: start.x, y0: start.y, x1: p.x, y1: p.y });
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setMarquee(null);
      if (!moved) return;
      // Same captured-pointer artifact onNodePointerDown's own onUp already
      // documents: a pointerdown+pointerup on the same element (this canvas
      // div, via setPointerCapture above) still synthesizes a trailing
      // native `click` on it once released. Without suppressing that here
      // too, the canvas's own onClick (a plain click always deselects/
      // clears multiSelectIds — see its JSX below) fired immediately after
      // this and wiped out the selection this same drag had just computed,
      // so a marquee looked like it "began" (the rectangle drew) but never
      // actually selected anything.
      suppressNextClick.current = true;
      const minX = Math.min(start.x, last.x);
      const maxX = Math.max(start.x, last.x);
      const minY = Math.min(start.y, last.y);
      const maxY = Math.max(start.y, last.y);
      const picked = nodes.filter((n) => {
        if (n.isWeapon || !isOwnNode(n)) return false;
        const p = positions.get(n.nodeId);
        return !!p && p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
      });
      setMultiSelectIds(new Set(picked.map((n) => n.nodeId)));
      setSelectedId(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return { marquee, onCanvasPointerDown };
}
