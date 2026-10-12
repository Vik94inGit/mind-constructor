// Whether the minimap is shown — a per-viewer choice from the view corner's
// menu, kept in this browser. Off until the viewer turns it on.
const KEY = "mc_minimap_shown";

export function loadMinimapShown(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    // storage blocked or unavailable — fall through to the default
  }
  return false;
}

export function saveMinimapShown(shown: boolean): void {
  try {
    localStorage.setItem(KEY, shown ? "1" : "0");
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}
