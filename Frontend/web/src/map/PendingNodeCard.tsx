import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { NODE_TYPE_COLORS, cycleNodeType } from "../utils/nodeType";
import { OutcomeBadge, ringKindFor } from "./OutcomeBadge";
import type { OutcomeType } from "./OutcomeBadge";
import { NodeCrown } from "./NodeCrown";
import { NodeTypeIcon } from "./NodeTypeIcon";
import type { NodeType } from "../types";

interface Props {
  x: number;
  y: number;
  type: NodeType;
  onConfirm: (text: string, type: NodeType) => void;
  onCancel: () => void;
}

// A not-yet-created node: same icon+caption footprint as a real NodeCard so
// it previews exactly where and as what the node will land, but nothing is
// sent to the backend until there's actual text — clicking a quick-add
// ghost (or the toolbar/double-click/"Create branch" paths) opens one of
// these instead of a modal, autofocused so typing can start immediately.
export function PendingNodeCard({ x, y, type, onConfirm, onCancel }: Props) {
  const [text, setText] = useState("");
  const [draftType, setDraftType] = useState<NodeType>(type);
  // Same single-resolution-point pattern as NodeCard's inline editor —
  // Escape blurs and defers to this flag instead of racing a separate path.
  const cancelingRef = useRef(false);

  const ring = ringKindFor(draftType);
  const isOutcome = !!ring;
  // Plain `transform:` arbitrary value, not Tailwind's -translate-x-1/2
  // utility — see the identical note in NodeCard.tsx. This element doesn't
  // currently animate `transform`, so it isn't actually double-offset today,
  // but staying consistent means it won't silently become double-offset the
  // moment something here ever does.
  // z-[33]: same reasoning as QuickAddGhosts's own z-[33] — above MapPage's
  // full-screen NodePanel backdrop (z-30), which otherwise sits on top of
  // this input (the anchor node that opened it stays selected the whole
  // time this is up, so the backdrop never unmounts) and swallows every
  // tap meant for it.
  const classes =
    "absolute z-[33] flex w-[92px] [transform:translate(-50%,-50%)] flex-col items-center transition-[opacity,filter] duration-150 ease-[ease] cursor-default opacity-90";

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
      style={{ left: x, top: y } as CSSProperties}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      // Without this, double-clicking to select a word while typing here
      // (or double-tapping the icon by mistake) bubbles a dblclick up to
      // the canvas, which now reads any double-click as "zoom in here" —
      // see MapPage's onCanvasDoubleClick.
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="relative h-[60px] w-[60px]">
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
            title="Click to change type"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setDraftType(cycleNodeType);
            }}
          >
            {isOutcome ? <OutcomeBadge type={draftType as OutcomeType} size={32} /> : <NodeTypeIcon type={draftType} size={26} />}
          </button>
        </div>
      </div>
      <input
        className="mt-[0.35rem] w-full rounded-[4px] border-[1.5px] border-accent bg-surface px-[0.25rem] py-[0.1rem] text-center text-[0.72rem] leading-[1.25] font-[inherit] text-ink focus:outline-none focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_30%,transparent)]"
        autoFocus
        value={text}
        placeholder={draftType}
        onChange={(e) => setText(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
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
