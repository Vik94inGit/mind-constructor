import { describe, expect, it } from "vitest";
import { connectedPieces, findSnap } from "./puzzleSnap";
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

describe("connectedPieces", () => {
  const e: SnapPiece["edges"] = [1, 1, -1, -1];
  const all = () => true;

  it("gathers a whole assembled puzzle, through pieces in between", () => {
    // a | b side by side, c stacked under b, d off on its own.
    const pieces = [piece("a", 100, 100, e), piece("b", 200, 100, e), piece("c", 200, 140, e), piece("d", 600, 600, e)];
    expect(connectedPieces("a", pieces, all, 2)).toEqual(["a", "b", "c"]);
  });

  it("leaves out pieces that are linked but apart, or flush but not linked", () => {
    const pieces = [piece("a", 100, 100, e), piece("b", 230, 100, e), piece("c", 100, 140, e)];
    const linked = (x: string, y: string) => [x, y].sort().join() !== "a,c";
    expect(connectedPieces("a", pieces, linked, 2)).toEqual(["a"]);
  });

  it("doesn't count pieces that only meet at a corner", () => {
    const pieces = [piece("a", 100, 100, e), piece("b", 200, 140, e)];
    expect(connectedPieces("a", pieces, all, 2)).toEqual(["a"]);
  });
});
