import type { CSSProperties } from "react";
import type { MapBackground, ZonePaletteColor } from "../types";
import { softTint } from "./zoneStyle";

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
): { className: string; style: CSSProperties } {
  const base = backgroundPattern(background);
  // A picked colour (Map.backgroundColor) tints the paper softly, under the same pattern.
  return color ? { ...base, style: { ...base.style, backgroundColor: softTint(color) } } : base;
}

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
