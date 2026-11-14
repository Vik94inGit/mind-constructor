import { useI18n } from "../i18n/I18nContext";
import { NODE_TYPE_COLORS } from "../utils/nodeType";
import { NodeTypeSymbol } from "./NodeTypeSymbol";
import { mergeSlideOrder, moveSlide } from "../utils/presentation";
import type { SlideGroup } from "../utils/presentation";

interface Props {
  /** The slides as they play now (already in the saved order, if any). */
  slides: SlideGroup[];
  /** The slide the presentation is on, marked in the list. */
  current: number;
  /** Map.slideOrder as saved; empty / absent: the automatic order. */
  savedOrder?: string[];
  /** The whole map's new order ([] for automatic). */
  onChange: (order: string[]) => void;
  /** Goes to that slide. */
  onPick: (index: number) => void;
}

const arrowCls =
  "flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line bg-surface text-[1rem] text-ink transition-colors duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-30";

// The presentation's Order tab (map owner only): every slide in the order it
// plays, each with an up and a down arrow. Buttons rather than a drag, so it
// works the same with a mouse, a finger or the keyboard. A move is shown at
// once and saved for the whole map (useMapControls setSlideOrder); a
// presentation of one zone or of some types rearranges only what it shows
// and keeps the rest of the saved order (mergeSlideOrder).
export function SlideOrderList({ slides, current, savedOrder, onChange, onPick }: Props) {
  const { t } = useI18n();
  const ids = slides.map((s) => s.node.nodeId);
  const move = (from: number, to: number) => onChange(mergeSlideOrder(savedOrder, moveSlide(ids, from, to)));
  const custom = (savedOrder?.length ?? 0) > 0;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-3 text-left" data-slide-order>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[0.85rem] text-ink-soft">{t.ui.presentation.orderHint}</p>
        {custom && (
          <button
            type="button"
            className="cursor-pointer rounded-md border border-line bg-surface px-[0.6rem] py-[0.3rem] text-[0.8rem] font-semibold text-accent-ink transition-colors duration-[120ms] hover:bg-surface-2"
            onClick={() => onChange([])}
          >
            {t.ui.presentation.automaticOrder}
          </button>
        )}
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {slides.map((s, i) => {
          const label = s.node.title || s.node.text || "";
          return (
            <li
              key={s.node.nodeId}
              className={`flex items-center gap-2 rounded-lg border px-2 py-[0.4rem] ${
                i === current ? "border-accent bg-accent-soft" : "border-line bg-surface"
              }`}
            >
              <span className="w-6 shrink-0 text-right text-[0.8rem] text-ink-soft tabular-nums">{i + 1}</span>
              <button
                type="button"
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-1 py-1 text-left text-[0.9rem] text-ink hover:bg-surface-2"
                onClick={() => onPick(i)}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2"
                  style={{ borderColor: NODE_TYPE_COLORS[s.node.type] }}
                >
                  <NodeTypeSymbol type={s.node.type} size={14} />
                </span>
                <span className="min-w-0 truncate">{label}</span>
              </button>
              <button
                type="button"
                className={arrowCls}
                disabled={i === 0}
                aria-label={t.ui.presentation.moveUp(label)}
                title={t.ui.presentation.moveUp(label)}
                onClick={() => move(i, i - 1)}
              >
                ↑
              </button>
              <button
                type="button"
                className={arrowCls}
                disabled={i === slides.length - 1}
                aria-label={t.ui.presentation.moveDown(label)}
                title={t.ui.presentation.moveDown(label)}
                onClick={() => move(i, i + 1)}
              >
                ↓
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
