import { useI18n } from "../i18n/I18nContext";
import type { CardFitWarning } from "../hooks/useCardFit";

const btn =
  "inline-flex cursor-pointer items-center justify-center rounded-lg border border-transparent bg-transparent px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color] duration-[120ms] hover:bg-surface-2";

// The cards view's warning when its cards don't fit the screen
// (hooks/useCardFit.ts): branches were packed in, or even the top cards don't
// fit, with a way to move the ones past what fits to another map.
export function CardFitBanner({
  warning,
  movable,
  onMove,
  onDismiss,
}: {
  warning: CardFitWarning;
  /** Your own top cards past what fits: the ones that can be moved. */
  movable: string[];
  onMove: (ids: string[]) => void;
  onDismiss: () => void;
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
      <span className="ml-auto flex items-center gap-1">
        {movable.length > 0 && (
          <button type="button" className={`${btn} border-line`} onClick={() => onMove(movable)}>
            {c.moveExtra(movable.length)}
          </button>
        )}
        <button type="button" className={btn} title={t.ui.common.close} aria-label={t.ui.common.close} onClick={onDismiss}>
          ✕
        </button>
      </span>
    </div>
  );
}
