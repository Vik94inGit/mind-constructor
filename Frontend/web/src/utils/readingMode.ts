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

const STORAGE_KEY = "mc_reading_mode";

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
