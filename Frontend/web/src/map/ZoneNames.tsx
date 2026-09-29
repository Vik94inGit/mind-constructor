import { useEffect, useState } from "react";
import { ZONE_COLORS } from "../utils/nodeType";
import { KnightHelmet } from "./KnightHelmet";
import type { Sentiment } from "../utils/nodeType";

export interface NamedZone {
  rootId: string;
  name: string;
  sentiment: Sentiment;
  /** A circle parent that itself hangs from another node: helmet instead of crown. */
  variant: boolean;
}

interface Props {
  wrapRef: React.RefObject<HTMLDivElement | null>;
  zones: NamedZone[];
  positions: Map<string, { x: number; y: number }>;
  zoom: number;
  hScrollMargin: number;
  vScrollMargin: number;
  /** A name was clicked: center the view on that zone. */
  onGo: (rootId: string) => void;
}

// Every zone's name, listed in the map's bottom-left corner as links: a click
// centers the view on that zone. Zones whose parent is on screen right now
// are drawn at full strength, the rest a little faded. Easier to read than
// names squeezed onto the minimap.
export function ZoneNames({ wrapRef, zones, positions, zoom, hScrollMargin, vScrollMargin, onGo }: Props) {
  const [view, setView] = useState({ left: 0, top: 0, width: 0, height: 0 });

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function update() {
      setView({ left: wrap!.scrollLeft, top: wrap!.scrollTop, width: wrap!.clientWidth, height: wrap!.clientHeight });
    }
    update();
    wrap.addEventListener("scroll", update, { passive: true });
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(wrap);
    return () => {
      wrap.removeEventListener("scroll", update);
      resizeObserver.disconnect();
    };
  }, [wrapRef]);

  const left = view.left / zoom - hScrollMargin;
  const top = view.top / zoom - vScrollMargin;
  const right = left + view.width / zoom;
  const bottom = top + view.height / zoom;
  const onScreen = (z: NamedZone) => {
    const p = positions.get(z.rootId);
    return !!p && p.x >= left && p.x <= right && p.y >= top && p.y <= bottom;
  };
  if (zones.length === 0) return null;

  return (
    // Fixed cap, not a viewport percentage — names arriving here are already
    // hard-truncated to ~22 chars (see MapPage's own ZONE_NAME_MAX), so a
    // width sized for a whole untruncated sentence just left a lot of empty
    // pill on wide screens. `truncate` below still guards the rare case
    // (very wide characters, a locale that renders longer) where even that
    // capped text doesn't quite fit.
    // Scrolls on its own once there are more zones than fit (max-h), rather
    // than climbing up over the canvas.
    <div className="pointer-events-none absolute bottom-3 left-3 z-[45] flex max-h-[40vh] max-w-[11rem] flex-col gap-1 overflow-y-auto">
      {zones.map((z) => (
        <button
          key={z.rootId}
          type="button"
          className={`pointer-events-auto flex cursor-pointer items-center gap-[0.35rem] self-start rounded-md border border-line bg-surface px-[0.5rem] py-[0.2rem] text-left text-[0.75rem] font-semibold text-ink shadow-card transition-opacity duration-150 hover:underline hover:opacity-100 focus-visible:opacity-100 ${
            onScreen(z) ? "" : "opacity-60"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onGo(z.rootId);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span aria-hidden style={{ color: ZONE_COLORS[z.sentiment] }}>
            {z.variant ? <KnightHelmet size={16} sentiment={z.sentiment} /> : "👑"}
          </span>
          <span className="truncate" style={{ color: ZONE_COLORS[z.sentiment] }}>
            {z.name}
          </span>
        </button>
      ))}
    </div>
  );
}
