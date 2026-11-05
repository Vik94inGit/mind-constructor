import { describe, expect, it } from "vitest";
import { MAX_NODE_TEXT, fitPastedText, splitNodeText } from "./nodeText";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

describe("fitPastedText", () => {
  it("leaves a paste that fits to the browser", () => {
    expect(fitPastedText("abc", 3, 3, "def", 10)).toBeNull();
    expect(fitPastedText("abc", 0, 3, "0123456789", 10)).toBeNull();
  });

  it("keeps what fits and hands back the rest, cut between words", () => {
    const fit = fitPastedText("", 0, 0, "one two three four", 10)!;
    expect(fit.text).toBe("one two ");
    expect(fit.text.length).toBeLessThanOrEqual(10);
    expect(fit.caret).toBe(8);
    expect(fit.overflow).toBe("three four");
  });

  it("fits around the text already there and the selection it replaces", () => {
    const fit = fitPastedText("ab|cd", 2, 3, "xx yy zz", 8)!;
    expect(fit.text).toBe("abxx cd");
    expect(fit.caret).toBe(5);
    expect(fit.overflow).toBe("yy zz");
  });

  it("cuts mid-word when there's no break to cut at", () => {
    const fit = fitPastedText("", 0, 0, "a".repeat(15), 10)!;
    expect(fit.text).toBe("a".repeat(10));
    expect(fit.overflow).toBe("a".repeat(5));
  });

  it("offers everything when the field is already full", () => {
    const full = "x".repeat(10);
    const fit = fitPastedText(full, 10, 10, "more", 10)!;
    expect(fit.text).toBe(full);
    expect(fit.overflow).toBe("more");
  });

  it("prefers a line end over a space", () => {
    const fit = fitPastedText("", 0, 0, "first line\nsecond one here", 20)!;
    expect(fit.text).toBe("first line\n");
    expect(fit.overflow).toBe("second one here");
  });

  it("uses the node limit by default", () => {
    const fit = fitPastedText("", 0, 0, words(400))!;
    expect(fit.text.length).toBeLessThanOrEqual(MAX_NODE_TEXT);
    expect(fit.text.trim().split(" ").concat(fit.overflow.split(" "))).toEqual(words(400).split(" "));
  });
});

describe("splitNodeText", () => {
  it("splits a long text into pieces that each fit, without losing a word", () => {
    const text = words(700);
    const pieces = splitNodeText(text);
    expect(pieces.length).toBeGreaterThan(1);
    for (const p of pieces) expect(p.length).toBeLessThanOrEqual(MAX_NODE_TEXT);
    expect(pieces.join(" ")).toBe(text);
  });

  it("keeps a short text whole", () => {
    expect(splitNodeText("  hello  ")).toEqual(["hello"]);
    expect(splitNodeText("   ")).toEqual([]);
  });
});
