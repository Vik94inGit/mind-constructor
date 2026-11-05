// The cards view only works while its cards fit the screen at a size that can
// still be read. When they don't, the branches pack into their parents (auto-
// pack, utils/autoPack.ts) and the viewer is told; when even the top cards
// alone don't fit, the ones past what fits can go to another map. Pure
// geometry over sizes the caller measures — see hooks/useCardFit.ts.

import { BLOCK_ASPECT, boundsOf, PACK_GAP, packCards } from "./cardPack";
import type { PackItem } from "./cardPack";
import { branchParentIds, foldAway } from "./autoPack";
import type { FoldedParents } from "./autoPack";
import { nodeRefId } from "./nodeType";
import { readingOrder } from "./nodeOrder";
import type { NodeDoc } from "../types";

/** The smallest zoom a card's text still reads at. */
export const MIN_READABLE_ZOOM = 0.6;

export interface Screen {
  w: number;
  h: number;
}

/** Whether these cards, packed close in a square block as the cards view lays them, fit on it at `minZoom`. */
export function cardsFitScreen(items: PackItem[], screen: Screen, minZoom = MIN_READABLE_ZOOM): boolean {
  if (items.length === 0) return true;
  if (screen.w <= 0 || screen.h <= 0) return true;
  const at = packCards(items, { x: 0, y: 0 }, PACK_GAP, BLOCK_ASPECT);
  const box = boundsOf(items, at)!;
  return (box.maxX - box.minX) * minZoom <= screen.w && (box.maxY - box.minY) * minZoom <= screen.h;
}

/** How many of `items`, in order, fit the screen (at least one). */
export function howManyFit(items: PackItem[], screen: Screen, minZoom = MIN_READABLE_ZOOM): number {
  let lo = 1;
  let hi = items.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (cardsFitScreen(items.slice(0, mid), screen, minZoom)) lo = mid;
    else hi = mid - 1;
  }
  return Math.min(lo, items.length);
}

export type CardFitPlan =
  /** Everything fits as it is. */
  | { kind: "fits" }
  /** Packing every branch makes it fit: `folded` packs them all. */
  | { kind: "packed"; folded: FoldedParents }
  /** Even the top cards alone don't fit: `extraRootIds` are the ones past what fits, in order. */
  | { kind: "tooMany"; folded: FoldedParents; extraRootIds: string[] };

/**
 * What the cards view should do with `nodes` (in reading order) on `screen`,
 * given the branches packed now (`folded`) and each card's size (`sizeOf`).
 */
export function planCardFit(
  nodes: NodeDoc[],
  folded: FoldedParents,
  sizeOf: (n: NodeDoc) => { w: number; h: number },
  screen: Screen,
  minZoom = MIN_READABLE_ZOOM,
): CardFitPlan {
  const item = (n: NodeDoc): PackItem => ({ id: n.nodeId, ...sizeOf(n) });
  const shown = (f: FoldedParents) => {
    const { hidden } = foldAway(nodes, f);
    return nodes.filter((n) => !hidden.has(n.nodeId));
  };
  if (cardsFitScreen(shown(folded).map(item), screen, minZoom)) return { kind: "fits" };
  const all = branchParentIds(nodes);
  const tops = shown(all);
  if (cardsFitScreen(tops.map(item), screen, minZoom)) return { kind: "packed", folded: all };
  const roots = tops.filter((n) => !nodeRefId(n.parentId));
  const keep = howManyFit(roots.map(item), screen, minZoom);
  return { kind: "tooMany", folded: all, extraRootIds: roots.slice(keep).map((n) => n.nodeId) };
}

/**
 * Opening one packed branch in the cards view: it and the branches it hangs
 * from open, every other branch packs, so the board stays as small as it can.
 */
export function openOnly(nodes: NodeDoc[], parentId: string): FoldedParents {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const open = new Set<string>();
  for (let id: string | null = parentId; id && !open.has(id); id = nodeRefId(byId.get(id)?.parentId) ?? null) open.add(id);
  const next: FoldedParents = new Set();
  for (const id of branchParentIds(nodes)) if (!open.has(id)) next.add(id);
  return next;
}

/**
 * The zones, in the order to read them when the cards view shows one at a
 * time: every parent, as the outline reads them (each top idea, then its
 * branch, depth first).
 */
export function zoneSteps(nodes: NodeDoc[]): string[] {
  const parents = branchParentIds(nodes);
  return readingOrder(nodes)
    .filter((n) => parents.has(n.nodeId))
    .map((n) => n.nodeId);
}

/** One zone on its own: its parent and the nodes hanging straight from it. */
export function zoneMembers(nodes: NodeDoc[], parentId: string): Set<string> {
  const out = new Set([parentId]);
  for (const n of nodes) if (nodeRefId(n.parentId) === parentId) out.add(n.nodeId);
  return out;
}

/**
 * Each node's place in the outline, numbered so the logic can be followed:
 * top ideas 1, 2, 3…, the first one's branch 1.1, 1.2, theirs 1.1.1…
 */
export function outlineNumbers(nodes: NodeDoc[]): Map<string, string> {
  const ids = new Set(nodes.map((n) => n.nodeId));
  const out = new Map<string, string>();
  const count = new Map<string, number>();
  for (const n of readingOrder(nodes)) {
    const parent = nodeRefId(n.parentId);
    const key = parent && ids.has(parent) && out.has(parent) ? parent : "";
    const i = (count.get(key) ?? 0) + 1;
    count.set(key, i);
    out.set(n.nodeId, key ? `${out.get(key)}.${i}` : `${i}`);
  }
  return out;
}
