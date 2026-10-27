// How a thought feels to the person looking at it, and how they felt about a
// whole map before and after thinking it through. A viewer's own, never
// shared with the map's other members: kept per browser and per map like
// cardFill.ts, and on the server in their view of the map (api/state.ts,
// Backend's MapViewState.feelings / checkIn). A feeling is only a badge and a
// tint; it never moves a node.

// Heavy ones first, then the lighter ones, so the picker reads as a scale.
export const FEELINGS = [
  "worried",
  "anxious",
  "scared",
  "sad",
  "angry",
  "frustrated",
  "confused",
  "tired",
  "curious",
  "hopeful",
  "excited",
  "happy",
  "proud",
  "grateful",
  "calm",
  "relieved",
] as const;
export type Feeling = (typeof FEELINGS)[number];

export const FEELING_EMOJI: Record<Feeling, string> = {
  worried: "😟",
  anxious: "😰",
  scared: "😨",
  sad: "😢",
  angry: "😠",
  frustrated: "😤",
  confused: "😕",
  tired: "😩",
  curious: "🤔",
  hopeful: "🙂",
  excited: "🤩",
  happy: "😄",
  proud: "😎",
  grateful: "🥰",
  calm: "😌",
  relieved: "😮‍💨",
};

/** A soft color per feeling, for the badge's tint. */
export const FEELING_COLOR: Record<Feeling, string> = {
  worried: "#f59e0b",
  anxious: "#fb923c",
  scared: "#818cf8",
  sad: "#60a5fa",
  angry: "#ef4444",
  frustrated: "#f97316",
  confused: "#a78bfa",
  tired: "#94a3b8",
  curious: "#22d3ee",
  hopeful: "#34d399",
  excited: "#f472b6",
  happy: "#facc15",
  proud: "#c084fc",
  grateful: "#fb7185",
  calm: "#2dd4bf",
  relieved: "#84cc16",
};

/** nodeId -> feeling. */
export type Feelings = Record<string, Feeling>;

export function isFeeling(value: unknown): value is Feeling {
  return typeof value === "string" && (FEELINGS as readonly string[]).includes(value);
}

/** Only the entries that are real feelings — anything else read back is dropped. */
export function parseFeelings(raw: unknown): Feelings {
  const out: Feelings = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, f] of Object.entries(raw as Record<string, unknown>)) if (isFeeling(f)) out[id] = f;
  return out;
}

/** Sets (or, with null, clears) one node's feeling. */
export function withFeeling(feelings: Feelings, nodeId: string, feeling: Feeling | null): Feelings {
  const next = { ...feelings };
  if (feeling) next[nodeId] = feeling;
  else delete next[nodeId];
  return next;
}

const storageKey = (mapId: string | undefined) => `mc_feelings:${mapId ?? ""}`;

export function loadFeelings(mapId: string | undefined): Feelings {
  try {
    const raw = localStorage.getItem(storageKey(mapId));
    return raw ? parseFeelings(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function saveFeelings(mapId: string | undefined, feelings: Feelings): void {
  try {
    if (Object.keys(feelings).length === 0) localStorage.removeItem(storageKey(mapId));
    else localStorage.setItem(storageKey(mapId), JSON.stringify(feelings));
  } catch {
    // best-effort — the feelings just won't survive a reload on this device
  }
}

// ---- Before and after check-in ----

export const STRENGTH_MIN = 1;
export const STRENGTH_MAX = 5;
export const STRENGTH_DEFAULT = 3;

export interface CheckInEntry {
  feeling: Feeling;
  /** How strong, 1 (a little) to 5 (very). */
  strength: number;
  /** When (ms). */
  at: number;
}

export interface CheckIn {
  before?: CheckInEntry | null;
  after?: CheckInEntry | null;
}

/** mapId -> that map's check-in (GET /api/state/check-ins). */
export type CheckIns = Record<string, CheckIn>;

function parseEntry(raw: unknown): CheckInEntry | null {
  const e = raw as Partial<CheckInEntry> | null;
  if (!e || !isFeeling(e.feeling) || typeof e.strength !== "number" || typeof e.at !== "number") return null;
  return { feeling: e.feeling, strength: clampStrength(e.strength), at: e.at };
}

export function parseCheckIn(raw: unknown): CheckIn | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const before = parseEntry(r.before);
  const after = parseEntry(r.after);
  return before || after ? { before, after } : null;
}

export function clampStrength(n: number): number {
  return Math.min(STRENGTH_MAX, Math.max(STRENGTH_MIN, Math.round(n)));
}

export function checkInEntry(feeling: Feeling, strength: number, at = Date.now()): CheckInEntry {
  return { feeling, strength: clampStrength(strength), at };
}

/** A map opened this long after its "before" asks "And now?" — not straight after building it. */
export const ASK_AFTER_MS = 10 * 60 * 1000;

/** The canvas asks "And now?": there's a before, no after yet, it was a while ago, and the viewer didn't wave it off here. */
export function shouldAskAfter(checkIn: CheckIn | null | undefined, now: number, skipped: boolean): boolean {
  const before = checkIn?.before;
  if (!before || checkIn?.after || skipped) return false;
  return now - before.at >= ASK_AFTER_MS;
}

/** "😟 4 → 😌 2", or "😟 4 → ?" while the after is still to come; null with no before. */
export function checkInShift(checkIn: CheckIn | null | undefined): string | null {
  const before = checkIn?.before;
  if (!before) return null;
  const after = checkIn?.after;
  const b = `${FEELING_EMOJI[before.feeling]} ${before.strength}`;
  return `${b} → ${after ? `${FEELING_EMOJI[after.feeling]} ${after.strength}` : "?"}`;
}

const skipKey = (mapId: string) => `mc_check_in_skipped:${mapId}`;

/** The viewer waved off "And now?" on this map — the canvas stops asking (the dashboard still offers it). */
export function loadAfterSkipped(mapId: string | undefined): boolean {
  if (!mapId) return false;
  try {
    return localStorage.getItem(skipKey(mapId)) === "1";
  } catch {
    return false;
  }
}

export function saveAfterSkipped(mapId: string, skipped: boolean): void {
  try {
    if (skipped) localStorage.setItem(skipKey(mapId), "1");
    else localStorage.removeItem(skipKey(mapId));
  } catch {
    // ignore
  }
}
