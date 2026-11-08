import { useRef } from "react";

// Two taps (or clicks) count as one double-tap when the second lands within
// this long and this close to the first. Read off the canvas's own click
// events, so it works the same with a mouse, a finger or a pen, and on
// Safari, which doesn't reliably send dblclick for two taps.
// See docs/gestures/double-tap-new-node.md.
export const DOUBLE_TAP_MS = 350;
export const DOUBLE_TAP_SLOP_PX = 24;

export interface Tap {
  x: number;
  y: number;
  /** Event time in ms (event.timeStamp). */
  t: number;
  /** What was tapped: "" for empty canvas, a zone's root id for a zone. Taps on two different things never pair up. */
  target: string;
}

export function isDoubleTap(prev: Tap | null, next: Tap): boolean {
  if (!prev) return false;
  const dt = next.t - prev.t;
  return (
    prev.target === next.target &&
    dt >= 0 &&
    dt <= DOUBLE_TAP_MS &&
    Math.hypot(next.x - prev.x, next.y - prev.y) <= DOUBLE_TAP_SLOP_PX
  );
}

export interface CanvasDoubleTapState {
  busyMode: boolean;
  entranceActive: boolean;
  canEdit: boolean;
}

// Not while a mode gives taps another meaning (drawing, choosing, packing,
// change parent, a new node already being named), not during the entrance,
// and not while replaying or presenting.
export function canvasDoubleTapAllowed(s: CanvasDoubleTapState): boolean {
  return !s.busyMode && !s.entranceActive && s.canEdit;
}

/**
 * Feed every plain tap on empty canvas (or on a zone) to `tap`. It returns
 * true for the second tap of a double-tap; the pair is then used up, so a
 * third quick tap starts a new pair instead of firing again. `reset` forgets
 * the last tap (call it when a tap did something else).
 */
export function useCanvasDoubleTap() {
  const last = useRef<Tap | null>(null);
  return {
    tap(next: Tap): boolean {
      if (isDoubleTap(last.current, next)) {
        last.current = null;
        return true;
      }
      last.current = next;
      return false;
    },
    reset() {
      last.current = null;
    },
  };
}
