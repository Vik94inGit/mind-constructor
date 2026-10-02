import { describe, expect, it } from "vitest";
import { findSnap } from "./puzzleSnap";
import type { SnapPiece } from "./puzzleSnap";

const piece = (id: string, x: number, y: number, edges: SnapPiece["edges"]): SnapPiece => ({
  id,
  x,
  y,
  w: 100,
  h: 40,
  edges,
});

describe("findSnap", () => {
  it("pulls a tab flush into a facing blank", () => {
    const other = piece("b", 300, 100, [1, 1, 1, -1]); // blank on its left
    const dragged = piece("a", 190, 110, [-1, 1, -1, -1]); // tab on its right
    expect(findSnap(dragged, [other], 40)).toEqual({ x: 200, y: 100, partnerId: "b", from: "a", to: "b" });
  });

  it("fits a blank over a tab too, linking from the tab's piece", () => {
    const other = piece("b", 100, 100, [1, 1, 1, 1]); // tab on its bottom
    const dragged = piece("a", 105, 150, [-1, 1, 1, 1]); // blank on its top
    expect(findSnap(dragged, [other], 40)).toEqual({ x: 100, y: 140, partnerId: "b", from: "b", to: "a" });
  });

  it("ignores two tabs facing each other, and pieces out of reach", () => {
    const other = piece("b", 300, 100, [1, 1, 1, 1]);
    expect(findSnap(piece("a", 200, 100, [1, 1, 1, 1]), [other], 40)).toBeNull();
    expect(findSnap(piece("a", 100, 100, [-1, 1, -1, -1]), [piece("b", 300, 100, [1, 1, 1, -1])], 40)).toBeNull();
  });
});
