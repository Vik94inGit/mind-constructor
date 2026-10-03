import { sideFacing } from "./puzzleLinks";
import type { Side } from "./puzzleLinks";

// Linked puzzle cards are drawn assembled: each piece sits flush against the
// piece it's linked to, its blank taking that piece's tab, instead of
// wherever its own position happens to put it (cards keep a fixed size on
// screen while the canvas zooms, so pieces placed apart at one zoom overlap
// at another). Starting from a root at its own position, every linked piece
// is seated on the side of its neighbour it lies toward — the side
// sideFacing picks, so the map keeps its rough shape — or the nearest free
// side when that one is taken. Each side holds one piece; a piece with no
// free side left that wouldn't overlap another stays at its own position.
// Display only: nothing here is saved.

type Pt = { x: number; y: number };
export type Size = { w: number; h: number };

/** A link between two pieces, `from` the one whose tab goes into `to`'s blank. */
export interface PieceLink {
  from: string;
  to: string;
}

export interface Assembly {
  /** Where each seated piece is drawn — pieces left where they are aren't in it. */
  positions: Map<string, Pt>;
  /** The links whose two pieces sit flush, in the order they were seated. */
  seated: PieceLink[];
}

const OPPOSITE: Side[] = [2, 3, 0, 1];

// Where `b` sits flush against `a` on `a`'s side `side`, the two centered on
// each other across it, so the knobs (always mid-side) meet.
function seatOn(a: Pt, sa: Size, sb: Size, side: Side): Pt {
  switch (side) {
    case 0:
      return { x: a.x, y: a.y - sa.h / 2 - sb.h / 2 };
    case 1:
      return { x: a.x + sa.w / 2 + sb.w / 2, y: a.y };
    case 2:
      return { x: a.x, y: a.y + sa.h / 2 + sb.h / 2 };
    default:
      return { x: a.x - sa.w / 2 - sb.w / 2, y: a.y };
  }
}

// The sides to try for a piece lying toward `preferred`: that one, then the
// two beside it (the one nearer the piece first), then the far one.
function sideOrder(preferred: Side, from: Pt, to: Pt): Side[] {
  const vertical = preferred === 0 || preferred === 2;
  const across: Side[] = vertical ? (to.x >= from.x ? [1, 3] : [3, 1]) : to.y >= from.y ? [2, 0] : [0, 2];
  return [preferred, ...across, OPPOSITE[preferred]];
}

/**
 * Lays linked pieces out flush against each other. `ids` are the pieces
 * drawn as cards, in a stable order; `links` the map's links between them,
 * branch links first (they win a side over cross-links); `sizes` each card's
 * box in canvas units; `fixed` pieces held where they are (never moved, but
 * others still seat against them).
 */
export function assemblePuzzles(
  ids: string[],
  links: PieceLink[],
  positions: Map<string, Pt>,
  sizes: Map<string, Size>,
  fixed: Set<string> = new Set(),
): Assembly {
  const pieces = ids.filter((id) => positions.has(id) && sizes.has(id));
  const isPiece = new Set(pieces);
  const neighbours = new Map<string, { other: string; link: PieceLink }[]>();
  const hasParent = new Set<string>();
  const seen = new Set<string>();
  for (const link of links) {
    if (link.from === link.to || !isPiece.has(link.from) || !isPiece.has(link.to)) continue;
    const key = [link.from, link.to].sort().join("\n");
    if (seen.has(key)) continue;
    seen.add(key);
    hasParent.add(link.to);
    for (const [a, b] of [
      [link.from, link.to],
      [link.to, link.from],
    ]) {
      if (!neighbours.has(a)) neighbours.set(a, []);
      neighbours.get(a)!.push({ other: b, link });
    }
  }

  const placed = new Map<string, Pt>();
  const used = new Map<string, Set<Side>>();
  const seated: PieceLink[] = [];
  const sideSet = (id: string) => {
    let s = used.get(id);
    if (!s) used.set(id, (s = new Set()));
    return s;
  };
  const overlaps = (id: string, at: Pt) => {
    const s = sizes.get(id)!;
    for (const [other, p] of placed) {
      const o = sizes.get(other)!;
      // A hair of slack, so pieces sitting edge to edge don't count.
      if (Math.abs(p.x - at.x) < (s.w + o.w) / 2 - 1 && Math.abs(p.y - at.y) < (s.h + o.h) / 2 - 1) return true;
    }
    return false;
  };

  function grow(start: string) {
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const a = queue[i];
      const at = placed.get(a)!;
      for (const { other: b, link } of neighbours.get(a) ?? []) {
        if (placed.has(b) || fixed.has(b)) continue;
        const own = positions.get(b)!;
        for (const side of sideOrder(sideFacing(positions.get(a)!, own), positions.get(a)!, own)) {
          if (sideSet(a).has(side)) continue;
          const spot = seatOn(at, sizes.get(a)!, sizes.get(b)!, side);
          if (overlaps(b, spot)) continue;
          placed.set(b, spot);
          sideSet(a).add(side);
          sideSet(b).add(OPPOSITE[side]);
          seated.push(link);
          queue.push(b);
          break;
        }
      }
    }
  }

  // Held pieces first, where they are; then each tree from its root; then
  // anything left (a loop of links has no root).
  const starts = [
    ...pieces.filter((id) => fixed.has(id)),
    ...pieces.filter((id) => !fixed.has(id) && !hasParent.has(id)),
    ...pieces,
  ];
  for (const id of starts) {
    if (placed.has(id)) continue;
    placed.set(id, positions.get(id)!);
    grow(id);
  }

  const out = new Map<string, Pt>();
  for (const [id, p] of placed) {
    const own = positions.get(id)!;
    if (p.x !== own.x || p.y !== own.y) out.set(id, p);
  }
  return { positions: out, seated };
}
