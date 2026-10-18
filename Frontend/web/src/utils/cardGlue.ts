// Cards glue together and never pile up: dragging a card close to another
// pulls it flush against that card's nearest side, and a card let go on top
// of others is moved just far enough to clear them. Pure geometry — the
// caller supplies each card's center and size (see usePuzzleConnect).

type Pt = { x: number; y: number };

export interface CardBox {
  id: string;
  /** Center, in canvas units. */
  x: number;
  y: number;
  /** The card's own box, in canvas units. */
  w: number;
  h: number;
}

export interface Snap {
  x: number;
  y: number;
  partnerId: string;
  /** The link a glue makes runs from the card glued onto to the one brought to it. */
  from: string;
  to: string;
}

// Where the dragged card's center goes to sit flush against `other` on its
// side `side` (0 top, 1 right, 2 bottom, 3 left of `other`), lined up with it
// along that side.
function seat(dragged: { w: number; h: number }, other: CardBox, side: number): Pt {
  switch (side) {
    case 0:
      return { x: other.x, y: other.y - other.h / 2 - dragged.h / 2 };
    case 1:
      return { x: other.x + other.w / 2 + dragged.w / 2, y: other.y };
    case 2:
      return { x: other.x, y: other.y + other.h / 2 + dragged.h / 2 };
    default:
      return { x: other.x - other.w / 2 - dragged.w / 2, y: other.y };
  }
}

/**
 * The nearest glue for `dragged` (centered at its proposed `x`/`y`) against
 * any of `others` within `reach` canvas units, or null when none is close.
 * Every side of every card fits.
 */
export function findSnap(dragged: CardBox, others: CardBox[], reach: number): Snap | null {
  let best: Snap | null = null;
  let bestDist = reach;
  for (const other of others) {
    if (other.id === dragged.id) continue;
    for (let side = 0; side < 4; side++) {
      const at = seat(dragged, other, side);
      const d = Math.hypot(at.x - dragged.x, at.y - dragged.y);
      if (d < bestDist) {
        bestDist = d;
        best = { x: at.x, y: at.y, partnerId: other.id, from: other.id, to: dragged.id };
      }
    }
  }
  return best;
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: CardBox): boolean {
  // Touching edges (a glue) is not an overlap; a hair of slack absorbs rounding.
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 0.5 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - 0.5;
}

/**
 * Where `dragged` can sit nearest its proposed center without covering any
 * of `others`: the spot itself when it's clear, else the closest spot found
 * by pushing it out past the cards it lands on (a few rounds, so a push that
 * lands on a neighbour is pushed on again). Falls back to the spot itself
 * when everything near is packed.
 */
export function clearOfCards(dragged: CardBox, others: CardBox[]): Pt {
  const rest = others.filter((o) => o.id !== dragged.id);
  const free = (p: Pt) => !rest.some((o) => overlaps({ ...p, w: dragged.w, h: dragged.h }, o));
  const start = { x: dragged.x, y: dragged.y };
  if (free(start)) return start;
  let frontier: Pt[] = [start];
  const seen = new Set<string>();
  for (let round = 0; round < 4; round++) {
    const next: Pt[] = [];
    for (const p of frontier) {
      for (const o of rest) {
        if (!overlaps({ ...p, w: dragged.w, h: dragged.h }, o)) continue;
        for (let side = 0; side < 4; side++) {
          const s = seat(dragged, o, side);
          // Pushed straight out: only the axis it leaves along moves.
          const q = side % 2 === 0 ? { x: p.x, y: s.y } : { x: s.x, y: p.y };
          const key = `${Math.round(q.x)},${Math.round(q.y)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          next.push(q);
        }
      }
    }
    const clear = next.filter(free);
    if (clear.length > 0) {
      return clear.reduce((a, b) =>
        Math.hypot(a.x - start.x, a.y - start.y) <= Math.hypot(b.x - start.x, b.y - start.y) ? a : b,
      );
    }
    frontier = next;
  }
  return start;
}

/**
 * Where a new card of `size` goes when it branches off `parent`: just under
 * it with a `gap` between (not glued flush; the new card's own size is only a
 * guess until it's drawn), moved clear of `others` like a dropped card.
 */
export function spotBelow(parent: CardBox, size: { w: number; h: number }, others: CardBox[], gap: number): Pt {
  const below = { id: "", x: parent.x, y: parent.y + parent.h / 2 + gap + size.h / 2, ...size };
  return clearOfCards(below, [parent, ...others]);
}

/**
 * Every card glued to `startId`, directly or through others — the whole
 * block it's part of, `startId` first. Two cards count as glued when they're
 * `linked` and sit flush, their boxes touching (within `tolerance` canvas
 * units) along one side; linked cards apart on the canvas, or ones merely
 * lying against each other, don't.
 */
export function connectedPieces(
  startId: string,
  pieces: CardBox[],
  linked: (a: string, b: string) => boolean,
  tolerance: number,
): string[] {
  const byId = new Map(pieces.map((p) => [p.id, p]));
  if (!byId.has(startId)) return [startId];
  const flush = (a: CardBox, b: CardBox) => {
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
