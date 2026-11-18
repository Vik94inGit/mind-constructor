import type { NodeDoc } from "../types";
import { nodeRefId, zoneParentId } from "./nodeType";

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

/**
 * The order the arrows step through a map with no zone chosen: zone by zone.
 * A parent comes with all its children together (the zone it draws), then the
 * zones further down the first child's branch, then the next child's, so one
 * zone is finished before the next begins. An attack still comes right after
 * the node it hit. Siblings go by bySiblingOrder, like readingOrder.
 */
export function zoneOrder(nodes: NodeDoc[]): NodeDoc[] {
  const ids = new Set(nodes.map((n) => n.nodeId));
  const zoneKids = new Map<string, NodeDoc[]>();
  const sideKids = new Map<string, NodeDoc[]>();
  const roots: NodeDoc[] = [];
  for (const n of nodes) {
    const parent = nodeRefId(n.parentId);
    if (!parent || !ids.has(parent) || parent === n.nodeId) {
      roots.push(n);
      continue;
    }
    // An attack hanging from the node it hit is no member of that node's zone.
    const into = zoneParentId(n) === parent ? zoneKids : sideKids;
    const list = into.get(parent) ?? [];
    list.push(n);
    into.set(parent, list);
  }
  for (const list of [...zoneKids.values(), ...sideKids.values()]) list.sort(bySiblingOrder);
  const out: NodeDoc[] = [];
  const seen = new Set<string>();
  const emit = (n: NodeDoc) => {
    if (seen.has(n.nodeId)) return;
    seen.add(n.nodeId);
    out.push(n);
    for (const a of sideKids.get(n.nodeId) ?? []) emit(a);
  };
  const visited = new Set<string>();
  const visitZone = (p: NodeDoc) => {
    if (visited.has(p.nodeId)) return;
    visited.add(p.nodeId);
    const kids = zoneKids.get(p.nodeId) ?? [];
    for (const k of kids) emit(k);
    for (const a of sideKids.get(p.nodeId) ?? []) visitZone(a);
    for (const k of kids) visitZone(k);
  };
  for (const r of roots.sort(bySiblingOrder)) {
    emit(r);
    visitZone(r);
  }
  // A parentId loop has no root to start from; keep those nodes reachable too.
  for (const n of nodes) {
    emit(n);
    visitZone(n);
  }
  return out;
}

/**
 * The nodes the camera frames when the arrows reach `id` in zoneOrder: its
 * parent with all the parent's children (the zone it was stepped in), or, for
 * a top node, itself with its own children. An attack is framed with the node
 * it hit. Empty when `id` isn't on the map.
 */
export function zoneStepIds(nodes: NodeDoc[], id: string): string[] {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  let node = byId.get(id);
  if (!node) return [];
  // An attack shows with the node it hit (up through attacks on attacks).
  const hops = new Set<string>();
  while (node && node.isWeapon && !hops.has(node.nodeId)) {
    hops.add(node.nodeId);
    const parent = nodeRefId(node.parentId);
    if (!parent || zoneParentId(node) === parent || !byId.has(parent)) break;
    node = byId.get(parent)!;
  }
  const parent = zoneParentId(node);
  const head = parent && byId.has(parent) && parent !== node.nodeId ? parent : node.nodeId;
  const kids = nodes.filter((n) => n.nodeId !== head && zoneParentId(n) === head).map((n) => n.nodeId);
  return [head, ...kids];
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
