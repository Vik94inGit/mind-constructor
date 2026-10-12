import { isMobileViewport } from "./canvasLayout";

// Whether the minimap is shown — a per-viewer choice from the view corner's
// menu, kept in this browser. Until one is made it's on for a wider screen and
// off on a phone, where it's too small to steer by.
const KEY = "mc_minimap_shown";

export function loadMinimapShown(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    // storage blocked or unavailable — fall through to the default
  }
  return !isMobileViewport();
}

export function saveMinimapShown(shown: boolean): void {
  try {
    localStorage.setItem(KEY, shown ? "1" : "0");
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}
