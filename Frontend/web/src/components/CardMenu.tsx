import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface CardMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

// A "⋮" trigger that opens a small fixed-position menu anchored under the
// button — same dismiss-on-outside-click/Escape behavior and the same
// `.node-context-menu*` styling as the canvas's right-click node menu
// (NodeContextMenu), just anchored to a button's rect instead of a click
// point.
//
// Rendered through a portal into document.body rather than inline where the
// trigger lives: the trigger sits inside a `.map-card`, and `.map-card:hover`
// applies a `transform` — which creates a new *containing block* for any
// `position: fixed` descendant. Left inline, the menu's "fixed, viewport-
// relative" coordinates would get reinterpreted relative to the hovered
// card instead, landing it in the wrong spot and nested inside the card's
// own (lower) stacking context instead of the page's. Portaling to body
// sidesteps both: the menu is never a descendant of anything that could
// transform it.
export function CardMenu({ items }: { items: CardMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  function toggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const MENU_W = 160;
      const left = Math.min(rect.left, window.innerWidth - MENU_W - 8);
      const top = Math.min(rect.bottom + 4, window.innerHeight - items.length * 40 - 8);
      setPos({ left, top });
    }
    setOpen((v) => !v);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-transparent bg-transparent px-[0.6rem] py-[0.25rem] text-[1.1rem] leading-none font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Map menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        &#8942;
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[60] flex min-w-[160px] flex-col gap-[0.15rem] rounded-card border border-line bg-surface p-[0.35rem] shadow-card"
            style={{ left: pos.left, top: pos.top }}
            role="menu"
          >
            {items.map((item) => (
              <button
                key={item.label}
                role="menuitem"
                className={`block w-full cursor-pointer rounded-[6px] px-[0.6rem] py-[0.45rem] text-left text-[0.85rem] hover:bg-surface-2 ${
                  item.danger ? "text-danger" : "text-ink"
                }`}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
