import { ringKindFor } from "./OutcomeBadge";
import type { NodeType } from "../types";

// The halo/horns crown always draws in one of these two, regardless of
// the specific type's own border color (which stays per-type — blue for
// Option, teal for Solution, amber for Problematic option, and so on) —
// a halo reads as "halo" by being gold and horns read as "horns" by being
// red, the same fixed identity real halo/horns iconography has, not by
// matching whatever color the node under it happens to be.
const HALO_GOLD = "#c9a94a";
const HORNS_RED = "#b23a48";

// A small decoration sitting just above a node's own 60px icon circle —
// shared by NodeCard (a real node's own icon) and QuickAddGhosts (the
// type-preview ghosts fanned around a selected node), so a ghost actually
// previews what the real node is about to look like instead of just its
// bare symbol. Assumes a 60px circle directly below it (both callers use
// that size) — independent of OutcomeBadge rather than living inside its
// SVG, since OutcomeBadge's own canvas would have to be exactly that 60px
// circle's size for the two to align at all, and every attempt to cram
// the ring, wings, and health all into one shared canvas left something
// misaligned or clipped somewhere. Halo stays hollow (fill var(--surface),
// the real theme-aware background whatever circle sits under it paints
// with) — horns fill solid (HORNS_RED) instead; a devil's horns read as a
// solid dark shape, not an outline. Returns null for a type with no
// halo/horns framing ("unknown", or a type ringKindFor doesn't classify).
export function NodeCrown({ type }: { type: NodeType }) {
  const kind = ringKindFor(type);
  if (!kind) return null;

  if (kind === "halo") {
    return (
      <svg
        width="34"
        height="20"
        viewBox="0 0 34 20"
        className="pointer-events-none absolute -top-[13px] left-1/2 z-[1] -translate-x-1/2"
        aria-hidden="true"
      >
        <ellipse cx="17" cy="12" rx="15" ry="6.5" fill="var(--surface)" stroke={HALO_GOLD} strokeWidth="2.5" />
      </svg>
    );
  }

  return (
    <svg
      width="28"
      height="17"
      viewBox="0 0 28 17"
      className="pointer-events-none absolute -top-[11px] left-1/2 z-[1] -translate-x-1/2"
      aria-hidden="true"
    >
      <g fill={HORNS_RED} stroke={HORNS_RED} strokeWidth="2" strokeLinejoin="round">
        <path d="M 6 14 C 2 9 3 3 8 0 C 5 6 6 11 10 14 Z" />
        <path d="M 22 14 C 26 9 25 3 20 0 C 23 6 22 11 18 14 Z" />
      </g>
    </svg>
  );
}
