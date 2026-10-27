import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { CARD_SIZE_MAX, CARD_SIZE_MIN } from "../types";
import type { CardShape } from "../types";

// The cards reading mode (see utils/readingMode.ts): a node drawn as a
// sticker card with its whole text. Its owner can resize it from the corner
// grip, and pick its text size and outline (Node.cardW/cardH/cardFont/
// cardShape). Cards glue together side to side and never pile up — see
// utils/cardGlue.ts.

/** A card's text size when its owner never picked one, px. */
export const CARD_FONT_DEFAULT = 12;

const RADIUS: Record<CardShape, string> = { rounded: "10px", square: "2px", round: "9999px" };

export interface StickerCardProps {
  /** The type color the card is edged in. */
  color: string;
  /** A ring drawn around the card (selection, drop target…), or none. */
  halo?: { color: string; dashed?: boolean; pulse?: boolean } | null;
  /** The viewer's own fill for this card (see utils/cardFill.ts); the theme's node fill when unset. */
  fill?: string;
  shape?: CardShape | null;
  /** The card's own size, in its own px (Node.cardW/cardH); sized to its text when unset. */
  width?: number | null;
  height?: number | null;
  /** Text size, px. */
  fontSize?: number | null;
  /** Screen px per card px — turns a drag on the grip into the card's own px. */
  screenScale?: number;
  /** Set when the viewer may resize this card: called once with the new size when the grip is let go. */
  onResize?: (size: { w: number; h: number }) => void;
  resizeHint?: string;
  /** Pressing the link handle starts dragging a connection out of this card (see MapPage's startPuzzleConnect). */
  onConnectStart?: (e: ReactPointerEvent) => void;
  /** The link handle's tooltip. */
  connectHint?: string;
  /** Set on the selected card of its owner: a + button under the card starts a branch from it (no quick-add ring rings a card). */
  onAddBranch?: () => void;
  addBranchHint?: string;
  /** Locked by its owner (utils/blockLock.ts): shows a padlock. */
  locked?: boolean;
  /** Locks/unlocks the block — the padlock becomes a button. Unset for someone else's card. */
  onToggleLock?: () => void;
  /** The padlock's tooltip, for its current state. */
  lockLabel?: string;
  minWidth: number;
  maxWidth: number;
  /** The node's type (or emoji) as a small icon on the card's top-left corner, so a card reads as its kind at a glance. */
  typeIcon?: ReactNode;
  /** The icon's name for a screen reader and its tooltip (the type's name). */
  typeLabel?: string;
  children: ReactNode;
}

export function StickerCard({
  color,
  halo,
  fill,
  shape,
  width,
  height,
  fontSize,
  screenScale = 1,
  onResize,
  resizeHint,
  onConnectStart,
  connectHint,
  onAddBranch,
  addBranchHint,
  locked = false,
  onToggleLock,
  lockLabel,
  minWidth,
  maxWidth,
  typeIcon,
  typeLabel,
  children,
}: StickerCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  // The size shown while the grip is being dragged.
  const [live, setLive] = useState<{ w: number; h: number } | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);

  function startResize(e: ReactPointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    const el = ref.current;
    if (!el || !onResize) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = el.offsetWidth;
    const startH = el.offsetHeight;
    const clamp = (v: number) => Math.round(Math.min(CARD_SIZE_MAX, Math.max(CARD_SIZE_MIN, v)));
    let size = { w: startW, h: startH };
    // The card stays centered on its spot, so it grows both ways: twice the
    // pointer's travel keeps the grip under the finger.
    const onMove = (ev: PointerEvent) => {
      size = {
        w: clamp(startW + (2 * (ev.clientX - startX)) / screenScale),
        h: clamp(startH + (2 * (ev.clientY - startY)) / screenScale),
      };
      setLive(size);
    };
    const finish = (commit: boolean) => {
      cleanup.current?.();
      setLive(null);
      if (commit && (size.w !== startW || size.h !== startH)) onResize(size);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    // The click that follows letting go would otherwise select or deselect.
    const swallow = (ce: MouseEvent) => ce.stopPropagation();
    cleanup.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      cleanup.current = null;
    };
  }

  const w = live?.w ?? width ?? null;
  const h = live?.h ?? height ?? null;
  const round = shape === "round";
  const ring = halo
    ? halo.dashed
      ? `0 0 0 2px var(--surface), 0 0 0 4px ${halo.color}`
      : `0 0 0 3px color-mix(in srgb, ${halo.color} 55%, transparent)`
    : null;
  const style: CSSProperties = {
    width: w ?? "max-content",
    minWidth: w ? undefined : minWidth,
    maxWidth: w ? undefined : maxWidth,
    height: h ?? undefined,
    fontSize: fontSize ?? CARD_FONT_DEFAULT,
    borderRadius: RADIUS[shape ?? "rounded"],
    padding: round ? "0.7em 1.4em" : "0.55em 0.85em",
    // The theme's fill with a faint wash of the type's color, so cards of
    // different types read apart at a glance; a fill the viewer picked is
    // shown as picked. The edge is the type's color, toned down.
    background: fill ?? `linear-gradient(color-mix(in srgb, ${color} 9%, transparent), color-mix(in srgb, ${color} 9%, transparent)), var(--node-fill)`,
    border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
    boxShadow: [ring, "0 1px 3px rgb(0 0 0 / 0.14)"].filter(Boolean).join(", "),
    // A custom fill is always a light swatch, so its text stays dark whatever the theme.
    color: fill ? "#1f2937" : undefined,
  };

  return (
    <div
      ref={ref}
      // Found by MapPage's gluing (utils/cardGlue.ts) to measure the card.
      data-puzzle-card
      data-card-shape={shape ?? "rounded"}
      className={`relative box-border flex flex-col text-left ${halo?.pulse ? "animate-pulse" : ""}`}
      style={style}
    >
      {typeIcon && (
        <span
          data-card-type
          role="img"
          aria-label={typeLabel}
          title={typeLabel}
          className="pointer-events-none absolute -top-[11px] -left-[11px] z-[2] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-surface shadow-card"
          style={{ border: `1.5px solid color-mix(in srgb, ${color} 70%, transparent)`, color }}
        >
          {typeIcon}
        </span>
      )}
      <div className={`relative flex min-h-0 flex-1 flex-col ${h ? "overflow-hidden" : ""}`}>{children}</div>
      {/* Link handle — the middle of the right edge. Dragging it onto
          another of your cards links the two (MapPage opens the link dialog). */}
      {onConnectStart && (
        <div
          role="button"
          aria-label={connectHint}
          title={connectHint}
          data-puzzle-handle
          className="pointer-events-auto absolute top-1/2 -right-[7px] z-[2] h-[14px] w-[14px] -translate-y-1/2 cursor-crosshair touch-none rounded-full border border-line bg-surface opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onConnectStart(e);
          }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      )}
      {/* Add a branch — the middle of the bottom edge, on the selected card
          only, where the quick-add ring would be for an icon. */}
      {onAddBranch && (
        <button
          type="button"
          aria-label={addBranchHint}
          title={addBranchHint}
          data-card-add
          className="pointer-events-auto absolute -bottom-[13px] left-1/2 z-[3] flex h-[26px] w-[26px] -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-accent bg-surface text-accent shadow-card hover:bg-accent hover:text-white"
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onAddBranch();
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M6 1.5 V10.5 M1.5 6 H10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {/* Resize grip — bottom-right corner, faint until hovered. */}
      {onResize && !locked && (
        <div
          role="button"
          aria-label={resizeHint}
          title={resizeHint}
          data-card-resize
          className="pointer-events-auto absolute right-[2px] bottom-[2px] z-[3] h-[14px] w-[14px] cursor-nwse-resize touch-none opacity-40 transition-opacity duration-150 group-hover:opacity-100"
          onPointerDown={startResize}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M13 5 L5 13 M13 9 L9 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
      )}
      {/* Lock — bottom-left corner. Solid on a locked block; faint on an
          unlocked one of your own (full strength while hovered), so it can
          be found on a touch screen too without shouting from every card.
          Also in the node panel and the right-click menu. */}
      {(locked || onToggleLock) && (
        <button
          type="button"
          className={`absolute -bottom-2 -left-2 z-[3] flex h-5 w-5 items-center justify-center rounded-full border text-[0.62rem] leading-none shadow-card transition-opacity duration-150 ${
            onToggleLock ? "pointer-events-auto cursor-pointer" : "pointer-events-none"
          } ${
            locked
              ? "border-accent bg-accent text-white"
              : "border-line bg-surface text-ink-soft opacity-40 group-hover:opacity-100 focus-visible:opacity-100"
          }`}
          title={lockLabel}
          aria-label={lockLabel}
          aria-pressed={locked}
          tabIndex={onToggleLock ? 0 : -1}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock?.();
          }}
        >
          <svg width="10" height="11" viewBox="0 0 10 11" aria-hidden="true">
            <rect x="1" y="4.6" width="8" height="6" rx="1.2" fill="currentColor" />
            <path
              d={locked ? "M2.8 4.8 V3.2 a2.2 2.2 0 0 1 4.4 0 V4.8" : "M2.8 4.8 V3.2 a2.2 2.2 0 0 1 4.3 -0.6"}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
