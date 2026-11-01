import { useI18n } from "../i18n/I18nContext";
import { NODE_TYPE_COLORS } from "../utils/nodeType";
import { NodeTypeSymbol } from "./NodeTypeSymbol";
import { nodeRefId } from "../utils/nodeType";
import type { NodeDoc } from "../types";
import type { SlideGroup } from "../utils/presentation";

interface Props {
  /** One slide per parent, with its children — see computeSlideGroups (utils/presentation.ts). */
  slides: SlideGroup[];
  index: number;
  onIndexChange: (i: number) => void;
  onExit: () => void;
  /** Closes the presentation and opens this node on the map. */
  onOpenNode: (nodeId: string) => void;
}

const linkCls =
  "cursor-pointer rounded-md border border-line bg-surface px-[0.6rem] py-[0.3rem] text-[0.8rem] font-semibold text-accent-ink transition-colors duration-[120ms] hover:bg-surface-2";

// Full-map takeover for presentation mode — replaces every editing
// affordance (toolbar/minimap/zoom controls/node panel — see MapPage's own
// `presenting`-gated JSX) with a big-text "slide": one node, large, with the
// children hanging from it as cards below — tap one to go to its own slide,
// or the "Under …" line to go back up. The slides walk a parent, its own
// children, then the next parent (computeSlideGroups). Each node on a slide
// has a "Show on map" link back to the node itself. Sits at Modal.tsx's own top-of-stack
// z-index (z-50) — effectively a full-screen modal that owns the viewport.
export function PresentationOverlay({
  slides,
  index,
  onIndexChange,
  onExit,
  onOpenNode,
}: Props) {
  const { t } = useI18n();
  const slide = slides[index];
  if (!slide) return null;
  const { node, children } = slide;
  // The parent the slide's own head hangs from, when that one is in the show.
  const parentId = nodeRefId(node.parentId);
  const parent = parentId
    ? slides
        .flatMap((s) => [s.node, ...s.children])
        .find((n) => n.nodeId === parentId)
    : undefined;
  // A node's own slide (every node has one — see computeSlideGroups).
  const goTo = (nodeId: string) => {
    const i = slides.findIndex((g) => g.node.nodeId === nodeId);
    if (i >= 0) onIndexChange(i);
  };
  const atStart = index === 0;
  const atEnd = index === slides.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      <div className="flex items-center justify-between px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <span className="text-[0.85rem] text-ink-soft">
          {t.ui.presentation.slideCount(index + 1, slides.length)}
        </span>
        <button
          type="button"
          onClick={onExit}
          className="cursor-pointer rounded-lg border border-line bg-surface px-[0.7rem] py-[0.4rem] text-[0.8rem] font-semibold text-ink transition-colors duration-[120ms] hover:bg-surface-2"
        >
          {t.ui.presentation.exit}
        </button>
      </div>

      {/* min-h-0: a flex child otherwise refuses to shrink below its
          content, so overflow-y-auto never kicks in and the rows above and
          below get pushed off screen. The centering is my-auto on an inner
          column, not justify-center here: justify-center pushes a slide
          taller than the screen out past *both* edges, and the part above
          the top can't be scrolled back to. my-auto centers a short slide
          and lets a long one start at the top and scroll. */}
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4 text-center sm:px-8"
        data-slide-body
      >
        <div className="my-auto flex w-full flex-col items-center gap-4">
          {parent && (
            <button
              type="button"
              className="max-w-[700px] cursor-pointer truncate rounded-md px-2 py-1 text-[0.95rem] text-ink-soft hover:bg-surface-2"
              onClick={() => goTo(parent.nodeId)}
            >
              ↑ {t.ui.presentation.under(parent.title || parent.text || "")}
            </button>
          )}
          <SlideHead node={node} compact={children.length > 0} />
          <button
            type="button"
            className={linkCls}
            onClick={() => onOpenNode(node.nodeId)}
          >
            {t.ui.presentation.showOnMap}
          </button>
          {children.length > 0 && (
            <ul className="m-0 mt-2 grid w-full max-w-[900px] list-none grid-cols-1 gap-3 p-0 text-left sm:grid-cols-2">
              {children.map((c) => (
                <li
                  key={c.nodeId}
                  className="flex min-w-0 flex-col gap-2 rounded-card border-2 bg-surface p-3 transition-colors duration-[120ms] hover:bg-surface-2"
                  style={{ borderColor: NODE_TYPE_COLORS[c.type] }}
                >
                  {/* Tapping the card opens this child's own slide. */}
                  <button
                    type="button"
                    data-slide-child
                    className="flex min-w-0 cursor-pointer flex-col gap-2 border-0 bg-transparent p-0 text-left"
                    onClick={() => goTo(c.nodeId)}
                  >
                    <div className="flex items-center gap-2">
                      <NodeTypeSymbol type={c.type} size={18} />
                      <span
                        className="text-[0.75rem] font-bold tracking-[0.05em] uppercase"
                        style={{ color: NODE_TYPE_COLORS[c.type] }}
                      >
                        {t.ui.types[c.type]}
                      </span>
                    </div>
                    <p className="m-0 text-[1.05rem] leading-snug font-semibold break-words text-ink">
                      {c.title || c.text}
                    </p>
                    {c.title && (
                      <p className="m-0 text-[0.9rem] break-words text-ink-soft">
                        {c.text}
                      </p>
                    )}
                  </button>
                  <button
                    type="button"
                    className={`${linkCls} self-start`}
                    onClick={() => onOpenNode(c.nodeId)}
                  >
                    {t.ui.presentation.showOnMap}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
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

// The slide's parent: its type icon, large, its type, and its title (else
// text) as the headline, with the text as a second line when there is a
// title. Smaller when children share the slide, so they fit under it.
function SlideHead({ node, compact }: { node: NodeDoc; compact: boolean }) {
  const { t } = useI18n();
  return (
    <>
      <div
        className={`flex items-center justify-center rounded-full border-2 ${compact ? "h-12 w-12" : "h-16 w-16"}`}
        style={{ borderColor: NODE_TYPE_COLORS[node.type] }}
      >
        <NodeTypeSymbol type={node.type} size={compact ? 26 : 34} />
      </div>
      <span
        className="text-[1rem] font-bold tracking-[0.05em] uppercase"
        style={{ color: NODE_TYPE_COLORS[node.type] }}
      >
        {t.ui.types[node.type]}
      </span>
      <h1
        className={`m-0 max-w-[900px] leading-tight font-bold break-words text-ink ${
          compact
            ? "text-[1.6rem] sm:text-[2.2rem]"
            : "text-[2rem] sm:text-[2.8rem]"
        }`}
      >
        {node.title || node.text}
      </h1>
      {node.title && (
        <p className="m-0 max-w-[700px] text-[1.15rem] text-ink-soft">
          {node.text}
        </p>
      )}
    </>
  );
}
