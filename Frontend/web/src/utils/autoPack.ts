import type { NodeDoc } from "../types";
import { nodeRefId } from "./nodeType";

// Auto-pack: a parent tucks its whole branch in, so the map can be read at a
// glance without its details. Only a way of looking (nothing is changed on
// the map, unlike packing a node into a container — packAbl.ts), so it's kept
// per browser and per map, like nodeDisplay.ts. The parent shows how many
// nodes it holds and opens again from there or from its panel.
export type FoldedParents = Set<string>;

const storageKey = (mapId: string | undefined) => `mc_auto_pack:${mapId ?? ""}`;

export function loadFolded(mapId: string | undefined): FoldedParents {
  try {
    const raw = localStorage.getItem(storageKey(mapId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveFolded(mapId: string | undefined, folded: FoldedParents): void {
  try {
    if (folded.size === 0) localStorage.removeItem(storageKey(mapId));
    else localStorage.setItem(storageKey(mapId), JSON.stringify([...folded]));
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}

function childrenByParent(nodes: NodeDoc[]): Map<string, string[]> {
  const ids = new Set(nodes.map((n) => n.nodeId));
  const out = new Map<string, string[]>();
  for (const n of nodes) {
    const parent = nodeRefId(n.parentId);
    if (!parent || parent === n.nodeId || !ids.has(parent)) continue;
    const list = out.get(parent) ?? [];
    list.push(n.nodeId);
    out.set(parent, list);
  }
  return out;
}

/** The nodes that have a branch to pack. */
export function branchParentIds(nodes: NodeDoc[]): Set<string> {
  return new Set(childrenByParent(nodes).keys());
}

/**
 * What auto-pack keeps off the canvas: everything below a packed parent
 * (`hidden`), and for each packed parent still on it, how many nodes it holds
 * (`counts`). A packed parent inside another packed branch is hidden with it.
 */
export function foldAway(nodes: NodeDoc[], folded: FoldedParents): { hidden: Set<string>; counts: Map<string, number> } {
  const hidden = new Set<string>();
  const counts = new Map<string, number>();
  if (folded.size === 0) return { hidden, counts };
  const children = childrenByParent(nodes);
  const below = (id: string): string[] => {
    const out: string[] = [];
    const seen = new Set([id]);
    const stack = [...(children.get(id) ?? [])];
    while (stack.length > 0) {
      const c = stack.pop()!;
      if (seen.has(c)) continue;
      seen.add(c);
      out.push(c);
      stack.push(...(children.get(c) ?? []));
    }
    return out;
  };
  for (const id of folded) for (const c of below(id)) hidden.add(c);
  for (const id of folded) {
    if (hidden.has(id)) continue;
    const n = below(id).length;
    if (n > 0) counts.set(id, n);
  }
  return { hidden, counts };
}

/**
 * The overview: every parent whose children are all leaves packs them in, so
 * the map keeps its shape — its problems, options and how they branch — and
 * only the last details go. A map that is all leaves under one parent shows
 * just that parent.
 */
export function overviewFolds(nodes: NodeDoc[]): FoldedParents {
  const children = childrenByParent(nodes);
  const out: FoldedParents = new Set();
  for (const [parent, kids] of children) {
    if (kids.every((k) => !children.has(k))) out.add(parent);
  }
  return out;
}
