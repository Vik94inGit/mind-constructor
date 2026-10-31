import type { CSSProperties } from "react";

/**
 * How strongly quiet nodes fade (a child no one is looking at, a ghost not
 * yet written in, the rest of the map behind a chosen node), as the viewer
 * set it in the display menu: 0 (no fading) to 100 (the full fade). null —
 * never set — is the app's own choice: the full fade on plain paper, a
 * lighter one over a background picture (index.css's canvas-on-picture),
 * where faded nodes get lost in it.
 */
export type NodeFade = number | null;

const STORAGE_KEY = "mc_node_fade";

export function clampNodeFade(value: unknown): NodeFade {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function loadNodeFade(): NodeFade {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : clampNodeFade(Number(raw));
  } catch {
    return null;
  }
}

export function saveNodeFade(fade: NodeFade): void {
  try {
    if (fade === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(fade));
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}

/** The canvas's --node-fade (0..1), which NodeCard's node-fade-* classes scale their fade by; none while unset. */
export function nodeFadeStyle(fade: NodeFade): CSSProperties {
  return fade === null ? {} : ({ "--node-fade": fade / 100 } as CSSProperties);
}

/** Where the slider stands while the viewer never moved it: the fade the canvas uses by itself. */
export function autoNodeFade(onPicture: boolean): number {
  return onPicture ? PICTURE_NODE_FADE : 100;
}

/** The fade over a background picture until the viewer picks their own, in percent (index.css's --node-fade-auto). */
export const PICTURE_NODE_FADE = 30;
