import { useI18n } from "../i18n/I18nContext";
import type { CardFitWarning } from "../hooks/useCardFit";

const btn =
  "inline-flex cursor-pointer items-center justify-center rounded-lg border border-transparent bg-transparent px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color] duration-[120ms] hover:bg-surface-2 disabled:cursor-default disabled:opacity-40";

// The cards view's warning when its cards don't fit the screen
// (hooks/useCardFit.ts): they're shown one zone at a time, with back and next
// to step through them in order, or even the top cards don't fit, with a way
// to move the ones past what fits to another map.
export function CardFitBanner({
  warning,
  movable,
  onMove,
  onDismiss,
  steps,
}: {
  warning: CardFitWarning;
  /** Your own top cards past what fits: the ones that can be moved. */
  movable: string[];
  onMove: (ids: string[]) => void;
  onDismiss: () => void;
  /** Stepping zone by zone: which one is shown (0 = the top ideas), out of how many, and its outline number. */
  steps: { at: number; count: number; label: string | null; onStep: (dir: -1 | 1) => void } | null;
}) {
  const { t } = useI18n();
  const c = t.ui.cardFit;
  return (
    <div
      data-card-fit={warning.kind}
      className="mx-4 mt-[0.6rem] flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent bg-surface px-[0.9rem] py-[0.7rem] text-[0.85rem] text-ink"
    >
      <span className="min-w-[14rem] flex-1">
        {warning.kind === "packed" ? c.packed : c.tooMany(warning.extraRootIds.length)}
      </span>
      <span className="ml-auto flex flex-wrap items-center gap-1">
        {steps && (
          <span className="flex items-center gap-1" data-card-steps>
            <button
              type="button"
              className={`${btn} border-line`}
              disabled={steps.at === 0}
              aria-label={c.back}
              title={c.back}
              onClick={() => steps.onStep(-1)}
            >
              ◀
            </button>
            <span className="min-w-[6.5rem] text-center text-[0.78rem] font-semibold">
              {steps.label === null ? c.topIdeas : c.zone(steps.label)}
              <span className="ml-1 font-normal text-ink-soft">
                {steps.at + 1}/{steps.count}
              </span>
            </span>
            <button
              type="button"
              className={`${btn} border-line`}
              disabled={steps.at === steps.count - 1}
              aria-label={c.next}
              title={c.next}
              onClick={() => steps.onStep(1)}
            >
              ▶
            </button>
          </span>
        )}
        {movable.length > 0 && (
          <button type="button" className={`${btn} border-line`} onClick={() => onMove(movable)}>
            {c.moveExtra(movable.length)}
          </button>
        )}
        <button type="button" className={btn} title={c.showAll} aria-label={c.showAll} onClick={onDismiss}>
          ✕
        </button>
      </span>
    </div>
  );
}
