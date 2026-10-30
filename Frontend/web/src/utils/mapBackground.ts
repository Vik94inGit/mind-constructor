import type { CSSProperties } from "react";
import type { MapBackground, ZonePaletteColor } from "../types";
import { softTint } from "./zoneStyle";
import { imageSrc } from "./images";

/**
 * The canvas behind a map's nodes (Map.background), as styles for the canvas
 * element. null — every map that never picked one — is the dot grid it has
 * always had. "dark" also gets the `canvas-soft-dark` class (index.css), which
 * switches everything drawn on the canvas to dark colours, so cards, lines and
 * zone labels stay readable on it in the light theme too. A picture
 * (Map.backgroundImage) adds `canvas-on-picture` (index.css): brighter type
 * colours in the dark theme, full-strength icon rims and a halo of the paper
 * round icons and labels, so they stand out from a busy picture.
 */
export function mapBackgroundStyle(
  background: MapBackground | null | undefined,
  color?: ZonePaletteColor | null,
  image?: string | null,
  shade?: number | null,
): { className: string; style: CSSProperties } {
  const base = backgroundPattern(background);
  // A picked colour (Map.backgroundColor) tints the paper softly, under the same pattern.
  const paper = color ? softTint(color) : "var(--paper)";
  if (!image) return color ? { ...base, style: { ...base.style, backgroundColor: paper } } : base;
  // The owner's own picture (Map.backgroundImage) fills the map, under a veil
  // of the (tinted) paper so it stays muted and the nodes stay readable; the
  // pattern still lies on top.
  const veil = `color-mix(in srgb, ${paper} ${IMAGE_VEIL}%, transparent)`;
  // Map.backgroundShade: black (darker) or white (lighter) over picture and veil.
  const tone = shadeLayer(shade);
  const layers = [base.style.backgroundImage, tone, `linear-gradient(${veil}, ${veil})`, `url("${imageSrc(image)}")`].filter(Boolean);
  const sizes = [base.style.backgroundImage ? (base.style.backgroundSize ?? "auto") : null, tone ? "auto" : null, "auto", "cover"].filter(Boolean);
  return {
    className: `${base.className} ${ON_PICTURE_CLASS}`.trim(),
    style: {
      backgroundColor: paper,
      backgroundImage: layers.join(", "),
      backgroundSize: sizes.join(", "),
      backgroundPosition: "center",
      // The pattern repeats; the shade, veil and picture each cover the map once.
      backgroundRepeat: base.style.backgroundImage ? ["repeat", ...layers.slice(1).map(() => "no-repeat")].join(", ") : "no-repeat",
    },
  };
}

/** The class a canvas with a picture under it gets, for its higher-contrast icons (index.css). */
export const ON_PICTURE_CLASS = "canvas-on-picture";

/** At the far end of the shade slider, this much black or white lies over the picture, in percent. */
export const MAX_SHADE = 80;

/**
 * Map.backgroundShade (-100..100) as a flat layer: black for darker, white for
 * lighter, up to MAX_SHADE percent. null for 0 — the picture as it is.
 */
export function shadeLayer(shade: number | null | undefined): string | null {
  const s = Math.max(-100, Math.min(100, Math.round(shade ?? 0)));
  if (!s) return null;
  const tone = `color-mix(in srgb, ${s < 0 ? "#000" : "#fff"} ${Math.round((Math.abs(s) * MAX_SHADE) / 100)}%, transparent)`;
  return `linear-gradient(${tone}, ${tone})`;
}

/** How much of the paper lies over a background picture, in percent: enough to keep it soft. */
export const IMAGE_VEIL = 60;

function backgroundPattern(background: MapBackground | null | undefined): { className: string; style: CSSProperties } {
  switch (background ?? "dots") {
    case "plain":
      return { className: "", style: { backgroundColor: "var(--paper)" } };
    case "lined":
      return {
        className: "",
        style: {
          backgroundColor: "var(--paper)",
          backgroundImage: "linear-gradient(to bottom, transparent 31px, var(--line) 31px)",
          backgroundSize: "100% 32px",
        },
      };
    case "dark":
      return {
        className: "canvas-soft-dark",
        style: {
          backgroundColor: "var(--paper)",
          backgroundImage: "radial-gradient(circle, color-mix(in srgb, var(--ink) 12%, transparent) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        },
      };
    default:
      return {
        className: "",
        style: {
          backgroundColor: "var(--paper)",
          backgroundImage: "radial-gradient(circle, var(--line) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        },
      };
  }
}
