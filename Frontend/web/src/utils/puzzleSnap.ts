import type { PuzzleEdges } from "../map/PuzzleCard";

// Puzzle pieces click together: dragging a piece close to another so that a
// tab of one faces a blank of the other pulls it flush against that piece,
// the tab sitting in the blank. Pure geometry — the caller supplies each
// piece's center, size and cut (see MapPage's puzzleSnapFor).

type Pt = { x: number; y: number };

export interface SnapPiece {
  id: string;
  /** Center, in canvas units. */
  x: number;
  y: number;
  /** The card's own box (tabs not included), in canvas units. */
  w: number;
  h: number;
  /** Top, right, bottom, left — 1 a tab, -1 a blank. */
  edges: PuzzleEdges;
}

export interface Snap {
  x: number;
  y: number;
  partnerId: string;
  /** Which piece's tab went into which piece's blank — the link a fit makes runs from `from` to `to`. */
  from: string;
  to: string;
}

// Where the dragged piece's center goes to sit flush against `other` along
// its side `side` (0 top, 1 right, 2 bottom, 3 left): edge to edge, centers
// lined up across it, so the two knobs — always in the middle of a side —
// meet. A blank is cut as deep as a tab sticks out, so edge to edge is an
// exact fit.
function seat(dragged: { w: number; h: number }, other: SnapPiece, side: number): Pt {
  switch (side) {
    case 0: // dragged's top meets other's bottom: dragged sits below
      return { x: other.x, y: other.y + other.h / 2 + dragged.h / 2 };
    case 1: // dragged's right meets other's left: dragged sits to the left
      return { x: other.x - other.w / 2 - dragged.w / 2, y: other.y };
    case 2:
      return { x: other.x, y: other.y - other.h / 2 - dragged.h / 2 };
    default:
      return { x: other.x + other.w / 2 + dragged.w / 2, y: other.y };
  }
}

/**
 * The nearest fit for `dragged` (centered at its proposed `x`/`y`) against
 * any of `others` within `reach` canvas units, or null when none is close.
 */
export function findSnap(dragged: SnapPiece, others: SnapPiece[], reach: number): Snap | null {
  let best: Snap | null = null;
  let bestDist = reach;
  for (const other of others) {
    if (other.id === dragged.id) continue;
    for (let side = 0; side < 4; side++) {
      const mine = dragged.edges[side];
      const theirs = other.edges[(side + 2) % 4];
      // A tab into a blank (either way round) — two tabs or two blanks don't fit.
      if (mine === 0 || mine !== -theirs) continue;
      const at = seat(dragged, other, side);
      const d = Math.hypot(at.x - dragged.x, at.y - dragged.y);
      if (d < bestDist) {
        bestDist = d;
        best = {
          x: at.x,
          y: at.y,
          partnerId: other.id,
          from: mine === 1 ? dragged.id : other.id,
          to: mine === 1 ? other.id : dragged.id,
        };
      }
    }
  }
  return best;
}

/**
 * Every piece clicked together with `startId`, directly or through others —
 * the whole assembled puzzle it's part of, `startId` first. Two pieces count
 * as clicked together when they're `linked` and sit flush, their boxes
 * touching (within `tolerance` canvas units) along one side; linked pieces
 * apart on the canvas, or ones merely lying against each other, don't.
 */
export function connectedPieces(
  startId: string,
  pieces: SnapPiece[],
  linked: (a: string, b: string) => boolean,
  tolerance: number,
): string[] {
  const byId = new Map(pieces.map((p) => [p.id, p]));
  if (!byId.has(startId)) return [startId];
  const flush = (a: SnapPiece, b: SnapPiece) => {
    const gapX = Math.abs(a.x - b.x) - (a.w + b.w) / 2;
    const gapY = Math.abs(a.y - b.y) - (a.h + b.h) / 2;
    // Touching along a vertical side (side by side, overlapping in y), or a
    // horizontal one (stacked, overlapping in x).
    return (Math.abs(gapX) <= tolerance && gapY < 0) || (Math.abs(gapY) <= tolerance && gapX < 0);
  };
  const out = [startId];
  const seen = new Set(out);
  for (let i = 0; i < out.length; i++) {
    const a = byId.get(out[i])!;
    for (const b of pieces) {
      if (seen.has(b.id) || !flush(a, b) || !linked(a.id, b.id)) continue;
      seen.add(b.id);
      out.push(b.id);
    }
  }
  return out;
}
