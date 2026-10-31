// The cards view lays its cards close together, like notes spread on a desk:
// no links drawn between them, each card next to the one before it in
// reading order (each top idea, then its branch), row after row, so a branch
// stays together and any two cards can be dragged side by side to compare.
// Pure geometry — the caller measures each card (see MapPage's packCards).

export interface PackItem {
  id: string;
  /** The card's own box, in canvas units. */
  w: number;
  h: number;
}

type Pt = { x: number; y: number };

/** The room left between two cards. */
export const PACK_GAP = 14;

/** The block's shape, width over height: the screen's, so the cards fill it. */
export const DESKTOP_ASPECT = 1.6;

/**
 * The block's shape for a screen of this shape (width over height): as wide
 * as a wide screen, but never narrower than a square, so a phone gets a square
 * block of cards side by side rather than one long column.
 */
export function blockAspect(screenAspect: number): number {
  return Number.isFinite(screenAspect) && screenAspect > 1 ? screenAspect : 1;
}

/**
 * Each card's center, laid out in `items`' order left to right in rows that
 * wrap where the block takes about the screen's shape (`aspect`, width over
 * height), the block's top-left corner at `topLeft`. A row is as tall as its
 * tallest card; cards in it hang from its top edge.
 */
export function packCards(items: PackItem[], topLeft: Pt, gap = PACK_GAP, aspect = DESKTOP_ASPECT): Map<string, Pt> {
  const out = new Map<string, Pt>();
  if (items.length === 0) return out;
  const area = items.reduce((sum, it) => sum + (it.w + gap) * (it.h + gap), 0);
  // On a wide screen never fewer than three cards to a row, so a few cards
  // sit side by side; a phone stacks them.
  const firstThree = aspect >= 1 ? items.slice(0, 3).reduce((sum, it) => sum + it.w + gap, -gap) : 0;
  const rowWidth = Math.max(...items.map((it) => it.w), Math.sqrt(area * aspect), firstThree);
  let x = topLeft.x;
  let y = topLeft.y;
  let rowHeight = 0;
  for (const it of items) {
    if (x > topLeft.x && x + it.w > topLeft.x + rowWidth) {
      x = topLeft.x;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    out.set(it.id, { x: x + it.w / 2, y: y + it.h / 2 });
    x += it.w + gap;
    rowHeight = Math.max(rowHeight, it.h);
  }
  return out;
}

/** The block `packCards` makes, centered on `center`. */
export function packCardsAround(items: PackItem[], center: Pt, gap = PACK_GAP, aspect = DESKTOP_ASPECT): Map<string, Pt> {
  const at = packCards(items, { x: 0, y: 0 }, gap, aspect);
  const box = boundsOf(items, at);
  if (!box) return at;
  const dx = center.x - (box.minX + box.maxX) / 2;
  const dy = center.y - (box.minY + box.maxY) / 2;
  const out = new Map<string, Pt>();
  for (const [id, p] of at) out.set(id, { x: p.x + dx, y: p.y + dy });
  return out;
}

/** The box round the cards at `at` (by center), or null when there are none. */
export function boundsOf(
  items: PackItem[],
  at: Map<string, Pt>,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let box: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  for (const it of items) {
    const p = at.get(it.id);
    if (!p) continue;
    const minX = p.x - it.w / 2;
    const minY = p.y - it.h / 2;
    const maxX = p.x + it.w / 2;
    const maxY = p.y + it.h / 2;
    box = box
      ? { minX: Math.min(box.minX, minX), minY: Math.min(box.minY, minY), maxX: Math.max(box.maxX, maxX), maxY: Math.max(box.maxY, maxY) }
      : { minX, minY, maxX, maxY };
  }
  return box;
}

/**
 * Where the cards that have no spot of their own go: packed together just
 * below the cards that do (`placed`), lined up with their left edge — or,
 * when none has a spot yet, round `center`. Cards already placed never move.
 */
export function packNewCards(
  fresh: PackItem[],
  placed: PackItem[],
  placedAt: Map<string, Pt>,
  center: Pt,
  gap = PACK_GAP,
  aspect = DESKTOP_ASPECT,
): Map<string, Pt> {
  const box = boundsOf(placed, placedAt);
  if (!box) return packCardsAround(fresh, center, gap, aspect);
  return packCards(fresh, { x: box.minX, y: box.maxY + gap * 3 }, gap, aspect);
}

/**
 * Whether any two of the cards at `at` (by center) cover each other by more
 * than `slack` on both axes. Cards glued side by side only touch, so they
 * don't count.
 */
export function cardsOverlap(items: PackItem[], at: Map<string, Pt>, slack = 4): boolean {
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    const pa = at.get(a.id);
    if (!pa) continue;
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      const pb = at.get(b.id);
      if (!pb) continue;
      if (
        (a.w + b.w) / 2 - Math.abs(pa.x - pb.x) > slack &&
        (a.h + b.h) / 2 - Math.abs(pa.y - pb.y) > slack
      ) {
        return true;
      }
    }
  }
  return false;
}
