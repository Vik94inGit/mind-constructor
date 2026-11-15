import type { MapDoc, NodeDoc } from "../types";

// A map's areas (Map.areaCount, Node.area): once the canvas fills up, the
// owner can extend the map by up to four more areas, each a whole canvas of
// its own. The map shows one area at a time; the minimap's strip of
// mini-views switches between them (map/AreaStrip.tsx). Sketch:
// docs/gestures/map-areas.md.

/** The main area and up to four more — same as the backend's MAX_MAP_AREAS. */
export const MAX_MAP_AREAS = 5;

/** The area a node lives on: 0, the main one, unless it says otherwise. */
export function areaOf(node: Pick<NodeDoc, "area">): number {
  return node.area ?? 0;
}

/** How many areas a map has, 1..MAX_MAP_AREAS. */
export function areaCountOf(map: Pick<MapDoc, "areaCount"> | null | undefined): number {
  const n = map?.areaCount ?? 1;
  return Math.min(MAX_MAP_AREAS, Math.max(1, Math.floor(n)));
}

/** The nodes on one area. */
export function nodesOnArea<T extends Pick<NodeDoc, "area">>(nodes: T[], area: number): T[] {
  return nodes.filter((n) => areaOf(n) === area);
}

/** How many nodes sit on each area, index = area. */
export function nodesPerArea(nodes: Pick<NodeDoc, "area">[], count: number): number[] {
  const per = Array.from({ length: count }, () => 0);
  for (const n of nodes) {
    const a = areaOf(n);
    if (a < count) per[a]++;
  }
  return per;
}

export type MiniView = "all" | number;

/**
 * The mini-views over the minimap: nothing while the map has one area, else
 * "All" and one per area — six at most.
 */
export function miniViews(count: number): MiniView[] {
  if (count <= 1) return [];
  return ["all", ...Array.from({ length: Math.min(count, MAX_MAP_AREAS) }, (_, i) => i)];
}

/** Whether another area can be added. */
export function canExtend(count: number): boolean {
  return count < MAX_MAP_AREAS;
}

/**
 * Whether the last area can be given back: only an extra one, and only empty
 * (the backend refuses otherwise).
 */
export function canRemoveLastArea(nodes: Pick<NodeDoc, "area">[], count: number): boolean {
  return count > 1 && !nodes.some((n) => areaOf(n) >= count - 1);
}

/** The area to show after a reload or a switch: kept inside what the map has. */
export function clampArea(area: number, count: number): number {
  return Math.min(Math.max(0, Math.floor(area)), count - 1);
}

// The area each open map is showing, so a node made without saying where
// (every createNode in the app) lands on the area the person is looking at.
// MapPage sets it when it switches area and clears it when it closes.
const shownArea = new Map<string, number>();

export function setShownArea(mapId: string, area: number | null): void {
  if (area === null) shownArea.delete(mapId);
  else shownArea.set(mapId, area);
}

/** The area a new node on `mapId` goes to when the caller doesn't say: the one on screen, else the main one. */
export function shownAreaOf(mapId: string): number {
  return shownArea.get(mapId) ?? 0;
}
