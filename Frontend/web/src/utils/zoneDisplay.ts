import type { NodeGroup } from "./canvasLayout";
import type { ReadingMode } from "./readingMode";

// Per-zone views: each zone (circle — see canvasLayout's computeNodeGroups)
// can be read its own way, so one canvas shows several sides of the same map
// at once — say the problem zone as puzzle cards with every word, the options
// as plain icons, and a zone that's done with as dots. On top of the reading
// modes a zone can be shrunk to dots. A viewer's own way of looking, kept per
// browser and per map like nodeDisplay.ts.
export type ZoneMode = ReadingMode | "dots";
export type ZoneDisplay = Record<string, ZoneMode>;

/** Menu order: the most text-heavy first, dots last. */
export const ZONE_MODES: ZoneMode[] = ["puzzle", "mixed", "iconText", "actual", "dots"];

const isZoneMode = (v: unknown): v is ZoneMode =>
  v === "puzzle" || v === "mixed" || v === "iconText" || v === "actual" || v === "dots";

const storageKey = (mapId: string | undefined) => `mc_zone_display:${mapId ?? ""}`;

export function loadZoneDisplay(mapId: string | undefined): ZoneDisplay {
  try {
    const raw = localStorage.getItem(storageKey(mapId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: ZoneDisplay = {};
    for (const [rootId, mode] of Object.entries(parsed)) if (isZoneMode(mode)) out[rootId] = mode;
    return out;
  } catch {
    return {};
  }
}

export function saveZoneDisplay(mapId: string | undefined, display: ZoneDisplay): void {
  try {
    if (Object.keys(display).length === 0) localStorage.removeItem(storageKey(mapId));
    else localStorage.setItem(storageKey(mapId), JSON.stringify(display));
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}

// Each node's zone view, for the nodes in a zone that has one. A node can sit
// in two zones — the root of its own and a member of its parent's — and then
// the zone it roots wins, since that's the one it heads and names.
export function zoneModeByNode(groups: NodeGroup[], display: ZoneDisplay): Map<string, ZoneMode> {
  const out = new Map<string, ZoneMode>();
  if (Object.keys(display).length === 0) return out;
  for (const g of groups) {
    const mode = display[g.rootId];
    if (mode) out.set(g.rootId, mode);
  }
  for (const g of groups) {
    const mode = display[g.rootId];
    if (!mode) continue;
    for (const m of g.members) if (!out.has(m.nodeId)) out.set(m.nodeId, mode);
  }
  return out;
}
