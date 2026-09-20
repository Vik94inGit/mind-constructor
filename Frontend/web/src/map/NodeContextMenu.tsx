import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/I18nContext";

interface Props {
  x: number;
  y: number;
  /**
   * Owner sees Create/Update/Choose/Delete. canAttack already folds ownership
   * in on its own (see MapPage's canAttackNode, which mirrors attackAbl.ts's
   * own-node rule — an attack always lands on your own node) — so isOwner
   * and canAttack are true together on your own node, showing Attack
   * alongside the owner actions instead of only ever replacing them.
   */
  isOwner: boolean;
  canAttack: boolean;
  onCreate: () => void;
  onUpdate: () => void;
  onDelete: () => void;
  onChoose: () => void;
  onAttack: () => void;
  onClose: () => void;
}

// Fixed to the viewport (not the canvas) at the click point, like a native
// context menu — the canvas scrolls independently, so canvas-relative
// coordinates would drift away from the cursor as soon as anyone scrolled.
export function NodeContextMenu({ x, y, isOwner, canAttack, onCreate, onUpdate, onDelete, onChoose, onAttack, onClose }: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // Capture phase: this menu is the newest thing on the page, so it should
    // see the dismiss-triggering click/Escape before anything else does.
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose]);

  // Keep the menu on-screen even when the click was near an edge. Owner
  // actions (4 items) and Attack (1 item) aren't mutually exclusive any
  // more — canAttack can be true right alongside isOwner in discussion
  // mode (see the Props comment above) — so the height accounts for
  // whichever combination of the two is actually about to render.
  const MENU_W = 168;
  const ITEM_H = 34;
  const itemCount = (isOwner ? 4 : 0) + (canAttack ? 1 : 0);
  const MENU_H = itemCount * ITEM_H + 10;
  const left = Math.min(x, window.innerWidth - MENU_W - 8);
  const top = Math.min(y, window.innerHeight - MENU_H - 8);

  const item = "block w-full cursor-pointer rounded-[6px] px-[0.6rem] py-[0.45rem] text-left text-[0.85rem] text-ink hover:bg-surface-2";
  const itemDanger = "block w-full cursor-pointer rounded-[6px] px-[0.6rem] py-[0.45rem] text-left text-[0.85rem] text-danger hover:bg-surface-2";

  return (
    <div
      ref={ref}
      className="fixed z-[60] flex min-w-[160px] flex-col gap-[0.15rem] rounded-card border border-line bg-surface p-[0.35rem] shadow-card"
      style={{ left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {isOwner && (
        <>
          <button className={item} onClick={onCreate}>
            {t.ui.contextMenu.createBranch}
          </button>
          <button className={item} onClick={onUpdate}>
            {t.ui.contextMenu.update}
          </button>
          <button className={item} onClick={onChoose}>
            {t.ui.contextMenu.choose}
          </button>
          <button className={itemDanger} onClick={onDelete}>
            {t.ui.contextMenu.delete}
          </button>
        </>
      )}
      {canAttack && (
        <button className={itemDanger} onClick={onAttack}>
          {t.ui.contextMenu.attack}
        </button>
      )}
    </div>
  );
}
