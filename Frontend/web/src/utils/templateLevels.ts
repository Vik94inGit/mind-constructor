import { nodeRefId } from "./nodeType";
import type { NodeDoc } from "../types";

// A leveled template (utils/templates.ts) asks its questions in rounds: every
// ghost carries its round in Node.level, and a later round's ghosts are
// saved from the start but can't be written in yet, and aren't even shown
// (hiddenLevelIds) until their round opens. A ghost of level L
// unlocks once no ghost of a lower level under the same template root is
// still empty — answered or deleted, either way the earlier round is done.

type LevelNode = Pick<NodeDoc, "nodeId" | "parentId" | "level" | "ghost" | "text"> & { prompt?: string | null };

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

type TreeNode = Pick<NodeDoc, "nodeId" | "parentId">;

/**
 * The locked ghosts left off the canvas: a later round isn't shown at all
 * until the round before it is done, so the map only ever asks what can be
 * answered now. A locked ghost something else hangs from that is shown (the
 * user's own child of it, say) stays on the canvas, still locked, so nothing
 * is ever drawn hanging from nothing.
 */
export function hiddenLevelIds(nodes: TreeNode[], locks: Map<string, LevelLock>): Set<string> {
  const hidden = new Set(locks.keys());
  if (hidden.size === 0) return hidden;
  for (let changed = true; changed; ) {
    changed = false;
    for (const n of nodes) {
      if (hidden.has(n.nodeId)) continue;
      const parentId = nodeRefId(n.parentId);
      if (parentId && hidden.delete(parentId)) changed = true;
    }
  }
  return hidden;
}

/**
 * The round that has just opened: ghosts hidden before and shown now, still
 * waiting to be written in. Its lowest level and how many questions it
 * brings, or null when nothing new came up (a deleted ghost isn't new).
 */
export function revealedRound(
  before: Set<string>,
  after: Set<string>,
  nodes: LevelNode[],
): { level: number; count: number } | null {
  let level = Infinity;
  let count = 0;
  for (const n of nodes) {
    if (!before.has(n.nodeId) || after.has(n.nodeId) || !unfilled(n) || n.level == null) continue;
    count++;
    level = Math.min(level, n.level);
  }
  return count > 0 ? { level, count } : null;
}

export interface TemplateProgress {
  /** The round being answered now (the last one once it's all done). */
  level: number;
  /** How many rounds the template asks in. */
  levels: number;
  /** How many of this round's questions are still empty. */
  left: number;
  /** The next round's questions, to peek at before it opens. */
  next: string[];
  /** Every round answered or skipped. */
  done: boolean;
}

/**
 * Where each leveled template on the map stands, by the node it was grown
 * from: which round it's on, of how many, and what the next one will ask.
 * A template whose questions were all deleted, or asks in one round only,
 * isn't in it.
 */
export function templateProgress(nodes: LevelNode[]): Map<string, TemplateProgress> {
  const out = new Map<string, TemplateProgress>();
  const leveled = nodes.filter((n) => n.level != null);
  if (leveled.length === 0) return out;
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const byRoot = new Map<string, LevelNode[]>();
  for (const n of leveled) {
    const root = templateRoot(n, byId);
    byRoot.set(root, [...(byRoot.get(root) ?? []), n]);
  }
  for (const [root, members] of byRoot) {
    const levels = [...new Set(members.map((n) => n.level!))].sort((a, b) => a - b);
    if (levels.length < 2) continue;
    const open = members.filter(unfilled);
    const level = open.length ? Math.min(...open.map((n) => n.level!)) : levels[levels.length - 1];
    const nextLevel = levels.find((l) => l > level);
    out.set(root, {
      level,
      levels: levels.length,
      left: open.filter((n) => n.level === level).length,
      next: nextLevel == null ? [] : members.filter((n) => n.level === nextLevel && unfilled(n)).map((n) => n.prompt?.trim() ?? "").filter(Boolean),
      done: open.length === 0,
    });
  }
  return out;
}
