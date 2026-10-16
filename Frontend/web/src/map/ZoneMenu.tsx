import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ZoneMenuBody } from "./ZoneMenuBody";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof ZoneMenuBody>, "idPrefix" | "onPicked"> & {
  rootId: string;
  /** Where it was opened (right-click or long-press), in screen coordinates. */
  x: number;
  y: number;
  onClose: () => void;
};

const MENU_W = 240;
const EDGE = 8;

// The visible screen's height — on a phone the browser's own bars cover part
// of the layout viewport, so visualViewport is what's actually on screen.
const screenHeight = () => window.visualViewport?.height ?? window.innerHeight;

// A zone's own menu, opened by right-clicking the zone or holding a finger on
// it (CanvasBackdrop's onZoneMenu): its view, its layout and — for the
// parent's owner — its pattern, colour and edge brightness. Picking a view or
// layout closes it; the look stays open so a pick shows on the zone at once.
// Closes on a tap elsewhere or Escape.
export function ZoneMenu({ rootId, x, y, onClose, ...body }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Placed once its real height is known: pulled up from the bottom edge as
  // far as it needs, and scrolling inside itself when the screen is shorter
  // than the whole menu — so its bottom is never cut off.
  const [top, setTop] = useState(() => Math.max(EDGE, Math.min(y, screenHeight() - 200)));
  const [maxHeight, setMaxHeight] = useState(() => screenHeight() - 2 * EDGE);
  useLayoutEffect(() => {
    function place() {
      const h = screenHeight();
      const menuH = ref.current?.scrollHeight ?? 0;
      const room = h - 2 * EDGE;
      setMaxHeight(room);
      setTop(Math.max(EDGE, Math.min(y, h - Math.min(menuH, room) - EDGE)));
    }
    place();
    window.visualViewport?.addEventListener("resize", place);
    window.addEventListener("resize", place);
    return () => {
      window.visualViewport?.removeEventListener("resize", place);
      window.removeEventListener("resize", place);
    };
  }, [y]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      // Scrolls inside itself rather than running off a short phone screen.
      className="fixed z-[70] flex flex-col gap-[0.15rem] overflow-y-auto rounded-card border border-line bg-surface p-[0.35rem] shadow-card"
      style={{
        left: Math.max(EDGE, Math.min(x, window.innerWidth - MENU_W - EDGE)),
        top,
        maxHeight,
        width: MENU_W,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <ZoneMenuBody idPrefix={`zone-menu-canvas-${rootId}`} onPicked={onClose} {...body} />
    </div>
  );
}
