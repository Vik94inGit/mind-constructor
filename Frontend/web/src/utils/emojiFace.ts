import type { NodeDoc, NodeType } from "../types";

// Node emoji: a node's icon is a two-sided card (map/NodeFlipIcon.tsx) — an
// emoji on one face, the type's own symbol (Problem, Solution, …) on the
// other. Which face is up is a per-viewer preference, kept in this browser
// and on the server (see useMapViewerPrefs), like the compact view:
//  - true ("emoji first", the default): every node shows an emoji face up —
//    its own (NodeDoc.emoji), or else its type's (typeEmojiFor) — with the
//    type's symbol on the back;
//  - false ("symbols first"): the type's symbol up, and only a node with its
//    own emoji carries one, on the back.
// A node with a picture icon (NodeDoc.iconImage) and no emoji of its own
// keeps the picture. A node whose owner set its emoji still (NodeDoc.emojiStill) shows its own
// emoji face up either way, and never turns over.

const STORAGE_KEY = "mc_emoji_first";
const TYPE_EMOJI_KEY = "mc_type_emoji";

export function loadEmojiFirst(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveEmojiFirst(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}

/** The emoji each type wears until the viewer picks their own (TypeEmoji). */
export const DEFAULT_TYPE_EMOJI: Record<NodeType, string> = {
  Problem: "❗",
  "Problematic option": "⚠️",
  Solution: "💡",
  Option: "🔀",
  Success: "✅",
  Fail: "❌",
  unknown: "❓",
};

/** The viewer's own emoji for some of the types, over DEFAULT_TYPE_EMOJI. */
export type TypeEmoji = Partial<Record<NodeType, string>>;

export function typeEmojiFor(type: NodeType, custom: TypeEmoji): string {
  return custom[type] || DEFAULT_TYPE_EMOJI[type];
}

export function loadTypeEmoji(): TypeEmoji {
  try {
    const raw = localStorage.getItem(TYPE_EMOJI_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: TypeEmoji = {};
    for (const type of Object.keys(DEFAULT_TYPE_EMOJI) as NodeType[]) {
      const v = parsed[type];
      if (typeof v === "string" && v.trim() && isValidEmoji(v)) out[type] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

export function saveTypeEmoji(custom: TypeEmoji): void {
  try {
    if (Object.keys(custom).length === 0) localStorage.removeItem(TYPE_EMOJI_KEY);
    else localStorage.setItem(TYPE_EMOJI_KEY, JSON.stringify(custom));
  } catch {
    // best-effort — the choice just won't survive a reload
  }
}

/**
 * How a node's icon reads for this viewer: the emoji it shows (none: just
 * the type's symbol), whether that emoji is face up, and whether the card
 * turns over when the node is chosen.
 */
export function nodeEmojiFace(
  node: Pick<NodeDoc, "type" | "emoji" | "emojiStill" | "iconImage">,
  emojiFirst: boolean,
  custom: TypeEmoji,
): { emoji: string | null; emojiUp: boolean; flips: boolean } {
  const own = node.emoji?.trim() || "";
  if (own && node.emojiStill) return { emoji: own, emojiUp: true, flips: false };
  // A picture icon is the node's own face already — no type emoji over it.
  if (emojiFirst && (own || !node.iconImage)) return { emoji: own || typeEmojiFor(node.type, custom), emojiUp: true, flips: true };
  return own ? { emoji: own, emojiUp: false, flips: true } : { emoji: null, emojiUp: false, flips: false };
}

/** The quick picks NodePanel offers — any other emoji can be typed in. */
export const EMOJI_CHOICES = [
  "💡", "❓", "❗", "⚠️", "🔥", "🎯", "✅", "❌",
  "👍", "👎", "🤔", "😊", "😟", "😡", "🚀", "🐞",
  "💰", "⏰", "📌", "📈", "📉", "🔒", "🧩", "🛠️",
  "❤️", "⭐", "🌱", "🏁", "📚", "👥", "🧠", "🙏",
];

/** Mirrors the backend's emojiSchema: empty, or no letters/digits, at most 32 characters. */
export function isValidEmoji(value: string): boolean {
  const v = value.trim();
  return v === "" || (v.length <= 32 && !/[\p{L}\p{N}]/u.test(v));
}
