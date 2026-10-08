import { describe, expect, it } from "vitest";
import { addPiece, autoPieces, splitToThoughtDraft, textSegments, trimRange } from "./textSplit";
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
