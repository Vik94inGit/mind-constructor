import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

/** How far a popover keeps from the screen's edge. */
const EDGE = 8;

/**
 * How far to slide a popover sideways so all of it is on screen. A toolbar
 * menu opens below its own button; on a phone a button near the right end
 * left a wide menu hanging past the screen's edge, and focusing its field
 * scrolled the whole page sideways to reach it. Measured once as it opens,
 * before paint, so it never shows in the wrong place.
 */
export function keepOnScreenShift(rect: { left: number; right: number }, screenW: number): number {
  if (rect.right <= screenW - EDGE) return 0;
  // Slide left, but never past the left edge.
  return -Math.min(rect.right - (screenW - EDGE), Math.max(0, rect.left - EDGE));
}

/**
 * How far to lift a popover so its bottom is on screen. On a computer the
 * toolbar stands down the left side and its menus open to the right of their
 * button, top-aligned with it, so a long menu (Display options, with Quiz me
 * at its foot) ran off the bottom of a short window with no way to reach it.
 * Lifted up, but never past the top edge; whatever is still too tall scrolls
 * inside the menu's own max-height.
 */
export function keepOnScreenLift(rect: { top: number; bottom: number }, screenH: number): number {
  if (rect.bottom <= screenH - EDGE) return 0;
  return -Math.min(rect.bottom - (screenH - EDGE), Math.max(0, rect.top - EDGE));
}

export function useKeepOnScreen(ref: RefObject<HTMLElement | null>): { transform?: string } {
  const [shift, setShift] = useState({ x: 0, y: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The screen's own width, not only innerWidth: on a phone a popover that
    // hangs past the edge widens the page itself (the browser zooms out to
    // fit it), so innerWidth has already grown to take it in.
    const screenW = Math.min(window.innerWidth, window.screen?.width || Infinity);
    const rect = el.getBoundingClientRect();
    setShift({ x: keepOnScreenShift(rect, screenW), y: keepOnScreenLift(rect, window.innerHeight) });
  }, [ref]);
  return shift.x || shift.y ? { transform: `translate(${shift.x}px, ${shift.y}px)` } : {};
}
