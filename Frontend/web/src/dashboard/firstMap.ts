import { nodeRefId } from "../utils/nodeType";
import type { MapDoc, NodeDoc } from "../types";

// The dashboard right after someone made their first map from a template:
// that map on top, and the thoughts they wrote last right under it
// (dashboard/FirstMapCard.tsx). Once they have a second template map the
// dashboard goes back to the plain library.

/** The user's one own map made from a template, or null when they have none or more than one. */
export function firstTemplateMap(maps: MapDoc[], userId: string, inboxId: string | null): MapDoc | null {
  const own = maps.filter((m) => m.ownerId === userId && !!m.kind && m.mapId !== inboxId);
  return own.length === 1 ? own[0] : null;
}

/** A node the user wrote: not a ghost still waiting for an answer, not an attack, shield, packed node or picture dot. */
export function isThought(n: NodeDoc): boolean {
  return !n.ghost && !n.isWeapon && !n.isProtection && !n.packedIntoNodeId && !n.picture;
}

/** The newest written thoughts first, at most `limit`. */
export function recentThoughts(nodes: NodeDoc[], limit = 5): NodeDoc[] {
  return nodes
    .filter(isThought)
    .map((n, i) => ({ n, i }))
    // Newest first; the list's own order (creation order) breaks a tie or a missing date.
    .sort((a, b) => (b.n.createdAt ?? "").localeCompare(a.n.createdAt ?? "") || b.i - a.i)
    .slice(0, limit)
    .map(({ n }) => n);
}

export interface MiniNode {
  id: string;
  x: number;
  y: number;
  type: NodeDoc["type"];
  ghost: boolean;
}

export interface Miniature {
  nodes: MiniNode[];
  links: { from: MiniNode; to: MiniNode }[];
}

/** The map's nodes scaled to fit a `w`×`h` box with `pad` round it, with a line from each to its parent. */
export function miniature(nodes: NodeDoc[], w: number, h: number, pad = 14): Miniature {
  const placed = nodes.filter(
    (n) => !n.isWeapon && !n.isProtection && !n.packedIntoNodeId && typeof n.x === "number" && typeof n.y === "number",
  );
  if (placed.length === 0) return { nodes: [], links: [] };
  const xs = placed.map((n) => n.x!);
  const ys = placed.map((n) => n.y!);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const scale = Math.min((w - 2 * pad) / Math.max(spanX, 1), (h - 2 * pad) / Math.max(spanY, 1), 0.5);
  // Centred in the box, whatever its shape.
  const offX = (w - spanX * scale) / 2;
  const offY = (h - spanY * scale) / 2;
  const mini: MiniNode[] = placed.map((n) => ({
    id: n.nodeId,
    x: offX + (n.x! - minX) * scale,
    y: offY + (n.y! - minY) * scale,
    type: n.type,
    ghost: !!n.ghost,
  }));
  const byId = new Map(mini.map((m) => [m.id, m]));
  const links = placed.flatMap((n) => {
    const parent = byId.get(nodeRefId(n.parentId) ?? "");
    const self = byId.get(n.nodeId)!;
    return parent ? [{ from: parent, to: self }] : [];
  });
  return { nodes: mini, links };
}
