import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext";
import { MAP_KINDS, NODE_TYPES } from "../types";
import type { MapKind, NodeType } from "../types";
import { MAP_KIND_ROOTS } from "../utils/templates";
import { isMobileViewport } from "../utils/canvasLayout";
import { NodeTypeIcon } from "./NodeTypeIcon";
import { OutcomeBadge, ringKindFor } from "./OutcomeBadge";
import type { OutcomeType } from "./OutcomeBadge";

interface Props {
  x: number;
  y: number;
  onPick: (type: NodeType) => void;
  /** Grows a ready-made structure ("Analyze a problem", "Plan a goal"…) at the click point. */
  onGrow: (kind: MapKind) => void;
  /** Opens "Text → nodes": a text cut into nodes right at the click point. */
  onTextToNodes: () => void;
  /** Opens "Text → map". */
  onTextToMap: () => void;
  /** How many nodes are on the clipboard right now — 0 hides "Paste here". */
  pasteCount: number;
  onPasteHere: () => void;
  onClose: () => void;
}

const MENU_W = 230;
const SUB_W = 200;
const ITEM_H = 34;

// The same symbol the real node will render once created (OutcomeBadge, not
// NodeTypeIcon's separate glyph set) — otherwise the picker would show a
// different icon per type than the node it ends up making. "unknown" alone
// has no outcome symbol, so it keeps its plain NodeTypeIcon glyph, same as
// the real node does.
function TypeSymbol({ type }: { type: NodeType }) {
  return ringKindFor(type) ? <OutcomeBadge type={type as OutcomeType} size={16} /> : <NodeTypeIcon type={type} size={16} />;
}

// Right-click on *empty* canvas (as opposed to NodeContextMenu, which is
// right-click on a node), like a desktop's own context menu:
//   - Paste here (when something is on the app's clipboard)
//   - New node ▸ — a submenu of the node types; picking one opens the usual
//     PendingNodeCard at the click point (see MapPage's onPick wiring)
//   - Analyze a problem / Plan a goal / Make a decision / Look back — the
//     starter structure of that map kind, grown right at the click point
//   - Text → nodes here (a text cut into nodes at the click point) / Text → map
// Fixed to the viewport at the click point, same reasoning as
// NodeContextMenu's own doc comment (the canvas scrolls independently of
// viewport coordinates). The submenu flies out to the side on a wide screen
// (on hover or click) and opens in place on a phone, where there's no room
// beside the menu.
export function CanvasContextMenu({ x, y, onPick, onGrow, onTextToNodes, onTextToMap, pasteCount, onPasteHere, onClose }: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement | null>(null);
  const [typesOpen, setTypesOpen] = useState(false);
  const inline = isMobileViewport();

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

  // Same on-screen clamping as NodeContextMenu — keeps the menu (and its
  // submenu) fully visible even when the click landed near a screen edge.
  const rows = (pasteCount > 0 ? 1 : 0) + 1 + MAP_KINDS.length + 2 + (inline && typesOpen ? NODE_TYPES.length : 0);
  const MENU_H = rows * ITEM_H + 24;
  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_W - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - MENU_H - 8));
  // The flyout opens to the right, or to the left when the right has no room.
  const flyLeft = left + MENU_W + SUB_W + 8 > window.innerWidth;
  const typesRowTop = (pasteCount > 0 ? ITEM_H : 0) + 6;
  const SUB_H = NODE_TYPES.length * ITEM_H + 10;
  const subTop = Math.min(typesRowTop, window.innerHeight - top - SUB_H - 8);

  const item =
    "flex w-full cursor-pointer items-center gap-[0.5rem] rounded-[6px] px-[0.6rem] py-[0.4rem] text-left text-[0.85rem] text-ink hover:bg-surface-2";
  const divider = <div className="my-[0.15rem] border-t border-line" role="separator" />;

  const typeButtons = NODE_TYPES.map((type) => (
    <button key={type} role="menuitem" className={item} onClick={() => onPick(type)}>
      <TypeSymbol type={type} />
      {t.ui.types[type]}
    </button>
  ));

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[60] flex flex-col gap-[0.15rem] rounded-card border border-line bg-surface p-[0.35rem] shadow-card"
      style={{ left, top, width: MENU_W }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {pasteCount > 0 && (
        <button role="menuitem" className={`${item} font-semibold`} onClick={onPasteHere}>
          {t.ui.clipboard.pasteHere(pasteCount)}
        </button>
      )}

      <div
        className="relative"
        onMouseEnter={inline ? undefined : () => setTypesOpen(true)}
        onMouseLeave={inline ? undefined : () => setTypesOpen(false)}
      >
        <button
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={typesOpen}
          className={`${item} ${typesOpen ? "bg-surface-2" : ""}`}
          onClick={() => setTypesOpen((v) => !v)}
        >
          <span aria-hidden="true" className="inline-flex w-4 justify-center font-bold">
            +
          </span>
          <span className="flex-1">{t.ui.canvasMenu.newNode}</span>
          <span aria-hidden="true" className="text-ink-soft">
            {inline ? (typesOpen ? "▾" : "▸") : "▸"}
          </span>
        </button>
        {typesOpen && !inline && (
          <div
            role="menu"
            className="absolute z-[61] flex flex-col gap-[0.15rem] rounded-card border border-line bg-surface p-[0.35rem] shadow-card"
            style={{
              width: SUB_W,
              top: subTop - typesRowTop,
              ...(flyLeft ? { right: "calc(100% + 0.35rem)" } : { left: "calc(100% + 0.35rem)" }),
            }}
          >
            {typeButtons}
          </div>
        )}
      </div>
      {typesOpen && inline && <div className="ml-3 flex flex-col gap-[0.15rem]">{typeButtons}</div>}

      {divider}
      {MAP_KINDS.map((kind) => (
        <button key={kind} role="menuitem" className={item} onClick={() => onGrow(kind)}>
          <TypeSymbol type={MAP_KIND_ROOTS[kind].type} />
          {t.ui.canvasMenu.structures[kind]}
        </button>
      ))}

      {divider}
      <button role="menuitem" className={`${item} font-semibold`} onClick={onTextToNodes}>
        {t.ui.textNodes.entry}
      </button>
      <button role="menuitem" className={item} onClick={onTextToMap}>
        {t.split.entry}
      </button>
    </div>
  );
}
