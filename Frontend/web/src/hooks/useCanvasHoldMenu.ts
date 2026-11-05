import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

// How long a finger has to stay on empty canvas before the canvas menu opens
// (the same hold that opens a zone's menu, CanvasBackdrop's ZONE_HOLD_MS).
export const CANVAS_HOLD_MS = 500;
// Moving further than this before then is a pan, not a hold.
const HOLD_SLOP_PX = 8;

export interface CanvasHoldState {
  pointerType: string;
  busyMode: boolean;
  entranceActive: boolean;
  canEdit: boolean;
}

// Touch has no right-click: holding a finger still on empty canvas opens the
// canvas menu (new node, templates, paste…) instead. A quick tap only closes
// what is open, as before, so the menu never pops up by accident.
// See docs/gestures/canvas-tap-menu.md.
export function canvasHoldAllowed(s: CanvasHoldState): boolean {
  return s.pointerType !== "mouse" && s.pointerType !== "" && !s.busyMode && !s.entranceActive && s.canEdit;
}

/**
 * Starts the hold on a press (call `start` from the canvas's pointerdown) and
 * opens the menu with `onHold` once it has lasted CANVAS_HOLD_MS. `swallowClick`
 * tells the canvas's click handler to ignore the click that lifting the finger
 * after a hold leaves behind.
 */
export function useCanvasHoldMenu(onHold: (clientX: number, clientY: number) => void) {
  const onHoldRef = useRef(onHold);
  onHoldRef.current = onHold;
  const firedAt = useRef(0);
  const cleanup = useRef<(() => void) | null>(null);

  function cancel() {
    cleanup.current?.();
    cleanup.current = null;
  }

  function start(e: ReactPointerEvent, allowed: boolean) {
    cancel();
    if (!allowed) return;
    const { clientX, clientY, pointerId } = e;
    const timer = setTimeout(() => {
      cancel();
      firedAt.current = Date.now();
      onHoldRef.current(clientX, clientY);
    }, CANVAS_HOLD_MS);
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId && Math.hypot(ev.clientX - clientX, ev.clientY - clientY) > HOLD_SLOP_PX) cancel();
    };
    const onEnd = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId) cancel();
    };
    // A second finger (pinch) is a zoom, not a hold.
    const onSecond = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) cancel();
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onEnd, true);
    window.addEventListener("pointercancel", onEnd, true);
    window.addEventListener("pointerdown", onSecond, true);
    cleanup.current = () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onEnd, true);
      window.removeEventListener("pointercancel", onEnd, true);
      window.removeEventListener("pointerdown", onSecond, true);
    };
  }

  useEffect(() => cancel, []);

  return {
    start,
    /** True for the click that lifting the finger after a hold leaves behind. */
    swallowClick: () => Date.now() - firedAt.current < 1000,
  };
}
