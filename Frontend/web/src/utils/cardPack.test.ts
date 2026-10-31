import { describe, expect, it } from "vitest";
import { BLOCK_ASPECT, boundsOf, cardsOverlap, packCards, packCardsAround, packNewCards } from "./cardPack";
import type { PackItem } from "./cardPack";

const card = (id: string, w = 100, h = 60): PackItem => ({ id, w, h });

function overlap(items: PackItem[], at: Map<string, { x: number; y: number }>): boolean {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      const pa = at.get(a.id)!;
      const pb = at.get(b.id)!;
      if (Math.abs(pa.x - pb.x) < (a.w + b.w) / 2 && Math.abs(pa.y - pb.y) < (a.h + b.h) / 2) return true;
    }
  }
  return false;
}

describe("packCards", () => {
  it("lays cards in reading order, left to right, a gap apart", () => {
    const at = packCards([card("a"), card("b")], { x: 0, y: 0 }, 10);
    expect(at.get("a")).toEqual({ x: 50, y: 30 });
    expect(at.get("b")).toEqual({ x: 160, y: 30 });
  });

  it("wraps into rows of a roughly square block, none overlapping", () => {
    const items = Array.from({ length: 9 }, (_, i) => card(`c${i}`, 80 + (i % 3) * 30, 40 + (i % 2) * 30));
    const at = packCards(items, { x: 0, y: 0 });
    expect(overlap(items, at)).toBe(false);
    const box = boundsOf(items, at)!;
    const w = box.maxX - box.minX;
    const h = box.maxY - box.minY;
    expect(w / h).toBeLessThan(4);
    expect(new Set(items.map((it) => at.get(it.id)!.y)).size).toBeGreaterThan(1);
  });

  it("hangs the cards of a row from its top edge", () => {
    const at = packCards([card("tall", 100, 200), card("short", 100, 40)], { x: 0, y: 0 }, 10);
    expect(at.get("tall")!.y - 100).toBe(0);
    expect(at.get("short")!.y - 20).toBe(0);
  });

  it("centers the block on a point", () => {
    const items = [card("a"), card("b"), card("c")];
    const at = packCardsAround(items, { x: 1000, y: 500 });
    const box = boundsOf(items, at)!;
    expect((box.minX + box.maxX) / 2).toBeCloseTo(1000);
    expect((box.minY + box.maxY) / 2).toBeCloseTo(500);
  });
});

describe("packNewCards", () => {
  it("packs new cards under the ones already laid out, never moving those", () => {
    const placed = [card("p")];
    const placedAt = new Map([["p", { x: 500, y: 300 }]]);
    const at = packNewCards([card("n1"), card("n2")], placed, placedAt, { x: 0, y: 0 }, 10);
    expect(at.has("p")).toBe(false);
    expect(at.get("n1")!.y - 30).toBeGreaterThan(330);
    expect(at.get("n1")!.x - 50).toBe(450);
  });

  it("packs round the center when nothing is laid out yet", () => {
    const items = [card("a"), card("b")];
    const at = packNewCards(items, [], new Map(), { x: 200, y: 200 });
    const box = boundsOf(items, at)!;
    expect((box.minX + box.maxX) / 2).toBeCloseTo(200);
  });
});

describe("packCards block shape", () => {
  it("lays the cards in a square block by default, on a desktop as on a phone", () => {
    for (const count of [9, 16, 40]) {
      const items = Array.from({ length: count }, (_, i) => card(`c${i}`));
      const at = packCards(items, { x: 0, y: 0 }, 10);
      const box = boundsOf(items, at)!;
      const xs = new Set([...at.values()].map((p) => p.x));
      expect(xs.size).toBeGreaterThanOrEqual(3);
      const ratio = (box.maxX - box.minX) / (box.maxY - box.minY);
      expect(ratio).toBeGreaterThan(0.6);
      expect(ratio).toBeLessThan(2);
    }
  });

  it("uses a square as the block's shape", () => {
    expect(BLOCK_ASPECT).toBe(1);
  });
});

describe("cardsOverlap", () => {
  it("finds cards lying on each other", () => {
    const items = [card("a"), card("b")];
    expect(cardsOverlap(items, new Map([["a", { x: 0, y: 0 }], ["b", { x: 30, y: 20 }]]))).toBe(true);
  });

  it("lets cards glued side by side touch", () => {
    const items = [card("a"), card("b")];
    expect(cardsOverlap(items, new Map([["a", { x: 0, y: 0 }], ["b", { x: 100, y: 0 }]]))).toBe(false);
    expect(cardsOverlap(items, packCards(items, { x: 0, y: 0 }))).toBe(false);
  });
});
