import type { NodeDoc } from "../types";

// The order a zone's emoji cards turn over in when it's chosen: its parent
// first, then the children — by their own order number (Node.order) when they
// have one, otherwise as they come. Nodes without an emoji have nothing to
// flip, so they're left out instead of leaving gaps in the sequence.
export function flipOrder(members: NodeDoc[], rootId: string): string[] {
  const root = members.find((m) => m.nodeId === rootId);
  const children = members
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.nodeId !== rootId)
    .sort((a, b) => (a.m.order ?? Infinity) - (b.m.order ?? Infinity) || a.i - b.i)
    .map(({ m }) => m);
  return (root ? [root, ...children] : children).filter((m) => !!m.emoji).map((m) => m.nodeId);
}
