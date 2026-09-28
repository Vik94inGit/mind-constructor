import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { NODE_TYPES } from "../types";
import type { NodeType } from "../types";

interface Props {
  x: number;
  y: number;
  /**
   * Owner sees Create/Edit/Change type/Choose/Delete. canAttack already folds
   * ownership in on its own (see MapPage's canAttackNode, which mirrors
   * attackAbl.ts's own-node rule — an attack always lands on your own node) —
   * so isOwner and canAttack are true together on your own node, showing
   * Attack alongside the owner actions instead of only ever replacing them.
   */
  isOwner: boolean;
  canAttack: boolean;
  /** The node's own current type — used to highlight it in the Change type submenu. */
  nodeType: NodeType;
  onCreate: () => void;
  /** Selects the node, which opens the full node panel — distinct from the
   *  canvas's own inline editor (double-click), which stays untouched. */
  onEdit: () => void;
  onChangeType: (type: NodeType) => void;
  onDelete: () => void;
  onChoose: () => void;
  onAttack: () => void;
  onClose: () => void;
}

// Fixed to the viewport (not the canvas) at the click point, like a native
// context menu — the canvas scrolls independently, so canvas-relative
// coordinates would drift away from the cursor as soon as anyone scrolled.
export function NodeContextMenu({
  x,
  y,
  isOwner,
  canAttack,
  nodeType,
  onCreate,
  onEdit,
  onChangeType,
  onDelete,
  onChoose,
  onAttack,
  onClose,
}: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement | null>(null);
  // A one-level drill-down (root actions <-> the type list) instead of a
  // native-style flyout submenu — simpler to keep on-screen at every click
  // position, and this menu only ever needs the one extra level.
  const [mode, setMode] = useState<"root" | "type">("root");

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Escape backs out of the type list first, same as most drill-down
      // menus — only a second Escape (or a click outside) actually closes.
      if (mode === "type") setMode("root");
      else onClose();
    }
    // Capture phase: this menu is the newest thing on the page, so it should
    // see the dismiss-triggering click/Escape before anything else does.
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose, mode]);

  // Keep the menu on-screen even when the click was near an edge. Owner
  // actions (5 items: Create/Edit/Change type/Choose/Delete) and Attack (1
  // item) aren't mutually exclusive any more — canAttack can be true right
  // alongside isOwner in discussion mode (see the Props comment above) — so
  // the height accounts for whichever combination of the two is actually
  // about to render, and the type-list mode (a back row + one row per
  // NodeType) sizes itself independently.
  // Wider in type mode — some locales' longer type names (e.g. Czech
  // "Problematická varianta") wrap inside the root menu's normal 168px.
  const MENU_W = mode === "type" ? 220 : 168;
  const ITEM_H = 34;
  const rootItemCount = (isOwner ? 5 : 0) + (canAttack ? 1 : 0);
  const itemCount = mode === "type" ? NODE_TYPES.length + 1 : rootItemCount;
  const MENU_H = itemCount * ITEM_H + 10;
  const left = Math.min(x, window.innerWidth - MENU_W - 8);
  const top = Math.min(y, window.innerHeight - MENU_H - 8);

  const item = "block w-full cursor-pointer rounded-[6px] px-[0.6rem] py-[0.45rem] text-left text-[0.85rem] text-ink hover:bg-surface-2";
  const itemDanger = "block w-full cursor-pointer rounded-[6px] px-[0.6rem] py-[0.45rem] text-left text-[0.85rem] text-danger hover:bg-surface-2";
  const itemActive = "block w-full cursor-pointer rounded-[6px] px-[0.6rem] py-[0.45rem] text-left text-[0.85rem] font-semibold text-accent bg-surface-2";

  return (
    <div
      ref={ref}
      className="fixed z-[60] flex min-w-[160px] flex-col gap-[0.15rem] rounded-card border border-line bg-surface p-[0.35rem] shadow-card"
      style={{ left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {mode === "root" && isOwner && (
        <>
          <button className={item} onClick={onCreate}>
            {t.ui.contextMenu.createBranch}
          </button>
          <button className={item} onClick={onEdit}>
            {t.ui.contextMenu.edit}
          </button>
          <button className={item} onClick={() => setMode("type")}>
            {t.ui.contextMenu.changeType} ›
          </button>
          <button className={item} onClick={onChoose}>
            {t.ui.contextMenu.choose}
          </button>
          <button className={itemDanger} onClick={onDelete}>
            {t.ui.contextMenu.delete}
          </button>
        </>
      )}
      {mode === "root" && canAttack && (
        <button className={itemDanger} onClick={onAttack}>
          {t.ui.contextMenu.attack}
        </button>
      )}
      {mode === "type" && (
        <>
          <button className={item} onClick={() => setMode("root")}>
            ‹ {t.ui.contextMenu.back}
          </button>
          {NODE_TYPES.map((ty) => (
            <button
              key={ty}
              className={ty === nodeType ? itemActive : item}
              onClick={() => {
                if (ty !== nodeType) onChangeType(ty);
                onClose();
              }}
            >
              {t.ui.types[ty]}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
