import type { NodeDoc } from "../types";
import { nodeRefId } from "./nodeType";

// The level of abstraction: how deep into the parentId tree the canvas shows.
// Level 1 is only the top ideas (nodes with no parent), level 2 adds their
// children, and so on; null shows everything. A viewer's own way of looking,
// kept per browser and per map like zoneDisplay.ts.
export type AbstractionLevel = number | null;

/** Each node's depth in the parentId tree — 0 for a node with no (known) parent. */
export function nodeDepths(nodes: NodeDoc[]): Map<string, number> {
  const parentOf = new Map<string, string | undefined>();
  for (const n of nodes) parentOf.set(n.nodeId, nodeRefId(n.parentId));
  const depths = new Map<string, number>();
  function depthOf(id: string, seen: Set<string>): number {
    const known = depths.get(id);
    if (known !== undefined) return known;
    const parent = parentOf.get(id);
    // A parent that isn't on the map, or a loop back to a node already on
    // this chain, ends the climb here.
    if (!parent || !parentOf.has(parent) || seen.has(parent)) {
      depths.set(id, 0);
      return 0;
    }
    seen.add(id);
    const d = depthOf(parent, seen) + 1;
    depths.set(id, d);
    return d;
  }
  for (const n of nodes) depthOf(n.nodeId, new Set());
  return depths;
}

/** How many levels the map has (1 for a flat map, 0 for an empty one). */
export function levelCount(depths: Map<string, number>): number {
  let max = -1;
  for (const d of depths.values()) max = Math.max(max, d);
  return max + 1;
}

/** Whether a node at this depth shows at this level. */
export function shownAtLevel(depth: number | undefined, level: AbstractionLevel): boolean {
  return level === null || depth === undefined || depth < level;
}

const storageKey = (mapId: string | undefined) => `mc_abstraction_level:${mapId ?? ""}`;

export function loadAbstractionLevel(mapId: string | undefined): AbstractionLevel {
  try {
    const raw = localStorage.getItem(storageKey(mapId));
    const v = raw === null ? NaN : Number(raw);
    return Number.isInteger(v) && v >= 1 ? v : null;
  } catch {
    return null;
  }
}

export function saveAbstractionLevel(mapId: string | undefined, level: AbstractionLevel): void {
  try {
    if (level === null) localStorage.removeItem(storageKey(mapId));
    else localStorage.setItem(storageKey(mapId), String(level));
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}
