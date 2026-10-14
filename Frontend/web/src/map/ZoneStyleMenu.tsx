import { useEffect, useRef } from "react";
import type { ZonePaletteColor, ZonePattern } from "../types";
import { ZoneStylePicker } from "./ZoneStylePicker";

interface Props {
  rootId: string;
  /** Where it was opened (right-click or long-press), in screen coordinates. */
  x: number;
  y: number;
  pattern: ZonePattern | null;
  color: ZonePaletteColor | null;
  autoColor: string;
  onChange: (patch: { zonePattern?: ZonePattern | null; zoneColor?: ZonePaletteColor | null }) => void;
  onClose: () => void;
}

const MENU_W = 236;
const MENU_H = 150;

// A zone's own menu: its pattern and colour, opened by right-clicking the zone
// or holding a finger on it (CanvasBackdrop's onZoneMenu). Stays open while
// picking, so a pick shows on the zone at once; closes on a tap elsewhere or
// Escape.
export function ZoneStyleMenu({ rootId, x, y, pattern, color, autoColor, onChange, onClose }: Props) {
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
      className="fixed z-[70] rounded-card border border-line bg-surface py-[0.35rem] shadow-card"
      style={{
        left: Math.max(8, Math.min(x, window.innerWidth - MENU_W - 8)),
        top: Math.max(8, Math.min(y, window.innerHeight - MENU_H - 8)),
        width: MENU_W,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <ZoneStylePicker
        idPrefix={`zone-style-menu-${rootId}`}
        pattern={pattern}
        color={color}
        autoColor={autoColor}
        onPattern={(p) => onChange({ zonePattern: p })}
        onColor={(c) => onChange({ zoneColor: c })}
      />
    </div>
  );
}
