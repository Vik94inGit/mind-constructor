import type { NodeDoc } from "../types";
import { nodeRefId } from "./nodeType";

// The order the node panel's arrow keys step through a map's nodes: the
// parentId tree read like an outline — each top idea, then its branch, depth
// first. Siblings go by their step number (Node.order) when they have one,
// then by when they were written.
function bySiblingOrder(a: NodeDoc, b: NodeDoc): number {
  const oa = a.order ?? Infinity;
  const ob = b.order ?? Infinity;
  if (oa !== ob) return oa - ob;
  return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
}

export function readingOrder(nodes: NodeDoc[]): NodeDoc[] {
  const ids = new Set(nodes.map((n) => n.nodeId));
  const children = new Map<string, NodeDoc[]>();
  const roots: NodeDoc[] = [];
  for (const n of nodes) {
    const parent = nodeRefId(n.parentId);
    if (parent && ids.has(parent) && parent !== n.nodeId) {
      const list = children.get(parent) ?? [];
      list.push(n);
      children.set(parent, list);
    } else roots.push(n);
  }
  const out: NodeDoc[] = [];
  const seen = new Set<string>();
  const walk = (n: NodeDoc) => {
    if (seen.has(n.nodeId)) return;
    seen.add(n.nodeId);
    out.push(n);
    for (const c of (children.get(n.nodeId) ?? []).sort(bySiblingOrder)) walk(c);
  };
  for (const r of roots.sort(bySiblingOrder)) walk(r);
  // A parentId loop has no root to start from; keep those nodes reachable too.
  for (const n of nodes) walk(n);
  return out;
}

/** The node before (-1) or after (1) this one in reading order, or null at either end. */
export function stepNode(nodes: NodeDoc[], fromId: string, dir: -1 | 1): string | null {
  const order = readingOrder(nodes);
  const i = order.findIndex((n) => n.nodeId === fromId);
  if (i === -1) return null;
  return order[i + dir]?.nodeId ?? null;
}

/**
 * The order the arrows step through a chosen zone: oldest thought first, so
 * stepping replays how the thinking grew. Nodes written at the same moment
 * (or with no date) keep their reading order.
 */
export function creationOrder(nodes: NodeDoc[]): NodeDoc[] {
  const reading = readingOrder(nodes);
  const rank = new Map(reading.map((n, i) => [n.nodeId, i]));
  return reading.slice().sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : NaN;
    const tb = b.createdAt ? Date.parse(b.createdAt) : NaN;
    if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb;
    if (Number.isNaN(ta) !== Number.isNaN(tb)) return Number.isNaN(ta) ? 1 : -1;
    return rank.get(a.nodeId)! - rank.get(b.nodeId)!;
  });
}

/**
 * The next node to read along `order`: the one before (-1) or after (1)
 * `fromId`, or, when `fromId` is null or not in the order, the first (→) or
 * last (←). Null at either end.
 */
export function stepAlong(order: NodeDoc[], fromId: string | null, dir: -1 | 1): string | null {
  const i = fromId ? order.findIndex((n) => n.nodeId === fromId) : -1;
  if (i === -1) return (dir === 1 ? order[0] : order[order.length - 1])?.nodeId ?? null;
  return order[i + dir]?.nodeId ?? null;
}
