// Cards unglued on demand: cards glued together drag as one (see
// usePuzzleConnect's puzzleClusterFor), but an unglued card stands on its
// own until it's glued to a card again. The viewer's own way of laying the map out — kept per
// map in this browser (and on the server, see useMapViewerPrefs), like the
// locks in blockLock.ts.
export type DetachedPieces = Record<string, true>;

const storageKey = (mapId: string | undefined) => `mc_detached:${mapId ?? ""}`;

export function loadDetachedPieces(mapId: string | undefined): DetachedPieces {
  try {
    const raw = localStorage.getItem(storageKey(mapId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return {};
    const out: DetachedPieces = {};
    for (const id of parsed) if (typeof id === "string") out[id] = true;
    return out;
  } catch {
    return {};
  }
}

export function saveDetachedPieces(mapId: string | undefined, pieces: DetachedPieces): void {
  try {
    const ids = Object.keys(pieces);
    if (ids.length === 0) localStorage.removeItem(storageKey(mapId));
    else localStorage.setItem(storageKey(mapId), JSON.stringify(ids));
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}
