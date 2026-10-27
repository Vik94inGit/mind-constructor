import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { MAP_VIEWS } from "../utils/viewPrompt";
import type { MapView } from "../utils/viewPrompt";

interface Props {
  minimapShown: boolean;
  onToggleMinimap: () => void;
  /** The whole map, the overview (each parent packed) or the cards — see utils/viewPrompt.ts. */
  view: MapView;
  onViewChange: (view: MapView) => void;
  /** The cards view: packs every card close together again (hooks/useCardPacking.ts). */
  onLayCardsClose?: () => void;
}

// The three views side by side, the chosen one filled. Also the view prompt's
// buttons (map/ViewPrompt.tsx).
export function ViewSwitch({ view, onChange }: { view: MapView; onChange: (view: MapView) => void }) {
  const { t } = useI18n();
  const a = t.ui.autoPack;
  return (
    <div className="flex gap-1 rounded-card border border-line bg-surface p-1" role="group" aria-label={a.viewLabel}>
      {MAP_VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          data-view={v}
          aria-pressed={v === view}
          title={a.viewHints[v]}
          className={`flex-1 cursor-pointer rounded-md border-0 px-2 py-[0.3rem] text-[0.75rem] font-semibold ${
            v === view ? "bg-accent text-white" : "bg-transparent text-ink hover:bg-surface-2"
          }`}
          onClick={() => onChange(v)}
        >
          {a.views[v]}
        </button>
      ))}
    </div>
  );
}

// The map's bottom-right corner: an eye button that opens the view controls —
// Whole map / Overview / Cards (which took the place of the old "simpler ↔
// more detail" equalizer), laying the cards close in the cards view, and
// whether the minimap shows. Same z-[45] as the zoom controls while closed;
// open, the whole corner lifts to z-[49] — the menu's own z-index only counts
// inside this wrapper, so without the lift the minimap (a later z-45 sibling)
// painted over it. Still below a real modal (z-50).
export function ViewCorner({ minimapShown, onToggleMinimap, view, onViewChange, onLayCardsClose }: Props) {
  const { t } = useI18n();
  const s = t.ui.abstraction;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  return (
    // With the minimap shown it takes the corner itself (~122px tall with its
    // border): the zoom controls sit on it and the eye on top of them.
    <div ref={ref} className={`absolute ${minimapShown ? "bottom-[186px]" : "bottom-3"} right-3 ${open ? "z-[49]" : "z-[45]"}`}>
      {open && (
        <div className="absolute right-0 bottom-[calc(100%+0.4rem)] z-[60] flex w-[230px] flex-col gap-3 rounded-card border border-line bg-surface p-2 shadow-card">
          <div className="flex flex-col gap-1">
            <div className="px-1 text-[0.72rem] font-semibold text-ink-soft">{t.ui.autoPack.viewLabel}</div>
            <ViewSwitch view={view} onChange={onViewChange} />
            {view === "cards" && onLayCardsClose && (
              <button
                type="button"
                data-lay-cards-close
                title={t.ui.autoPack.layCloseHint}
                className="cursor-pointer rounded-md border border-line bg-surface px-2 py-[0.3rem] text-left text-[0.75rem] font-semibold text-ink hover:bg-surface-2"
                onClick={onLayCardsClose}
              >
                ▦ {t.ui.autoPack.layClose}
              </button>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={minimapShown}
            className={`flex w-full cursor-pointer items-center justify-between rounded-[6px] px-1 py-1 text-left text-[0.8rem] hover:bg-surface-2 ${
              minimapShown ? "font-semibold text-accent-ink" : "text-ink"
            }`}
            onClick={onToggleMinimap}
          >
            <span>{s.minimap}</span>
            <span aria-hidden>{minimapShown ? "✓" : ""}</span>
          </button>
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-label={s.menu}
        title={s.menu}
        className={`inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-card border border-line shadow-card ${
          open ? "bg-surface-2 text-accent-ink" : "bg-surface text-ink"
        } hover:bg-surface-2`}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>
  );
}
