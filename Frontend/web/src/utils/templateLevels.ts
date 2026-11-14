import { nodeRefId } from "./nodeType";
import type { NodeDoc } from "../types";

// A leveled template (utils/templates.ts) asks its questions in rounds: every
// ghost carries its round in Node.level, and a later round's ghosts are on
// the canvas from the start but can't be written in yet. A ghost of level L
// unlocks once no ghost of a lower level under the same template root is
// still empty — answered or deleted, either way the earlier round is done.

type LevelNode = Pick<NodeDoc, "nodeId" | "parentId" | "level" | "ghost" | "text">;

/** Still waiting to be written in (see NodeCard's own `ghost`). */
function unfilled(n: LevelNode): boolean {
  return !!n.ghost && !n.text?.trim();
}

/**
 * The node a leveled node's template was grown from: up its parents past
 * every node that carries a level, to the first one that doesn't (or the top).
 */
function templateRoot(n: LevelNode, byId: Map<string, LevelNode>): string {
  let cur = n;
  const seen = new Set<string>();
  for (;;) {
    seen.add(cur.nodeId);
    const parentId = nodeRefId(cur.parentId);
    const parent = parentId ? byId.get(parentId) : undefined;
    if (!parent || seen.has(parent.nodeId)) return parentId ?? cur.nodeId;
    if (parent.level == null) return parent.nodeId;
    cur = parent;
  }
}

export interface LevelLock {
  /** The round that still has to be answered first. */
  waitFor: number;
  /** How many of its questions are still empty. */
  left: number;
}

/**
 * Every locked ghost on the map, by id: what it waits for. A node that isn't
 * a leveled ghost, or whose earlier rounds are all done, isn't in it.
 */
export function levelLocks(nodes: LevelNode[]): Map<string, LevelLock> {
  const out = new Map<string, LevelLock>();
  const leveled = nodes.filter((n) => n.level != null);
  if (leveled.length === 0) return out;
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  // Per template root: how many ghosts of each level are still empty.
  const open = new Map<string, Map<number, number>>();
  const rootOf = new Map<string, string>();
  for (const n of leveled) {
    const root = templateRoot(n, byId);
    rootOf.set(n.nodeId, root);
    if (!unfilled(n)) continue;
    const counts = open.get(root) ?? new Map<number, number>();
    counts.set(n.level!, (counts.get(n.level!) ?? 0) + 1);
    open.set(root, counts);
  }
  for (const n of leveled) {
    if (!unfilled(n)) continue;
    const counts = open.get(rootOf.get(n.nodeId)!);
    if (!counts) continue;
    const earlier = [...counts.keys()].filter((l) => l < n.level!).sort((a, b) => a - b);
    if (earlier.length === 0) continue;
    out.set(n.nodeId, { waitFor: earlier[0], left: counts.get(earlier[0])! });
  }
  return out;
}
