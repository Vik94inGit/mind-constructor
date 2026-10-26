import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import type { ReadingMode } from "../utils/readingMode";
import type { AbstractionLevel } from "../utils/abstractionLevel";
import { detailIndex, detailSteps } from "../utils/detailScale";
import { MAP_VIEWS } from "../utils/viewPrompt";
import type { MapView } from "../utils/viewPrompt";

interface Props {
  /** The level of abstraction (null = every level) — see utils/abstractionLevel.ts. */
  level: AbstractionLevel;
  /** How many levels the map has. */
  levels: number;
  /** Nodes the current level keeps off the canvas. */
  hiddenCount: number;
  onLevelChange: (level: AbstractionLevel) => void;
  readingMode: ReadingMode;
  onReadingModeChange: (mode: ReadingMode) => void;
  minimapShown: boolean;
  onToggleMinimap: () => void;
  /** The whole map, the overview (each parent packed) or the cards — see utils/viewPrompt.ts. */
  view?: MapView;
  onViewChange?: (view: MapView) => void;
  /** The cards view: packs every card close together again (hooks/useCardPacking.ts). */
  onLayCardsClose?: () => void;
}

// The three views side by side, the chosen one filled. Also the view prompt's
// buttons (map/ViewPrompt.tsx).
export function ViewSwitch({ view, onChange }: { view?: MapView; onChange: (view: MapView) => void }) {
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

// Same look as ZoomControls' − / + buttons, so the sliders read as one family.
const stepBtn =
  "inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-[0.95rem] font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40";

interface StepperProps {
  label: string;
  /** Words under the two ends of the bars, e.g. "Simpler" and "More detail". */
  ends?: [string, string];
  valueText: string;
  /** 1-based position on the scale. */
  value: number;
  steps: number;
  lessTitle: string;
  moreTitle: string;
  onStep: (value: number) => void;
}

// One row of the menu: a label with the current value, then the zoom-style
// pill — − on the left, + on the right, and between them a small equalizer of
// one bar per step (filled up to the current one, each tappable).
function Stepper({ label, ends, valueText, value, steps, lessTitle, moreTitle, onStep }: StepperProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 px-1 text-[0.72rem] font-semibold">
        <span className="text-ink-soft">{label}</span>
        <span className="truncate text-ink">{valueText}</span>
      </div>
      <div className="flex items-center gap-1 rounded-card border border-line bg-surface p-1">
        <button type="button" className={stepBtn} disabled={value <= 1} title={lessTitle} aria-label={lessTitle} onClick={() => onStep(value - 1)}>
          −
        </button>
        <div className="flex h-7 flex-1 items-end justify-center gap-[3px] px-1" role="group" aria-label={label}>
          {Array.from({ length: steps }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${label} ${i + 1}`}
              aria-pressed={i + 1 === value}
              className={`w-full max-w-[14px] cursor-pointer rounded-[2px] border-0 p-0 ${i < value ? "bg-accent" : "bg-surface-2"}`}
              style={{ height: `${35 + (65 * (i + 1)) / steps}%` }}
              onClick={() => onStep(i + 1)}
            />
          ))}
        </div>
        <button type="button" className={stepBtn} disabled={value >= steps} title={moreTitle} aria-label={moreTitle} onClick={() => onStep(value + 1)}>
          +
        </button>
      </div>
      {ends && (
        <div className="flex justify-between px-1 text-[0.68rem] text-ink-soft" aria-hidden>
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </div>
      )}
    </div>
  );
}

// The map's bottom-right corner: an eye button that opens the view controls —
// one "simpler ↔ more detail" equalizer (utils/detailScale.ts: first the
// levels of the tree, then more text) and whether the minimap shows. The
// level and the reading mode used to have their own equalizers under
// "Fine-tune" too; they only repeated what this one already steps through. Same z-[45] as the zoom controls
// while closed; open, the whole corner lifts to z-[49] — the menu's own
// z-index only counts inside this wrapper, so without the lift the minimap
// (a later z-45 sibling) painted over it. Still below a real modal (z-50).
export function ViewCorner({
  level,
  levels,
  hiddenCount,
  onLevelChange,
  readingMode,
  onReadingModeChange,
  minimapShown,
  onToggleMinimap,
  view,
  onViewChange,
  onLayCardsClose,
}: Props) {
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

  const maxLevel = Math.max(1, levels);
  const levelValue = level === null ? maxLevel : Math.min(level, maxLevel);

  const modeLabel: Record<ReadingMode, string> = {
    puzzle: t.map.toolbar.readingPuzzle,
    mixed: t.map.toolbar.readingMixed,
    iconText: t.map.toolbar.readingIconText,
    actual: t.map.toolbar.readingActual,
  };

  const steps = detailSteps(maxLevel);
  const detailValue = detailIndex(maxLevel, level, readingMode) + 1;
  const detailText =
    (level !== null && level < maxLevel ? s.level(levelValue, maxLevel) : modeLabel[readingMode]) + (hiddenCount > 0 ? ` · ${s.hidden(hiddenCount)}` : "");
  function stepDetail(v: number) {
    const step = steps[Math.min(Math.max(1, v), steps.length) - 1];
    onLevelChange(step.level);
    onReadingModeChange(step.mode);
  }

  return (
    // With the minimap shown it takes the corner itself (~122px tall with its
    // border): the zoom controls sit on it and the eye on top of them.
    <div ref={ref} className={`absolute ${minimapShown ? "bottom-[186px]" : "bottom-3"} right-3 ${open ? "z-[49]" : "z-[45]"}`}>
      {open && (
        <div className="absolute right-0 bottom-[calc(100%+0.4rem)] z-[60] flex w-[230px] flex-col gap-3 rounded-card border border-line bg-surface p-2 shadow-card">
          {onViewChange && (
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
          )}
          <Stepper
            label={s.label}
            ends={[s.simpler, s.richer]}
            valueText={detailText}
            value={detailValue}
            steps={steps.length}
            lessTitle={s.simpler}
            moreTitle={s.richer}
            onStep={stepDetail}
          />
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
