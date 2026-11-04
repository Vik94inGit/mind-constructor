import { nodeRefId } from "./nodeType";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

// Where a map opens: on its first parent, never on empty canvas.
//
// The first parent is the map's first node when it is still a root, else
// the oldest root that has children, else the oldest root. Weapons and
// shields are left out: they hang from what they hit. Null when the map has
// no node with a position (an empty map opens on the canvas's middle).
export function firstParentPoint(nodes: NodeDoc[], positions: Map<string, Pt>): Pt | null {
  const placed = nodes.filter((n) => !n.isWeapon && !n.isProtection && positions.has(n.nodeId));
  if (placed.length === 0) return null;
  const ids = new Set(placed.map((n) => n.nodeId));
  const hasChildren = new Set<string>();
  for (const n of placed) {
    const parentId = nodeRefId(n.parentId);
    if (parentId && ids.has(parentId)) hasChildren.add(parentId);
  }
  const roots = placed.filter((n) => {
    const parentId = nodeRefId(n.parentId);
    return !parentId || !ids.has(parentId);
  });
  const index = new Map(nodes.map((n, i) => [n.nodeId, i] as const));
  const oldest = (a: NodeDoc, b: NodeDoc) => {
    const at = a.createdAt ?? "";
    const bt = b.createdAt ?? "";
    return at < bt ? -1 : at > bt ? 1 : index.get(a.nodeId)! - index.get(b.nodeId)!;
  };
  roots.sort(oldest);
  const pick =
    roots.find((n) => n.isFirstNode) ?? roots.find((n) => hasChildren.has(n.nodeId)) ?? roots[0] ?? placed[0];
  return positions.get(pick.nodeId) ?? null;
}

// Whether a screen centered on `center` (half a screen each way) would show
// any node at all: a saved spot from last time is only worth going back to
// when it does.
export function showsAnyNode(center: Pt, positions: Map<string, Pt>, halfW: number, halfH: number): boolean {
  for (const p of positions.values()) {
    if (Math.abs(p.x - center.x) <= halfW && Math.abs(p.y - center.y) <= halfH) return true;
  }
  return false;
}
