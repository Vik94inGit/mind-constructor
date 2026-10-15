import { useEffect, useRef } from "react";
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
// About the full menu's height — enough to pull it up from the screen's
// bottom edge; a shorter screen scrolls it instead (max-h below).
const MENU_H = 460;

// A zone's own menu, opened by right-clicking the zone or holding a finger on
// it (CanvasBackdrop's onZoneMenu): its view, its layout and — for the
// parent's owner — its pattern, colour and edge brightness. Picking a view or
// layout closes it; the look stays open so a pick shows on the zone at once.
// Closes on a tap elsewhere or Escape.
export function ZoneMenu({ rootId, x, y, onClose, ...body }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

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
      className="fixed z-[70] flex max-h-[calc(100vh-16px)] flex-col gap-[0.15rem] overflow-y-auto rounded-card border border-line bg-surface p-[0.35rem] shadow-card"
      style={{
        left: Math.max(8, Math.min(x, window.innerWidth - MENU_W - 8)),
        top: Math.max(8, Math.min(y, window.innerHeight - MENU_H - 8)),
        width: MENU_W,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <ZoneMenuBody idPrefix={`zone-menu-canvas-${rootId}`} onPicked={onClose} {...body} />
    </div>
  );
}
