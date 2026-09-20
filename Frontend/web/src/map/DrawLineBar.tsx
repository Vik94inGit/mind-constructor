import { useI18n } from "../i18n/I18nContext";

interface Props {
  /** How many points of the line in progress are placed. */
  pointCount: number;
  /** Why the last click was refused, if it was — flashes a reminder. */
  blocked: "spot" | "crossing" | null;
  saving: boolean;
  onUndo: () => void;
  onFinish: () => void;
  onExit: () => void;
}

const btn =
  "inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50";

// Takes over the bottom-sheet slot while drawing a separator line — the same
// slot the node panel and the group-selection bar use, so only one shows at a
// time. Placing points, undoing and finishing happen on the canvas and on the
// keyboard too (Enter finishes, Backspace undoes, Escape clears); this bar
// says what to do and holds the buttons for touch.
export function DrawLineBar({ pointCount, blocked, saving, onUndo, onFinish, onExit }: Props) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-x-0 bottom-0 z-[46] flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line bg-surface px-5 py-3 shadow-[var(--shadow-card)]">
      <span className={`text-[0.85rem] ${blocked ? "font-semibold text-danger" : "text-ink"}`}>
        {blocked === "crossing"
          ? t.ui.lines.crossing
          : blocked
            ? t.ui.lines.blocked
            : pointCount === 0
              ? t.ui.lines.hintStart
              : t.ui.lines.hintPoints(pointCount)}
      </span>
      <div className="flex items-center gap-2">
        <button className={btn} disabled={pointCount === 0 || saving} onClick={onUndo}>
          {t.ui.lines.undo}
        </button>
        <button
          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-white transition-opacity duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={pointCount < 2 || saving}
          onClick={onFinish}
        >
          {t.ui.lines.finish}
        </button>
        <button className={btn} onClick={onExit}>
          {t.ui.lines.exit}
        </button>
      </div>
    </div>
  );
}
