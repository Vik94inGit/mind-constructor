// Locked text blocks: a puzzle card its owner has locked can't be dragged,
// clicked into another piece, or have its text edited until it's unlocked —
// a guard against moving or retyping a finished piece by accident. Kept per
// browser and per map, like the card fills (utils/cardFill.ts).
export type BlockLocks = Record<string, true>;

const storageKey = (mapId: string | undefined) => `mc_block_lock:${mapId ?? ""}`;

export function loadBlockLocks(mapId: string | undefined): BlockLocks {
  try {
    const raw = localStorage.getItem(storageKey(mapId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return {};
    const out: BlockLocks = {};
    for (const id of parsed) if (typeof id === "string") out[id] = true;
    return out;
  } catch {
    return {};
  }
}

export function saveBlockLocks(mapId: string | undefined, locks: BlockLocks): void {
  try {
    const ids = Object.keys(locks);
    if (ids.length === 0) localStorage.removeItem(storageKey(mapId));
    else localStorage.setItem(storageKey(mapId), JSON.stringify(ids));
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}
