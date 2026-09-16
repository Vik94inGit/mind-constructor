import { effectiveRingKind } from "./OutcomeBadge";
import type { NodeType, SymbolOverride } from "../types";

// The halo/horns crown always draws in one of these two, regardless of
// the specific type's own border color (which stays per-type — blue for
// Option, teal for Solution, amber for Problematic option, and so on) —
// a halo reads as "halo" by being gold and horns read as "horns" by being
// red, the same fixed identity real halo/horns iconography has, not by
// matching whatever color the node under it happens to be.
const HALO_GOLD = "#c9a94a";
const HORNS_RED = "#b23a48";

// A small decoration sitting just above a node's own 48px icon circle —
// shared by NodeCard (a real node's own icon) and QuickAddGhosts (the
// type-preview ghosts fanned around a selected node), so a ghost actually
// previews what the real node is about to look like instead of just its
// bare symbol. Assumes a 48px circle directly below it (both callers use
// that size) — independent of OutcomeBadge rather than living inside its
// SVG, since OutcomeBadge's own canvas would have to be exactly that 48px
// circle's size for the two to align at all, and every attempt to cram
// the ring, wings, and health all into one shared canvas left something
// misaligned or clipped somewhere. Halo fills with var(--node-fill) — the
// same theme-aware color the real node's own icon circle underneath it
// fills with, see index.css — horns fill solid (HORNS_RED) instead; a
// devil's horns read as a solid dark shape, not an outline. Returns null
// for a type with no halo/horns framing ("unknown", or a type ringKindFor
// doesn't classify).
//
// Rendered width/offset below are 0.8x their original 34/13 (halo) and
// 28/11 (horns) — the node icon's own -20% resize — with every path/stroke
// coordinate inside each viewBox left alone, so the whole drawing just
// scales down uniformly rather than needing separately-tuned small-size
// numbers that could drift out of proportion over time. The halo's own
// height/viewBox are the one exception (see its own comment) — padded
// taller than a strict 0.8x of 20 to leave room for its outline ellipse.
export function NodeCrown({
  type,
  symbolOverride,
}: {
  type: NodeType;
  /** Manually forces halo/horns to match a check/cross override — see effectiveRingKind. */
  symbolOverride?: SymbolOverride | null;
}) {
  const kind = effectiveRingKind(type, symbolOverride);
  if (!kind) return null;

  if (kind === "halo") {
    return (
      <svg
        width="27.2"
        height="19.2"
        // Taller viewBox than the halo itself needs (24, not the original
        // 20) purely to give the new outline ellipse below room to extend
        // past the real halo's own edge without the SVG's own boundary
        // clipping it — cy stays 12, so this only adds transparent padding
        // below the shape (toward the node icon, already visually merged
        // with it) and never shifts where the halo itself sits. Rendered
        // height scaled up to match (19.2 = 24 * the same 0.8 factor width
        // and the old height already used — see this file's own top
        // doc comment), so the halo's own on-screen size is unchanged.
        viewBox="0 0 34 24"
        className="pointer-events-none absolute -top-[10.4px] left-1/2 z-[1] -translate-x-1/2"
        // A soft drop-shadow, not just the gold stroke alone — var(--surface)
        // is #ffffff in light mode, the same near-white as the map's own
        // --paper background it sits on, so the fill alone used to all but
        // disappear there, leaving just a thin gold ring with no visible
        // disc behind it. The shadow gives the halo a real edge against any
        // background regardless of theme (harmless, if redundant, in dark
        // mode where --surface already contrasts against --paper on its
        // own).
        style={{ filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35))" }}
        aria-hidden="true"
      >
        {/* A plain black outline ring in light mode, not a drop-shadow — a
            shadow/glow filter read as a soft, blurry halo-around-the-halo
            instead of a crisp edge, especially at this small a size.
            Drawn first, larger than the real halo below (+1 on both radii)
            with a wide stroke and no fill, so only its own outer sliver
            peeks out from behind the real halo's fill+gold stroke, reading
            as a thin black rim around the whole shape. var(--crown-outline)
            is transparent in dark mode (see index.css), where --node-fill
            (black there) already contrasts against --paper on its own — so
            this second ellipse renders nothing extra there. */}
        <ellipse cx="17" cy="12" rx="16" ry="7.5" fill="none" stroke="var(--crown-outline)" strokeWidth="2" />
        <ellipse cx="17" cy="12" rx="15" ry="6.5" fill="var(--node-fill)" stroke={HALO_GOLD} strokeWidth="2.5" />
      </svg>
    );
  }

  return (
    <svg
      width="22.4"
      height="13.6"
      viewBox="0 0 28 17"
      className="pointer-events-none absolute -top-[8.8px] left-1/2 z-[1] -translate-x-1/2"
      aria-hidden="true"
    >
      <g fill={HORNS_RED} stroke={HORNS_RED} strokeWidth="2" strokeLinejoin="round">
        <path d="M 6 14 C 2 9 3 3 8 0 C 5 6 6 11 10 14 Z" />
        <path d="M 22 14 C 26 9 25 3 20 0 C 23 6 22 11 18 14 Z" />
      </g>
    </svg>
  );
}
