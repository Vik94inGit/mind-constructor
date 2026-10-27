import type { ReadingMode } from "./readingMode";

// The three ways to look at a map, offered in the view corner and asked once
// a map has built itself up (MapPage's view prompt): the whole map, an
// overview where each parent packs its details in (utils/autoPack.ts), or the
// cards laid close together with no links drawn (utils/cardPack.ts). The
// viewer's choice is kept (per browser) and every map opens in it.
export type MapView = "map" | "overview" | "cards";

export const MAP_VIEWS: MapView[] = ["map", "overview", "cards"];

/** A map smaller than this is read at a glance anyway: no prompt. */
export const VIEW_PROMPT_MIN_NODES = 6;

const VIEW_KEY = "mc_map_view";

/** Which of the views the canvas shows now. */
export function currentView(readingMode: ReadingMode, overviewOn: boolean): MapView {
  if (readingMode === "puzzle") return "cards";
  return overviewOn ? "overview" : "map";
}

/** The view the viewer chose, or null while they haven't been asked yet. */
export function loadRememberedView(): MapView | null {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === "map" || v === "overview" || v === "cards" ? v : null;
  } catch {
    return null;
  }
}

export function rememberView(view: MapView): void {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // best-effort — the prompt just comes back next time
  }
}
