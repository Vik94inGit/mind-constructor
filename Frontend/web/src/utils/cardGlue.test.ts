import { describe, expect, it } from "vitest";
import { clearOfCards, connectedPieces, findSnap } from "./cardGlue";
import type { CardBox } from "./cardGlue";

const card = (id: string, x: number, y: number, w = 100, h = 40): CardBox => ({ id, x, y, w, h });

describe("findSnap", () => {
  it("glues a card flush against the nearest side of another", () => {
    const other = card("b", 300, 100);
    expect(findSnap(card("a", 190, 110), [other], 40)).toEqual({ x: 200, y: 100, partnerId: "b", from: "b", to: "a" });
  });

  it("glues onto any side, top and bottom too", () => {
    const other = card("b", 100, 100);
    expect(findSnap(card("a", 105, 150), [other], 40)).toMatchObject({ x: 100, y: 140 });
    expect(findSnap(card("a", 95, 55), [other], 40)).toMatchObject({ x: 100, y: 60 });
  });

  it("ignores cards out of reach", () => {
    expect(findSnap(card("a", 100, 100), [card("b", 400, 100)], 40)).toBeNull();
  });
});

describe("clearOfCards", () => {
  it("keeps a spot that covers nothing", () => {
    expect(clearOfCards(card("a", 100, 100), [card("b", 400, 100)])).toEqual({ x: 100, y: 100 });
  });

  it("pushes a card off the one it landed on, the shortest way out", () => {
    // Landed mostly past b's right edge: out to its right.
    expect(clearOfCards(card("a", 380, 100), [card("b", 300, 100)])).toEqual({ x: 400, y: 100 });
    // Landed a little below b: out below it.
    expect(clearOfCards(card("a", 300, 120), [card("b", 300, 100)])).toEqual({ x: 300, y: 140 });
  });

  it("is pushed on again when the first way out lands on a neighbour", () => {
    const b = card("b", 300, 100);
    const c = card("c", 400, 100);
    const at = clearOfCards(card("a", 330, 100), [b, c]);
    for (const o of [b, c]) {
      const apart = Math.abs(at.x - o.x) >= 100 - 0.5 || Math.abs(at.y - o.y) >= 40 - 0.5;
      expect(apart).toBe(true);
    }
  });

  it("lets touching edges be — a glued card isn't an overlap", () => {
    expect(clearOfCards(card("a", 200, 100), [card("b", 300, 100)])).toEqual({ x: 200, y: 100 });
  });
});

describe("connectedPieces", () => {
  const all = () => true;

  it("gathers a whole glued block, through cards in between", () => {
    const cards = [card("a", 100, 100), card("b", 200, 100), card("c", 200, 140), card("d", 600, 600)];
    expect(connectedPieces("a", cards, all, 2)).toEqual(["a", "b", "c"]);
  });

  it("leaves out cards that are linked but apart, or flush but not linked", () => {
    const cards = [card("a", 100, 100), card("b", 230, 100), card("c", 100, 140)];
    const linked = (x: string, y: string) => [x, y].sort().join() !== "a,c";
    expect(connectedPieces("a", cards, linked, 2)).toEqual(["a"]);
  });

  it("doesn't count cards that only meet at a corner", () => {
    expect(connectedPieces("a", [card("a", 100, 100), card("b", 200, 140)], all, 2)).toEqual(["a"]);
  });
});
