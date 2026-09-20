import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/I18nContext";
import type { ReadingMode } from "../utils/readingMode";

interface Props {
  count: number;
  canGroupCircle: boolean;
  canLink: boolean;
  onLink: () => void;
  onNumber: () => void;
  /** Show the chosen nodes in this reading mode; null = the same as the map. */
  onDisplay: (mode: ReadingMode | null) => void;
  onClearNumbers: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onCopyText: () => void;
  onGroupCircle: () => void;
  onClose: () => void;
}

// The multi-select pill's own "Actions" dropdown (see MapPage's group-
// selection bottom sheet) — Link/Copy/Copy as text/Group into circle/Delete for
// the current multiSelectIds. Positioned by its parent (a `relative` wrapper
// around the trigger button), opening *upward* since the pill itself lives
// at the very bottom of the screen — the trigger sits on the *left* side of
// the pill, next to the selection count (not next to Deselect on the
// right), on purpose: the pill's right side is exactly where the minimap/
// zoom-controls cluster already floats, and this menu opening from there
// would run straight under/behind them. Same dismiss-on-outside-click/
// Escape pattern as every other menu in this app (NodeContextMenu,
// CanvasContextMenu, AddMenu).
export function SelectionMenu({ count, canGroupCircle, canLink, onLink, onNumber, onDisplay, onClearNumbers, onDelete, onCopy, onCopyText, onGroupCircle, onClose }: Props) {
  const { t } = useI18n();
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
      <button
        className={item}
        onClick={onLink}
        disabled={!canLink}
        title={canLink ? undefined : t.ui.selection.needTwoToLink}
      >
        {t.ui.selection.link}
      </button>
      <button className={item} onClick={onNumber} title={t.ui.selection.numberTitle}>
        {t.ui.selection.number}
      </button>
      <button className={item} onClick={onClearNumbers}>
        {t.ui.selection.clearNumbers}
      </button>
      {/* How the chosen nodes read — independent of the map-wide reading mode. */}
      <div className="mt-[0.15rem] border-t border-line px-[0.7rem] pt-[0.4rem] pb-[0.1rem] text-[0.68rem] font-semibold tracking-[0.04em] text-ink-soft uppercase">
        {t.ui.display.header}
      </div>
      <button className={item} onClick={() => onDisplay("actual")}>
        {t.map.toolbar.readingActual}
      </button>
      <button className={item} onClick={() => onDisplay("iconText")}>
        {t.map.toolbar.readingIconText}
      </button>
      <button className={item} onClick={() => onDisplay("classic")}>
        {t.map.toolbar.readingClassic}
      </button>
      <button className={item} onClick={() => onDisplay(null)}>
        {t.ui.display.followMap}
      </button>
      <div className="mb-[0.15rem] border-t border-line" />
      <button className={item} onClick={onCopy}>
        {t.ui.selection.copy}
      </button>
      <button className={item} onClick={onCopyText}>
        {t.ui.selection.copyText}
      </button>
      <button
        className={item}
        onClick={onGroupCircle}
        disabled={!canGroupCircle}
        title={canGroupCircle ? undefined : t.ui.selection.needTwoToGroup}
      >
        {t.ui.selection.groupCircle}
      </button>
      <button className={itemDanger} onClick={onDelete}>
        {t.ui.selection.deleteN(count)}
      </button>
    </div>
  );
}
