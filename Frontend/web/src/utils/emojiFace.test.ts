import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_TYPE_EMOJI, loadEmojiFirst, loadTypeEmoji, nodeEmojiFace, saveEmojiFirst, saveTypeEmoji, TYPE_SYMBOL, typeEmojiFor } from "./emojiFace";

describe("emoji first", () => {
  beforeEach(() => localStorage.clear());

  it("is on until the viewer turns it off", () => {
    expect(loadEmojiFirst()).toBe(true);
    saveEmojiFirst(false);
    expect(loadEmojiFirst()).toBe(false);
    saveEmojiFirst(true);
    expect(loadEmojiFirst()).toBe(true);
  });
});

describe("type emoji", () => {
  beforeEach(() => localStorage.clear());

  it("offers an emoji for every type, and the viewer's own over it", () => {
    expect(typeEmojiFor("Solution", {})).toBe(DEFAULT_TYPE_EMOJI.Solution);
    expect(typeEmojiFor("Solution", { Solution: "🌟" })).toBe("🌟");
  });

  it("has no emoji for a type kept on its own symbol", () => {
    expect(typeEmojiFor("Fail", { Fail: TYPE_SYMBOL })).toBeNull();
    saveTypeEmoji({ Fail: TYPE_SYMBOL });
    expect(loadTypeEmoji()).toEqual({ Fail: TYPE_SYMBOL });
  });

  it("keeps the viewer's own, dropping anything that isn't an emoji", () => {
    saveTypeEmoji({ Problem: "🔥" });
    localStorage.setItem("mc_type_emoji", JSON.stringify({ Problem: "🔥", Fail: "abc", Nope: "💡" }));
    expect(loadTypeEmoji()).toEqual({ Problem: "🔥" });
  });
});

describe("nodeEmojiFace", () => {
  it("emoji first: its own emoji, else its type's, face up, turning over when chosen", () => {
    expect(nodeEmojiFace({ type: "Problem", emoji: "😡" }, true, {})).toEqual({ emoji: "😡", emojiUp: true, flips: true });
    expect(nodeEmojiFace({ type: "Problem", emoji: "" }, true, { Problem: "🔥" })).toEqual({ emoji: "🔥", emojiUp: true, flips: true });
  });

  it("emoji first: a type kept on its symbol shows the symbol, still", () => {
    expect(nodeEmojiFace({ type: "Fail" }, true, { Fail: TYPE_SYMBOL })).toEqual({ emoji: null, emojiUp: false, flips: false });
    expect(nodeEmojiFace({ type: "Fail", emoji: "😡" }, true, { Fail: TYPE_SYMBOL })).toEqual({ emoji: "😡", emojiUp: true, flips: true });
  });

  it("emoji first: a template's ghost wears its type's symbol until written in", () => {
    expect(nodeEmojiFace({ type: "Problem", ghost: true, text: "" }, true, {})).toEqual({ emoji: null, emojiUp: false, flips: false });
    expect(nodeEmojiFace({ type: "Problem", ghost: true, text: "Written" }, true, {})).toEqual({ emoji: DEFAULT_TYPE_EMOJI.Problem, emojiUp: true, flips: true });
  });

  it("symbols first: the type's symbol up, and an emoji only when the node has its own", () => {
    expect(nodeEmojiFace({ type: "Problem", emoji: "😡" }, false, {})).toEqual({ emoji: "😡", emojiUp: false, flips: true });
    expect(nodeEmojiFace({ type: "Problem" }, false, {})).toEqual({ emoji: null, emojiUp: false, flips: false });
  });

  it("a template's node shows its type's symbol, not the type's emoji, even in emoji first", () => {
    expect(nodeEmojiFace({ type: "Problem", prompt: "What exactly is the problem?" }, true, {})).toEqual({
      emoji: null,
      emojiUp: false,
      flips: false,
    });
    // Its own emoji, once given one, still shows.
    expect(nodeEmojiFace({ type: "Problem", prompt: "Why?", emoji: "😡" }, true, {}).emoji).toBe("😡");
  });

  it("keeps a picture icon instead of the type's emoji", () => {
    expect(nodeEmojiFace({ type: "Problem", iconImage: "/api/images/x" }, true, {}).emoji).toBeNull();
  });

  it("a still emoji stays face up and never turns, either way", () => {
    for (const first of [true, false]) {
      expect(nodeEmojiFace({ type: "Solution", emoji: "🧭", emojiStill: true }, first, {})).toEqual({
        emoji: "🧭",
        emojiUp: true,
        flips: false,
      });
    }
  });
});
