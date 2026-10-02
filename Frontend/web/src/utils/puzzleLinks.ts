import type { EdgeDoc, NodeDoc } from "../types";
import { nodeRefId } from "./nodeType";

// Puzzle cards (see map/PuzzleCard.tsx) interlock along the map's links: a
// node's piece gets a tab on the side facing each node it leads to (a child,
// or the far end of an edge it starts) and a matching blank on the side
// facing whatever leads to it. Those sides are "joined" — drawn heavier, so
// the cut reads as fitted to a neighbour. A piece joined on all four sides
// is complete. Sides with no link keep the piece's own seeded cut.

/** Top, right, bottom, left — same order as PuzzleCard's edges. */
export type Side = 0 | 1 | 2 | 3;

export interface PuzzleJoins {
  /** Per side: 1 a tab out to a node this one leads to, -1 a blank for one leading here, undefined unlinked. */
  cuts: (1 | -1 | undefined)[];
  /** Every side is joined to a neighbour. */
  complete: boolean;
}

type Pt = { x: number; y: number };

// Which side of a piece at `from` faces `to`: whichever axis the gap is
// larger along. Screen y grows downward, so a node below is on the bottom.
export function sideFacing(from: Pt, to: Pt): Side {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 1 : 3;
  return dy >= 0 ? 2 : 0;
}

export function computePuzzleJoins(
  nodes: NodeDoc[],
  edges: EdgeDoc[],
  positions: Map<string, Pt>,
): Map<string, PuzzleJoins> {
  const out = new Map<string, PuzzleJoins>();
  const get = (id: string) => {
    let j = out.get(id);
    if (!j) {
      j = { cuts: [undefined, undefined, undefined, undefined], complete: false };
      out.set(id, j);
    }
    return j;
  };
  const link = (fromId: string | undefined, toId: string | undefined) => {
    if (!fromId || !toId || fromId === toId) return;
    const a = positions.get(fromId);
    const b = positions.get(toId);
    if (!a || !b || (a.x === b.x && a.y === b.y)) return;
    // The first link to claim a side keeps it — parent links go first (see
    // below), so a tree's own shape wins over a cross-link.
    const ja = get(fromId);
    const sa = sideFacing(a, b);
    if (ja.cuts[sa] === undefined) ja.cuts[sa] = 1;
    const jb = get(toId);
    const sb = sideFacing(b, a);
    if (jb.cuts[sb] === undefined) jb.cuts[sb] = -1;
  };
  const visible = new Set(nodes.map((n) => n.nodeId));
  for (const n of nodes) {
    const parent = nodeRefId(n.parentId);
    if (parent && visible.has(parent)) link(parent, n.nodeId);
  }
  for (const e of edges) {
    const from = nodeRefId(e.fromNodeId);
    const to = nodeRefId(e.toNodeId);
    if (from && to && visible.has(from) && visible.has(to)) link(from, to);
  }
  for (const j of out.values()) j.complete = j.cuts.every((c) => c !== undefined);
  return out;
}
