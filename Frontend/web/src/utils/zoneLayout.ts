// How zones are drawn: for the whole map, and for any one parent's branch.
//   zones  — every parent with 2+ children has its own zone; a child that is a
//            parent itself heads a zone of its own beside it (the default).
//   nested — the parent's zone wraps its whole branch, and the sub-parents'
//            zones sit inside it as sub-zones.
//   none   — no zone at all.
// A parent follows its own choice, else the nearest ancestor's, else the
// map's. A viewer's own way of looking, kept per browser and per map like
// zoneDisplay.ts (and on the server, see useMapViewerPrefs).
export type ZoneLayout = "zones" | "nested" | "none";
/** Each parent's own choice by nodeId, and the whole map's under MAP_ZONE_KEY. */
export type ZoneLayouts = Record<string, ZoneLayout>;

export const ZONE_LAYOUTS: ZoneLayout[] = ["zones", "nested", "none"];
/** The whole map's choice in a ZoneLayouts record. */
export const MAP_ZONE_KEY = "*";

const isZoneLayout = (v: unknown): v is ZoneLayout => v === "zones" || v === "nested" || v === "none";

/** Only the known values, everything else dropped. */
export function parseZoneLayouts(data: unknown): ZoneLayouts {
  const out: ZoneLayouts = {};
  if (!data || typeof data !== "object") return out;
  for (const [id, layout] of Object.entries(data as Record<string, unknown>)) if (isZoneLayout(layout)) out[id] = layout;
  return out;
}

const storageKey = (mapId: string | undefined) => `mc_zone_layout:${mapId ?? ""}`;

export function loadZoneLayouts(mapId: string | undefined): ZoneLayouts {
  try {
    const raw = localStorage.getItem(storageKey(mapId));
    return raw ? parseZoneLayouts(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function saveZoneLayouts(mapId: string | undefined, layouts: ZoneLayouts): void {
  try {
    if (Object.keys(layouts).length === 0) localStorage.removeItem(storageKey(mapId));
    else localStorage.setItem(storageKey(mapId), JSON.stringify(layouts));
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}

/** `layouts` with `id`'s choice set, or removed when null (back to following its ancestors / the map). */
export function withZoneLayout(layouts: ZoneLayouts, id: string, layout: ZoneLayout | null): ZoneLayouts {
  const next = { ...layouts };
  if (layout) next[id] = layout;
  else delete next[id];
  return next;
}

/**
 * The layout each zone root follows: its own, else its nearest ancestor's
 * (walking `parentOf`), else the map's, else "zones".
 */
export function zoneLayoutResolver(
  layouts: ZoneLayouts,
  parentOf: (id: string) => string | null | undefined,
): (rootId: string) => ZoneLayout {
  const fallback = layouts[MAP_ZONE_KEY] ?? "zones";
  const own = Object.keys(layouts).some((k) => k !== MAP_ZONE_KEY);
  return (rootId) => {
    if (!own) return fallback;
    const seen = new Set<string>();
    let id: string | null | undefined = rootId;
    while (id && !seen.has(id)) {
      const layout = layouts[id];
      if (layout) return layout;
      seen.add(id);
      id = parentOf(id);
    }
    return fallback;
  };
}

/** The menu name of a layout, from the display strings (i18n's t.ui.display). */
export function zoneLayoutLabel(
  strings: { zoneLayoutZones: string; zoneLayoutNested: string; zoneLayoutNone: string },
  layout: ZoneLayout,
): string {
  if (layout === "nested") return strings.zoneLayoutNested;
  if (layout === "none") return strings.zoneLayoutNone;
  return strings.zoneLayoutZones;
}
