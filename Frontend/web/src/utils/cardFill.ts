// Per-piece card colors for the puzzle-card reading mode: a viewer's own way
// of marking up the map (never shared with its other members), so — like
// nodeDisplay.ts — kept per browser and per map.
export type CardFills = Record<string, string>;

/** The swatches offered for a card's fill. Light enough for the dark text on top. */
export const CARD_FILL_COLORS = ["#fde68a", "#fecaca", "#bbf7d0", "#bfdbfe", "#ddd6fe", "#fbcfe8", "#fed7aa", "#e5e7eb"];

const storageKey = (mapId: string | undefined) => `mc_card_fill:${mapId ?? ""}`;

export function loadCardFills(mapId: string | undefined): CardFills {
  try {
    const raw = localStorage.getItem(storageKey(mapId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: CardFills = {};
    for (const [id, color] of Object.entries(parsed)) {
      if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) out[id] = color;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveCardFills(mapId: string | undefined, fills: CardFills): void {
  try {
    if (Object.keys(fills).length === 0) localStorage.removeItem(storageKey(mapId));
    else localStorage.setItem(storageKey(mapId), JSON.stringify(fills));
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}
