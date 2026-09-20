import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { nodeClipboardSize } from "../utils/nodeClipboard";

interface Props {
  isOwner: boolean;
  onInvite: () => void;
  onCreateNode: () => void;
  onCreateCircle: () => void;
  onCopyMap: () => void;
  onPaste: () => void;
  onExportText: () => void;
  onClose: () => void;
}

// The simplified top toolbar's whole surface area now — a single "+"
// trigger (see MapPage's compact top-left floating cluster) opening this
// small dropdown instead of the old full-width bar of buttons. Positioned
// by its parent (a `relative` wrapper around the "+" button), opening
// *downward and left-aligned* since the trigger itself lives at the
// top-left of the screen — there's no room above it, and right-aligning
// would run the menu off the left edge. Same dismiss-on-outside-click/
// Escape pattern as NodeContextMenu, just without that one's fixed x/y
// placement.
export function AddMenu({ isOwner, onInvite, onCreateNode, onCreateCircle, onCopyMap, onPaste, onExportText, onClose }: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement | null>(null);
  // Read once as the menu opens — it mounts fresh each time, so this is what is on the clipboard right now.
  const [pasteCount] = useState(nodeClipboardSize);

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
    "block w-full cursor-pointer rounded-[6px] px-[0.7rem] py-[0.5rem] text-left text-[0.85rem] text-ink hover:bg-surface-2";

  return (
    <div
      ref={ref}
      className="absolute left-0 top-[calc(100%+0.4rem)] z-[60] flex min-w-[170px] flex-col gap-[0.15rem] rounded-card border border-line bg-surface p-[0.35rem] shadow-card"
    >
      {isOwner && (
        <button className={item} onClick={onInvite}>
          {t.map.addMenu.invite}
        </button>
      )}
      <button className={item} onClick={onCreateNode}>
        {t.map.addMenu.createNode}
      </button>
      <button className={item} onClick={onCreateCircle}>
        {t.map.addMenu.createCircle}
      </button>
      <button className={item} onClick={onCopyMap}>
        {t.ui.clipboard.copyWholeMap}
      </button>
      {pasteCount > 0 && (
        <button className={item} onClick={onPaste}>
          {t.ui.clipboard.paste(pasteCount)}
        </button>
      )}
      <button className={item} onClick={onExportText}>
        {t.map.addMenu.exportText}
      </button>
    </div>
  );
}
