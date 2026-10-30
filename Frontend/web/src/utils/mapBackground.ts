import type { CSSProperties } from "react";
import type { MapBackground, ZonePaletteColor } from "../types";
import { softTint } from "./zoneStyle";
import { imageSrc } from "./images";

/**
 * The canvas behind a map's nodes (Map.background), as styles for the canvas
 * element. null — every map that never picked one — is the dot grid it has
 * always had. "dark" also gets the `canvas-soft-dark` class (index.css), which
 * switches everything drawn on the canvas to dark colours, so cards, lines and
 * zone labels stay readable on it in the light theme too.
 */
export function mapBackgroundStyle(
  background: MapBackground | null | undefined,
  color?: ZonePaletteColor | null,
  image?: string | null,
): { className: string; style: CSSProperties } {
  const base = backgroundPattern(background);
  // A picked colour (Map.backgroundColor) tints the paper softly, under the same pattern.
  const paper = color ? softTint(color) : "var(--paper)";
  if (!image) return color ? { ...base, style: { ...base.style, backgroundColor: paper } } : base;
  // The owner's own picture (Map.backgroundImage) fills the map, under a veil
  // of the (tinted) paper so it stays muted and the nodes stay readable; the
  // pattern still lies on top.
  const veil = `color-mix(in srgb, ${paper} ${IMAGE_VEIL}%, transparent)`;
  const layers = [base.style.backgroundImage, `linear-gradient(${veil}, ${veil})`, `url("${imageSrc(image)}")`].filter(Boolean);
  const sizes = [base.style.backgroundImage ? (base.style.backgroundSize ?? "auto") : null, "auto", "cover"].filter(Boolean);
  return {
    className: base.className,
    style: {
      backgroundColor: paper,
      backgroundImage: layers.join(", "),
      backgroundSize: sizes.join(", "),
      backgroundPosition: "center",
      backgroundRepeat: base.style.backgroundImage ? "repeat, no-repeat, no-repeat" : "no-repeat",
    },
  };
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
