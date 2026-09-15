import { useEffect, useRef } from "react";
import { NODE_TYPES } from "../types";
import type { NodeType } from "../types";
import { NodeTypeIcon } from "./NodeTypeIcon";
import { OutcomeBadge, ringKindFor } from "./OutcomeBadge";
import type { OutcomeType } from "./OutcomeBadge";

interface Props {
  x: number;
  y: number;
  onPick: (type: NodeType) => void;
  onClose: () => void;
}

// Right-click on *empty* canvas (as opposed to NodeContextMenu, which is
// right-click on a node) — a small type-picker for creating a new, parent-
// less node right at the click point. Fixed to the viewport at the click
// point, same reasoning as NodeContextMenu's own doc comment (the canvas
// scrolls independently of viewport coordinates). Picking a type doesn't
// create anything itself — see MapPage's onCanvasContextMenu/onPick wiring,
// which opens the usual PendingNodeCard at this same spot, same as every
// other node-creation path (toolbar, quick-add ghosts, "Create branch").
export function CanvasContextMenu({ x, y, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose]);

  // Same on-screen clamping as NodeContextMenu — keeps the menu fully
  // visible even when the click landed near a screen edge.
  const MENU_W = 190;
  const ITEM_H = 34;
  const MENU_H = NODE_TYPES.length * ITEM_H + 10;
  const left = Math.min(x, window.innerWidth - MENU_W - 8);
  const top = Math.min(y, window.innerHeight - MENU_H - 8);

  const item =
    "flex w-full cursor-pointer items-center gap-[0.5rem] rounded-[6px] px-[0.6rem] py-[0.4rem] text-left text-[0.85rem] text-ink hover:bg-surface-2";

  return (
    <div
      ref={ref}
      className="fixed z-[60] flex min-w-[180px] flex-col gap-[0.15rem] rounded-card border border-line bg-surface p-[0.35rem] shadow-card"
      style={{ left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {NODE_TYPES.map((type) => (
        <button key={type} className={item} onClick={() => onPick(type)}>
          {/* Same symbol the real node will actually render once created
              (OutcomeBadge, not NodeTypeIcon's own separate glyph set) —
              this picker used to show a different icon per type than the
              node it created ended up with, reading as "wait, that's not
              what I picked" the moment the real one appeared. "unknown"
              alone has no outcome symbol to match, so it keeps its own
              plain NodeTypeIcon glyph, same as the real node does. */}
          {ringKindFor(type) ? (
            <OutcomeBadge type={type as OutcomeType} size={16} />
          ) : (
            <NodeTypeIcon type={type} size={16} />
          )}
          {type}
        </button>
      ))}
    </div>
  );
}
