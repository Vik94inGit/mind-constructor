import type { ReadingMode } from "./readingMode";

// The three ways to look at a map, offered once it has built itself up
// (MapPage's view prompt) and in the view corner: the whole map, an overview
// where each parent packs its details in (utils/autoPack.ts), or the cards
// laid close together with no links drawn (utils/cardPack.ts).
export type MapView = "map" | "overview" | "cards";

export const MAP_VIEWS: MapView[] = ["map", "overview", "cards"];

/** A map smaller than this is read at a glance anyway: no prompt. */
export const VIEW_PROMPT_MIN_NODES = 6;

const NEVER_KEY = "mc_view_prompt_off";

/** Which of the views the canvas shows now. */
export function currentView(readingMode: ReadingMode, overviewOn: boolean): MapView {
  if (readingMode === "puzzle") return "cards";
  return overviewOn ? "overview" : "map";
}

/** Whether the viewer still wants to be asked (per browser). */
export function shouldAskView(): boolean {
  try {
    return localStorage.getItem(NEVER_KEY) !== "1";
  } catch {
    return true;
  }
}

export function stopAskingView(): void {
  try {
    localStorage.setItem(NEVER_KEY, "1");
  } catch {
    // best-effort — the prompt just comes back next time
  }
}
