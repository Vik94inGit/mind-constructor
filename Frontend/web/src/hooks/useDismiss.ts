import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Closes a menu or popover when the user presses outside it or hits Escape.
 * Listens in the capture phase: the menu is the newest thing on the page, so
 * it should see the dismissing press or key before anything else does.
 *
 * `inside` is the menu itself, or a list of elements that count as inside
 * (a menu and the button that opens it). `onEscape` replaces `onDismiss` for
 * Escape only, for a drill-down menu that backs out a level first. Both
 * callbacks are read at the moment of the event, so passing new functions on
 * every render doesn't re-add the listeners.
 */
export function useDismiss(
  inside: RefObject<Element | null> | RefObject<Element | null>[],
  onDismiss: () => void,
  { enabled = true, onEscape }: { enabled?: boolean; onEscape?: () => void } = {},
): void {
  const latest = useRef({ inside, onDismiss, onEscape });
  latest.current = { inside, onDismiss, onEscape };

  useEffect(() => {
    if (!enabled) return;
    function onPointerDown(e: PointerEvent) {
      const refs = latest.current.inside;
      const target = e.target as Node;
      if ((Array.isArray(refs) ? refs : [refs]).some((r) => r.current?.contains(target))) return;
      latest.current.onDismiss();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      (latest.current.onEscape ?? latest.current.onDismiss)();
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [enabled]);
}
