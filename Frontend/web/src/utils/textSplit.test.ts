import { describe, expect, it } from "vitest";
import {
  addPiece,
  autoPieces,
  parentCandidates,
  piecesParentsFirst,
  removePiece,
  setPieceParent,
  spanBetween,
  splitToThoughtDraft,
  textSegments,
  trimRange,
  wordRanges,
} from "./textSplit";
import type { TextPiece } from "./textSplit";

const piece = (id: string, start: number, end: number): TextPiece => ({ id, start, end, type: "Option" });

describe("trimRange", () => {
  it("drops whitespace at both ends and orders a backwards selection", () => {
    expect(trimRange("  hello world ", 13, 0)).toEqual({ start: 2, end: 13 });
  });

  it("is null for a whitespace-only selection", () => {
    expect(trimRange("a   b", 1, 4)).toBeNull();
  });
});

describe("addPiece", () => {
  it("keeps pieces in text order", () => {
    const out = addPiece([piece("b", 10, 12)], piece("a", 0, 3));
    expect(out?.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("refuses a piece overlapping another, but allows one touching it", () => {
    expect(addPiece([piece("a", 0, 5)], piece("b", 4, 8))).toBeNull();
    expect(addPiece([piece("a", 0, 5)], piece("b", 5, 8))).not.toBeNull();
  });
});

describe("textSegments", () => {
  it("cuts the text into plain runs and pieces", () => {
    expect(textSegments("abcdefgh", [piece("x", 5, 7), piece("y", 2, 4)])).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4, piece: piece("y", 2, 4) },
      { start: 4, end: 5 },
      { start: 5, end: 7, piece: piece("x", 5, 7) },
      { start: 7, end: 8 },
    ]);
  });
});

describe("splitToThoughtDraft", () => {
  it("puts the whole text in the middle and hangs each piece from it", () => {
    const draft = splitToThoughtDraft({
      name: "",
      text: " Too slow. Buy a faster laptop. ",
      rootType: "Problem",
      pieces: [{ id: "p1", start: 11, end: 31, type: "Option" }],
      step: 1,
    });
    expect(draft.center).toBe("Too slow. Buy a faster laptop.");
    expect(draft.thoughts).toEqual([
      { id: "p1", text: "Buy a faster laptop.", type: "Option", parentId: "root", prompt: "anythingElse" },
    ]);
  });
});

describe("autoPieces", () => {
  let n = 0;
  const id = () => `a${++n}`;
  const text = "First line.\n\n  Second one!  \nThird? And more.";
  const slices = (pieces: TextPiece[]) => pieces.map((p) => text.slice(p.start, p.end));

  it("makes one piece per non-empty line, trimmed", () => {
    expect(slices(autoPieces(text, [], "lines", "unknown", id))).toEqual(["First line.", "Second one!", "Third? And more."]);
  });

  it("makes one piece per sentence", () => {
    expect(slices(autoPieces(text, [], "sentences", "Option", id))).toEqual([
      "First line.",
      "Second one!",
      "Third?",
      "And more.",
    ]);
  });

  it("keeps pieces already marked and skips what would overlap them", () => {
    const existing = [piece("x", 0, 5)];
    const out = autoPieces(text, existing, "lines", "unknown", id);
    expect(out[0]).toBe(existing[0]);
    expect(slices(out)).toEqual(["First", "Second one!", "Third? And more."]);
  });
});

describe("wordRanges / spanBetween", () => {
  it("finds each word and spans from one tapped word to another in either order", () => {
    const words = wordRanges(" ab  cd\nef");
    expect(words).toEqual([
      { start: 1, end: 3 },
      { start: 5, end: 7 },
      { start: 8, end: 10 },
    ]);
    expect(spanBetween(words[2], words[0])).toEqual({ start: 1, end: 10 });
    expect(spanBetween(words[1], words[1])).toEqual({ start: 5, end: 7 });
  });
});

describe("piece parents", () => {
  const three = [piece("a", 0, 1), piece("b", 2, 3), piece("c", 4, 5)];

  it("hangs a piece from another, and refuses a loop", () => {
    const hung = setPieceParent(three, "b", "a");
    expect(hung.find((p) => p.id === "b")?.parentId).toBe("a");
    // a can't hang from b now: b already hangs from a.
    expect(setPieceParent(hung, "a", "b")).toBe(hung);
    expect(parentCandidates(hung, "a").map((p) => p.id)).toEqual(["c"]);
    // Back to the main node.
    expect(setPieceParent(hung, "b", undefined).find((p) => p.id === "b")).not.toHaveProperty("parentId");
  });

  it("moves a removed piece's children up to its own parent", () => {
    const chain = setPieceParent(setPieceParent(three, "b", "a"), "c", "b");
    const out = removePiece(chain, "b");
    expect(out.map((p) => p.id)).toEqual(["a", "c"]);
    expect(out.find((p) => p.id === "c")?.parentId).toBe("a");
  });

  it("orders parents before the pieces hanging from them", () => {
    const pieces = [{ id: "c", parentId: "b" }, { id: "b", parentId: "a" }, { id: "a" }, { id: "d", parentId: "map-node" }];
    expect(piecesParentsFirst(pieces).map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("keeps a piece's parent in the map draft", () => {
    const pieces = setPieceParent([piece("a", 0, 5), piece("b", 6, 11)], "b", "a");
    const draft = splitToThoughtDraft({ name: "", text: "hello world", rootType: "Problem", pieces, step: 1 });
    expect(draft.thoughts.map((t) => t.parentId)).toEqual(["root", "a"]);
  });
});
