import { useI18n } from "../i18n/I18nContext";
import type { AbstractionLevel } from "../utils/abstractionLevel";

interface Props {
  /** The current level (null = everything shown). */
  level: AbstractionLevel;
  /** How many levels the map has — see abstractionLevel's levelCount. */
  levels: number;
  /** Nodes the current level keeps off the canvas. */
  hiddenCount: number;
  onChange: (level: AbstractionLevel) => void;
}

const stepBtn =
  "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-[1rem] font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40";

// Takes the minimap's bottom-right slot on a phone, where the minimap is too
// small to be of use: a slider over the map's parentId levels, from only the
// top ideas (1) to every node (the deepest level, stored as null so a map
// that grows deeper later still shows everything). Same z-45 as the minimap.
export function AbstractionControl({ level, levels, hiddenCount, onChange }: Props) {
  const { t } = useI18n();
  const s = t.ui.abstraction;
  const max = Math.max(1, levels);
  const value = level === null ? max : Math.min(level, max);
  const set = (v: number) => onChange(v >= max ? null : Math.max(1, v));
  const valueText = value >= max ? s.all : s.level(value, max);

  return (
    <div
      className="absolute bottom-3 right-3 z-45 w-[180px] rounded-card border border-line bg-surface px-2 py-1.5 shadow-card"
      title={s.title}
    >
      <div className="flex items-baseline justify-between px-1 text-[0.72rem] font-semibold text-ink-soft">
        <span>{s.label}</span>
        <span className="text-ink">{value >= max ? s.all : `${value} / ${max}`}</span>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" className={stepBtn} disabled={value <= 1} title={s.lessDetail} aria-label={s.lessDetail} onClick={() => set(value - 1)}>
          −
        </button>
        <input
          type="range"
          min={1}
          max={max}
          step={1}
          value={value}
          disabled={max <= 1}
          aria-label={s.title}
          aria-valuetext={valueText}
          className="min-w-0 flex-1 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed"
          onChange={(e) => set(Number(e.target.value))}
        />
        <button type="button" className={stepBtn} disabled={value >= max} title={s.moreDetail} aria-label={s.moreDetail} onClick={() => set(value + 1)}>
          +
        </button>
      </div>
      {hiddenCount > 0 && <div className="px-1 text-[0.68rem] text-ink-soft">{s.hidden(hiddenCount)}</div>}
    </div>
  );
}
