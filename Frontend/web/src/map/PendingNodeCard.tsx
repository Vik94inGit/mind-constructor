import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { NODE_TYPE_COLORS, cycleNodeType } from "../utils/nodeType";
import { OutcomeBadge, ringKindFor } from "./OutcomeBadge";
import type { OutcomeType } from "./OutcomeBadge";
import { NodeCrown } from "./NodeCrown";
import { useI18n } from "../i18n/I18nContext";
import { NodeTypeIcon } from "./NodeTypeIcon";
import type { NodeType } from "../types";

interface Props {
  x: number;
  y: number;
  type: NodeType;
  onConfirm: (text: string, type: NodeType) => void;
  onCancel: () => void;
  /** MapPage's own canvas zoom — see QuickAddGhosts' identical prop. This card is drawn inside the zoomed canvas the same as everything else, so it has to counter-scale by 1/zoom or it visibly balloons/shrinks along with whatever zoom level the map happens to be at instead of staying the same size on screen as a real node's own icon. */
  zoom?: number;
  /** Fires with the currently-armed draft type on mount and every time the type-cycle button changes it — lets MapPage's own negative-majority auto-reposition effect react live to whichever type is picked, before this card is ever confirmed into a real node. */
  onTypeChange?: (type: NodeType) => void;
}

// A not-yet-created node: same icon+caption footprint as a real NodeCard so
// it previews exactly where and as what the node will land, but nothing is
// sent to the backend until there's actual text — clicking a quick-add
// ghost (or the toolbar/double-click/"Create branch" paths) opens one of
// these instead of a modal, autofocused so typing can start immediately.
export function PendingNodeCard({ x, y, type, onConfirm, onCancel, zoom = 1, onTypeChange }: Props) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [draftType, setDraftType] = useState<NodeType>(type);
  // Also fires once on mount (with the starting type) — harmless: MapPage
  // already knows that starting type itself (it's what opened this card),
  // so being told it again a beat later changes nothing.
  useEffect(() => {
    onTypeChange?.(draftType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftType]);
  // Same single-resolution-point pattern as NodeCard's inline editor —
  // Escape blurs and defers to this flag instead of racing a separate path.
  const cancelingRef = useRef(false);
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  // Grow with the text — a row per line (Shift+Enter) or wrap — instead of
  // scrolling inside a one-line box.
  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const ring = ringKindFor(draftType);
  const isOutcome = !!ring;
  // 1/zoom — same counter-scale QuickAddGhosts' own `k` and NodeCard's own
  // inverseScaleStyle apply, and for the same reason: this card sits inside
  // MapPage's zoomed canvas wrapper (transform: scale(zoom)) same as every
  // node/ghost on it, so without this it would render at 48px * zoom instead
  // of a constant 48px — correct-looking at the default 100% zoom (which is
  // how this went unnoticed), but visibly oversized (or undersized) the
  // moment the map isn't at exactly 100%. Folded into the same transform as
  // the translate(-50%,-50%) centering below rather than a separate inner
  // wrapper (see NodeCard's own inverseScaleStyle comment for why it needs
  // one there) — nothing outside this component reads this card's own
  // layout footprint, so there's no separate "reserved space" to keep in
  // sync with the visual size the way NodeCard's ring/caption siblings need.
  const k = 1 / zoom;
  // z-[33]: same reasoning as QuickAddGhosts's own z-[33] — above MapPage's
  // full-screen NodePanel backdrop (z-30), which otherwise sits on top of
  // this input (the anchor node that opened it stays selected the whole
  // time this is up, so the backdrop never unmounts) and swallows every
  // tap meant for it.
  const classes =
    "absolute z-[33] flex w-[74px] flex-col items-center transition-[opacity,filter] duration-150 ease-[ease] cursor-default opacity-90";

  function resolve() {
    if (cancelingRef.current) {
      cancelingRef.current = false;
      onCancel();
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      onCancel();
      return;
    }
    onConfirm(trimmed, draftType);
  }

  return (
    <div
      className={classes}
      style={{ left: x, top: y, transform: `translate(-50%, -50%) scale(${k})` } as CSSProperties}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      // Without this, double-clicking to select a word while typing here
      // (or double-tapping the icon by mistake) bubbles a dblclick up to
      // the canvas — harmless today (the canvas has no double-click handler
      // of its own), but stays stopped so a stray double-click in here
      // never risks landing on whatever's underneath.
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="relative h-[48px] w-[48px]">
        {/* Same halo/horns crown a real node of this type gets — see
            NodeCrown's own doc comment. Without this, a not-yet-named
            pending node (still just a type + blank caption, before the
            first character is typed) rendered through the old oversized-
            badge/overflow-visible pattern instead of NodeCard's actual
            design, which is what read as "deformed" compared to every
            already-named node around it. */}
        <NodeCrown type={draftType} />
        <div
          className="flex h-full w-full items-center justify-center rounded-full p-[3px] shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_22%,transparent)] transition-transform duration-150 ease-[ease]"
          style={{ background: "conic-gradient(var(--success) 360deg, var(--surface-2) 0deg)" }}
        >
          <button
            type="button"
            className="flex h-full w-full cursor-pointer items-center justify-center rounded-full overflow-hidden border-2 bg-surface p-0 font-[inherit] shadow-card hover:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_35%,transparent)]"
            style={{ borderColor: NODE_TYPE_COLORS[draftType] }}
            title={t.ui.node.clickToChangeType}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setDraftType(cycleNodeType);
            }}
          >
            {isOutcome ? <OutcomeBadge type={draftType as OutcomeType} size={26} /> : <NodeTypeIcon type={draftType} size={21} />}
          </button>
        </div>
      </div>
      <textarea
        ref={fieldRef}
        rows={1}
        className="mt-[0.35rem] block w-full resize-none overflow-hidden rounded-[4px] border-[1.5px] border-accent bg-surface px-[0.25rem] py-[0.1rem] text-center text-[0.58rem] leading-[1.25] font-[inherit] text-ink focus:outline-none focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_30%,transparent)]"
        autoFocus
        value={text}
        placeholder={draftType}
        onChange={(e) => setText(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // Enter confirms; Shift+Enter is left to the textarea, which adds a row.
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancelingRef.current = true;
            e.currentTarget.blur();
          }
        }}
        onBlur={resolve}
      />
    </div>
  );
}
