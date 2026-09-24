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
}

// The names of the zones currently on screen, listed in the map's bottom-left
// corner (a zone counts while its parent node is inside the visible part of the
// canvas). Easier to read than names squeezed onto the minimap.
export function ZoneNames({ wrapRef, zones, positions, zoom, hScrollMargin, vScrollMargin }: Props) {
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
  const visible = zones.filter((z) => {
    const p = positions.get(z.rootId);
    return !!p && p.x >= left && p.x <= right && p.y >= top && p.y <= bottom;
  });
  if (visible.length === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[45] flex max-w-[45%] flex-col gap-1">
      {visible.map((z) => (
        <div
          key={z.rootId}
          className="flex items-center gap-[0.35rem] self-start rounded-md border border-line bg-surface px-[0.5rem] py-[0.2rem] text-[0.75rem] font-semibold text-ink shadow-card"
        >
          <span aria-hidden style={{ color: ZONE_COLORS[z.sentiment] }}>
            {z.variant ? <KnightHelmet size={13} /> : "👑"}
          </span>
          <span className="truncate" style={{ color: ZONE_COLORS[z.sentiment] }}>
            {z.name}
          </span>
        </div>
      ))}
    </div>
  );
}
