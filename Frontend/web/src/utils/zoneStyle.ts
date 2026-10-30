import type { NodeDoc, ZonePaletteColor, ZonePattern } from "../types";
import { ZONE_COLORS } from "./nodeType";
import type { Sentiment } from "./nodeType";

// The calm palette a zone's colour can be picked from (Node.zoneColor) —
// muted mid tones, readable at the zones' low fill opacity in both themes.
export const ZONE_PALETTE_HEX: Record<ZonePaletteColor, string> = {
  sand: "#c9a35b",
  sage: "#6f9e74",
  sky: "#5d8fcf",
  lavender: "#9682c8",
  rose: "#c97c8e",
  slate: "#7b8794",
};

/**
 * A palette colour as a muted background: mixed into the paper colour, so a
 * picked colour tints the map or a picture without drowning what's on it.
 * Works in both themes, since --paper is the theme's own paper.
 */
export function softTint(color: ZonePaletteColor, amount = 14): string {
  return `color-mix(in srgb, ${ZONE_PALETTE_HEX[color]} ${amount}%, var(--paper))`;
}

/** A zone's colour: its parent's palette pick, else the majority-sentiment colour. */
export function zoneColorFor(root: NodeDoc | undefined, sentiment: Sentiment): string {
  return root?.zoneColor ? ZONE_PALETTE_HEX[root.zoneColor] : ZONE_COLORS[sentiment];
}

/** How bright a zone's outline is when its parent never picked one (Node.zoneEdge). */
export const ZONE_EDGE_DEFAULT = 0.25;

/** Size of one pattern tile, in canvas units. */
export const ZONE_PATTERN_TILE: Record<ZonePattern, number> = { dots: 18, stripes: 14, grid: 22, chess: 28 };
