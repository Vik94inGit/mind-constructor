// How the map is drawn for reading — a per-viewer preference (never shared
// with other members of the map), so it lives in localStorage rather than on
// the map itself.
//
//  - classic:  a classical mind map — no icons, each node is a text box showing
//              its whole text (and title), with far fewer limits on length.
//  - iconText: the usual icon, with its text always shown beside it.
//  - actual:   the app's own default — icons, with captions only where the
//              zone/selection rules say to show them.
export type ReadingMode = "classic" | "iconText" | "actual";

// Menu order: the most text-heavy first.
export const READING_MODES: ReadingMode[] = ["classic", "iconText", "actual"];

import { isMobileViewport } from "./canvasLayout";

const STORAGE_KEY = "mc_reading_mode";
const COMPACT_KEY = "mc_compact_view";

export function loadReadingMode(): ReadingMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "classic" || v === "iconText" || v === "actual") return v;
  } catch {
    // storage blocked or unavailable — fall through to the default
  }
  return "actual";
}

export function saveReadingMode(mode: ReadingMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}

// The simplified view: smaller icons, no halo/horns/wings and no circle rings,
// for less visual noise on a small screen. Also a per-viewer preference; until
// one is chosen it defaults to on for a phone-sized screen and off otherwise.
export function loadCompactView(): boolean {
  try {
    const v = localStorage.getItem(COMPACT_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    // storage blocked or unavailable — fall through to the default
  }
  return isMobileViewport();
}

export function saveCompactView(compact: boolean): void {
  try {
    localStorage.setItem(COMPACT_KEY, compact ? "1" : "0");
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}
