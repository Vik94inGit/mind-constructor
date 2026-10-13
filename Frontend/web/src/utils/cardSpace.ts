import type { NodeDoc } from "../types";
import type { ReadingMode } from "./readingMode";

type Pt = { x: number; y: number };

// A puzzle card is far bigger than an icon, so one shared spot suits only one
// of them: cards laid out for reading overlap as icons, or icons laid out
// tight overlap as cards. So a node drawn as a puzzle card keeps its own
// spot (NodeDoc.cardX/cardY), apart from the icon's x/y, and falls back to
// x/y until it's first moved as a card.
//
// Only the full puzzle look counts: a zone parent shown as a card in the
// mixed view stays at its icon spot, since the icons around it — its own
// zone — are laid out against it.

/** The ids of the nodes that sit at their card spot right now. */
export function cardSpaceIds(nodes: NodeDoc[], modeOf: (nodeId: string) => ReadingMode): Set<string> {
  return new Set(nodes.filter((n) => modeOf(n.nodeId) === "puzzle").map((n) => n.nodeId));
}

/** `nodes` with each card-space node's x/y swapped for its card spot, where it has one. */
export function withCardSpots(nodes: NodeDoc[], cardSpace: Set<string>): NodeDoc[] {
  if (cardSpace.size === 0) return nodes;
  return nodes.map((n) =>
    cardSpace.has(n.nodeId) && typeof n.cardX === "number" && typeof n.cardY === "number"
      ? { ...n, x: n.cardX, y: n.cardY }
      : n,
  );
}

/** The fields that put a node at `pt` in the space it's drawn in. */
export function spotFields(inCardSpace: boolean, pt: Pt): Partial<NodeDoc> {
  return inCardSpace ? { cardX: pt.x, cardY: pt.y } : { x: pt.x, y: pt.y };
}

/** Both of a node's stored spots, to put back if a move fails. */
export function storedSpots(n: NodeDoc): Partial<NodeDoc> {
  return { x: n.x, y: n.y, cardX: n.cardX, cardY: n.cardY };
}
