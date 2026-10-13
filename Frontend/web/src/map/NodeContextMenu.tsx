import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { NODE_TYPES } from "../types";
import type { NodeType } from "../types";
import { ZONE_LAYOUTS, zoneLayoutLabel } from "../utils/zoneLayout";
import type { ZoneLayout } from "../utils/zoneLayout";
import type { ZonePaletteColor, ZonePattern } from "../types";
import { ZoneStylePicker } from "./ZoneStylePicker";

/** One of the node's links, as a row in the "Remove links" submenu. */
export interface NodeLinkItem {
  key: string;
  label: string;
  onRemove: () => void;
}

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
  /** Owner only: this node is locked (utils/blockLock.ts) — the menu offers Unlock instead of Lock. */
  blockLocked?: boolean;
  onToggleBlockLock?: () => void;
  /** Owner only, puzzle cards only: taking it out of its puzzle on demand, or putting it back. */
  puzzle?: {
    detached: boolean;
    /** Part of an assembled puzzle right now (clicked together with another piece). */
    assembled: boolean;
    onDetach: () => void;
    onTakeApart: () => void;
    onAttach: () => void;
  };
  /** Owner only: the node's links (to its parent, its children, link edges), each removable on its own. */
  links?: NodeLinkItem[];
  onRemoveAllLinks?: () => void;
  /** A parent only: how its branch draws zones — its own choice, or null when it follows the map. */
  zoneLayout?: { value: ZoneLayout | null; onPick: (layout: ZoneLayout | null) => void };
  /** A parent you own: its zone's pattern and colour, shown under the layouts in the Zones submenu. */
  zoneStyle?: {
    pattern: ZonePattern | null;
    color: ZonePaletteColor | null;
    autoColor: string;
    onChange: (patch: { zonePattern?: ZonePattern | null; zoneColor?: ZonePaletteColor | null }) => void;
  };
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
  blockLocked = false,
  onToggleBlockLock,
  puzzle,
  links = [],
  onRemoveAllLinks,
  zoneLayout,
  zoneStyle,
}: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement | null>(null);
  // A one-level drill-down (root actions <-> the type list) instead of a
  // native-style flyout submenu — simpler to keep on-screen at every click
  // position, and this menu only ever needs the one extra level.
  const [mode, setMode] = useState<"root" | "type" | "links" | "zones">("root");

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Escape backs out of the type list first, same as most drill-down
      // menus — only a second Escape (or a click outside) actually closes.
      if (mode !== "root") setMode("root");
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
  const MENU_W = mode === "type" ? 220 : mode === "links" || mode === "zones" ? 260 : 168;
  const ITEM_H = 34;
  const puzzleItemCount = !puzzle ? 0 : puzzle.detached ? 1 : puzzle.assembled ? 2 : 0;
  const showLinks = isOwner && links.length > 0;
  const rootItemCount =
    (isOwner ? 5 + (onToggleBlockLock ? 1 : 0) + puzzleItemCount + (showLinks ? 1 : 0) : 0) +
    (zoneLayout ? 1 : 0) +
    (canAttack ? 1 : 0);
  const linkItemCount = links.length + (onRemoveAllLinks && links.length > 1 ? 1 : 0);
  const itemCount =
    mode === "type"
      ? NODE_TYPES.length + 1
      : mode === "links"
        ? linkItemCount + 1
        : mode === "zones"
          ? ZONE_LAYOUTS.length + 2 + (zoneStyle ? 4 : 0)
          : rootItemCount;
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
          {showLinks && (
            <button className={item} onClick={() => setMode("links")}>
              {t.ui.contextMenu.unlink} ›
            </button>
          )}
          {onToggleBlockLock && (
            <button
              className={item}
              onClick={() => {
                onToggleBlockLock();
                onClose();
              }}
            >
              {blockLocked ? `🔓 ${t.ui.display.unlockBlock}` : `🔒 ${t.ui.display.lockBlock}`}
            </button>
          )}
          {puzzle?.detached && (
            <button
              className={item}
              onClick={() => {
                puzzle.onAttach();
                onClose();
              }}
            >
              🧩 {t.ui.display.attachPiece}
            </button>
          )}
          {puzzle && !puzzle.detached && puzzle.assembled && (
            <>
              <button
                className={item}
                onClick={() => {
                  puzzle.onDetach();
                  onClose();
                }}
              >
                ✂️ {t.ui.display.detachPiece}
              </button>
              <button
                className={item}
                onClick={() => {
                  puzzle.onTakeApart();
                  onClose();
                }}
              >
                🧱 {t.ui.display.takePuzzleApart}
              </button>
            </>
          )}
          <button className={itemDanger} onClick={onDelete}>
            {t.ui.contextMenu.delete}
          </button>
        </>
      )}
      {mode === "root" && zoneLayout && (
        <button className={item} onClick={() => setMode("zones")}>
          {t.ui.contextMenu.zones} ›
        </button>
      )}
      {mode === "root" && canAttack && (
        <button className={itemDanger} onClick={onAttack}>
          {t.ui.contextMenu.attack}
        </button>
      )}
      {mode === "links" && (
        <>
          <button className={item} onClick={() => setMode("root")}>
            ‹ {t.ui.contextMenu.back}
          </button>
          {links.map((l) => (
            <button
              key={l.key}
              className={`${item} truncate`}
              title={l.label}
              onClick={() => {
                l.onRemove();
                onClose();
              }}
            >
              ✂️ {l.label}
            </button>
          ))}
          {onRemoveAllLinks && links.length > 1 && (
            <button
              className={itemDanger}
              onClick={() => {
                onRemoveAllLinks();
                onClose();
              }}
            >
              {t.ui.contextMenu.unlinkAll}
            </button>
          )}
        </>
      )}
      {mode === "zones" && zoneLayout && (
        <>
          <button className={item} onClick={() => setMode("root")}>
            ‹ {t.ui.contextMenu.back}
          </button>
          {[null, ...ZONE_LAYOUTS].map((l) => (
            <button
              key={l ?? "map"}
              role="menuitemradio"
              aria-checked={zoneLayout.value === l}
              className={zoneLayout.value === l ? itemActive : item}
              onClick={() => {
                zoneLayout.onPick(l);
                onClose();
              }}
            >
              {l === null ? t.ui.display.followMap : zoneLayoutLabel(t.ui.display, l)}
            </button>
          ))}
          {zoneStyle && (
            <>
              <div className="my-[0.15rem] border-t border-line" />
              <ZoneStylePicker
                idPrefix="node-menu-zone"
                pattern={zoneStyle.pattern}
                color={zoneStyle.color}
                autoColor={zoneStyle.autoColor}
                onPattern={(p) => zoneStyle.onChange({ zonePattern: p })}
                onColor={(c) => zoneStyle.onChange({ zoneColor: c })}
              />
            </>
          )}
        </>
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
