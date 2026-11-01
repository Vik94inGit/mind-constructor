import { useI18n } from "../i18n/I18nContext";
import { NODE_TYPE_COLORS } from "../utils/nodeType";
import { NodeTypeSymbol } from "./NodeTypeSymbol";
import { nodeRefId } from "../utils/nodeType";
import type { NodeDoc } from "../types";

interface Props {
  slides: NodeDoc[];
  index: number;
  onIndexChange: (i: number) => void;
  onExit: () => void;
}

// Full-map takeover for presentation mode — replaces every editing
// affordance (toolbar/minimap/zoom controls/node panel — see MapPage's own
// `presenting`-gated JSX) with a minimal, big-text "slide" reading of one
// node at a time. Sits at Modal.tsx's own top-of-stack z-index (z-50) —
// this *is* effectively a full-screen modal, just not built from that
// component's centered-dialog shape, since it needs to own the whole
// viewport rather than float a box over a dimmed backdrop.
export function PresentationOverlay({ slides, index, onIndexChange, onExit }: Props) {
  const { t } = useI18n();
  const node = slides[index];
  if (!node) return null;
  // A child's slide names the parent it hangs from (shown just before it,
  // see computeSlideOrder), when that parent is in the show.
  const parentId = nodeRefId(node.parentId);
  const parent = parentId ? slides.find((s) => s.nodeId === parentId) : undefined;
  const atStart = index === 0;
  const atEnd = index === slides.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      <div className="flex items-center justify-between px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <span className="text-[0.85rem] text-ink-soft">{t.ui.presentation.slideCount(index + 1, slides.length)}</span>
        <button
          type="button"
          onClick={onExit}
          className="cursor-pointer rounded-lg border border-line bg-surface px-[0.7rem] py-[0.4rem] text-[0.8rem] font-semibold text-ink transition-colors duration-[120ms] hover:bg-surface-2"
        >
          {t.ui.presentation.exit}
        </button>
      </div>

      {/* min-h-0: without it, a flex child defaults to min-height: auto,
          which refuses to shrink below its own content's natural height —
          so overflow-y-auto here never actually kicks in for a long node
          text, and the header/nav rows above/below (fixed-size flex items
          in the same column) get pushed past the viewport instead, with
          nothing to scroll them back into view. Classic flexbox scrolling
          gotcha, not a text-wrapping issue — neither text element below has
          any truncate/line-clamp/overflow-hidden of its own.
          The centering is my-auto on an inner column, not justify-center
          here: justify-center pushes a slide taller than the screen out
          past *both* edges, and the part above the top (the "Under …" line,
          the icon) can't be scrolled back to — on a phone a long node lost
          its whole upper row. my-auto centers a short slide the same way
          and lets a long one start at the top and scroll. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-6 text-center" data-slide-body>
        <div className="my-auto flex flex-col items-center gap-6">
        {/* The node's own type icon, large — a slide used to be text-only
            (type name + headline), which read as flat compared to the
            crowned, colored icons the same node wears on the canvas. */}
        {parent && (
          <span className="max-w-[700px] truncate text-[0.95rem] text-ink-soft">
            {t.ui.presentation.under(parent.title || parent.text || "")}
          </span>
        )}
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full border-2"
          style={{ borderColor: NODE_TYPE_COLORS[node.type] }}
        >
          <NodeTypeSymbol type={node.type} size={34} />
        </div>
        <span
          className="text-[1rem] font-bold tracking-[0.05em] uppercase"
          style={{ color: NODE_TYPE_COLORS[node.type] }}
        >
          {t.ui.types[node.type]}
        </span>
        <h1 className="max-w-[900px] text-[2rem] leading-tight font-bold text-ink sm:text-[2.8rem]">
          {node.title || node.text}
        </h1>
        {/* The title stands in as the "headline" above when set; the full
            text only shows as a second, smaller line in that case — a
            title-less node just shows its text as the headline itself,
            same "title, else text" precedent NodeCard's own caption uses. */}
        {node.title && <p className="max-w-[700px] text-[1.15rem] text-ink-soft">{node.text}</p>}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={atStart}
          onClick={() => onIndexChange(index - 1)}
          className="cursor-pointer rounded-lg border border-line bg-surface px-[1rem] py-[0.6rem] text-[0.9rem] font-semibold text-ink transition-colors duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← {t.ui.presentation.prev}
        </button>
        <button
          type="button"
          disabled={atEnd}
          onClick={() => onIndexChange(index + 1)}
          className="cursor-pointer rounded-lg border border-accent bg-accent-soft px-[1rem] py-[0.6rem] text-[0.9rem] font-semibold text-accent-ink transition-colors duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t.ui.presentation.next} →
        </button>
      </div>
    </div>
  );
}
