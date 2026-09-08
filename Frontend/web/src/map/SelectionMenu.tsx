import { useEffect, useRef } from "react";

interface Props {
  count: number;
  canGroupCircle: boolean;
  onDelete: () => void;
  onCopy: () => void;
  onGroupCircle: () => void;
  onClose: () => void;
}

// The multi-select pill's own "Actions" dropdown (see MapPage's group-
// selection bottom sheet) — Delete/Copy/Group into circle for the current
// multiSelectIds. Positioned by its parent (a `relative` wrapper around the
// trigger button), opening *upward* since the pill itself lives at the very
// bottom of the screen — the trigger sits on the *left* side of the pill,
// next to the selection count (not next to Deselect on the right), on
// purpose: the pill's right side is exactly where the minimap/zoom-controls
// cluster already floats, and this menu opening from there would run
// straight under/behind them. Same dismiss-on-outside-click/Escape pattern
// as every other menu in this app (NodeContextMenu, CanvasContextMenu,
// AddMenu).
export function SelectionMenu({ count, canGroupCircle, onDelete, onCopy, onGroupCircle, onClose }: Props) {
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

  const item =
    "block w-full cursor-pointer rounded-[6px] px-[0.7rem] py-[0.5rem] text-left text-[0.85rem] text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";
  const itemDanger =
    "block w-full cursor-pointer rounded-[6px] px-[0.7rem] py-[0.5rem] text-left text-[0.85rem] text-danger hover:bg-surface-2";

  return (
    <div
      ref={ref}
      className="absolute left-0 bottom-[calc(100%+0.4rem)] z-[60] flex min-w-[190px] flex-col gap-[0.15rem] rounded-card border border-line bg-surface p-[0.35rem] shadow-card"
    >
      <button className={item} onClick={onCopy}>
        Copy
      </button>
      <button
        className={item}
        onClick={onGroupCircle}
        disabled={!canGroupCircle}
        title={canGroupCircle ? undefined : "Select at least 2 nodes to group them"}
      >
        Group into circle
      </button>
      <button className={itemDanger} onClick={onDelete}>
        Delete {count} node{count === 1 ? "" : "s"}
      </button>
    </div>
  );
}
