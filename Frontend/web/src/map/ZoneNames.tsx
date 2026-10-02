import { useEffect, useRef, useState } from "react";
import { ZONE_COLORS } from "../utils/nodeType";
import { ZONE_MODES } from "../utils/zoneDisplay";
import type { ZoneDisplay, ZoneMode } from "../utils/zoneDisplay";
import { useI18n } from "../i18n/I18nContext";
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
  /** Each zone's own view, where it has one (see utils/zoneDisplay.ts). */
  modes?: ZoneDisplay;
  /** A zone's view was picked — null goes back to following the map's. */
  onSetMode?: (rootId: string, mode: ZoneMode | null) => void;
}

// A glyph per view for the chip's view button — short enough to sit beside
// the name, distinct enough to tell the zones' views apart at a glance.
const MODE_GLYPH: Record<ZoneMode, string> = {
  puzzle: "🧩",
  mixed: "◐",
  iconText: "Aa",
  actual: "○",
  dots: "•••",
};

// Every zone's name, listed in the map's bottom-left corner as links: a click
// centers the view on that zone. Zones whose parent is on screen right now
// are drawn at full strength, the rest a little faded. Easier to read than
// names squeezed onto the minimap.
export function ZoneNames({
  wrapRef,
  zones,
  positions,
  zoom,
  hScrollMargin,
  vScrollMargin,
  onGo,
  modes = {},
  onSetMode,
}: Props) {
  const { t } = useI18n();
  // The zone whose view menu is open, and where to draw the menu (fixed to
  // the screen beside its button, so the chip list's own scrolling can't
  // clip it).
  const [menu, setMenu] = useState<{ rootId: string; left: number; bottom: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menu) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(null);
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [menu]);
  const modeLabel: Record<ZoneMode, string> = {
    puzzle: t.map.toolbar.readingPuzzle,
    mixed: t.map.toolbar.readingMixed,
    iconText: t.map.toolbar.readingIconText,
    actual: t.map.toolbar.readingActual,
    dots: t.ui.display.dots,
  };
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
    <div className="pointer-events-none absolute bottom-3 left-3 z-[45] flex max-h-[40vh] max-w-[13.5rem] flex-col gap-1 overflow-y-auto">
      {zones.map((z) => (
        <div key={z.rootId} className="flex max-w-full items-center gap-1 self-start">
        <button
          type="button"
          className={`pointer-events-auto flex min-w-0 cursor-pointer items-center gap-[0.35rem] self-start rounded-md border border-line bg-surface px-[0.5rem] py-[0.2rem] text-left text-[0.75rem] font-semibold text-ink shadow-card transition-opacity duration-150 hover:underline hover:opacity-100 focus-visible:opacity-100 ${
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
        {onSetMode && (
          // This zone's own view — see utils/zoneDisplay.ts.
          <button
            type="button"
            className={`pointer-events-auto flex h-[1.55rem] min-w-[1.7rem] cursor-pointer items-center justify-center rounded-md border px-1 text-[0.7rem] leading-none font-semibold shadow-card hover:bg-surface-2 ${
              modes[z.rootId] ? "border-accent bg-surface text-accent" : "border-line bg-surface text-ink-soft"
            }`}
            title={t.ui.display.zoneView(z.name)}
            aria-label={t.ui.display.zoneView(z.name)}
            aria-haspopup="menu"
            aria-expanded={menu?.rootId === z.rootId}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const r = e.currentTarget.getBoundingClientRect();
              setMenu((cur) =>
                cur?.rootId === z.rootId ? null : { rootId: z.rootId, left: r.right + 6, bottom: window.innerHeight - r.bottom },
              );
            }}
          >
            {modes[z.rootId] ? MODE_GLYPH[modes[z.rootId]] : "⋯"}
          </button>
        )}
        </div>
      ))}
      {menu && onSetMode && (
        <div
          ref={menuRef}
          role="menu"
          className="pointer-events-auto fixed z-[60] flex min-w-[190px] flex-col gap-[0.15rem] rounded-card border border-line bg-surface p-[0.35rem] shadow-card"
          style={{ left: menu.left, bottom: menu.bottom }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {[null, ...ZONE_MODES].map((m) => {
            const active = (modes[menu.rootId] ?? null) === m;
            return (
              <button
                key={m ?? "map"}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-[0.6rem] py-[0.4rem] text-left text-[0.82rem] hover:bg-surface-2 ${
                  active ? "bg-surface-2 font-semibold text-accent" : "text-ink"
                }`}
                onClick={() => {
                  onSetMode(menu.rootId, m);
                  setMenu(null);
                }}
              >
                <span className="w-6 text-center text-[0.72rem]" aria-hidden>
                  {m ? MODE_GLYPH[m] : "⋯"}
                </span>
                {m ? modeLabel[m] : t.ui.display.followMap}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
