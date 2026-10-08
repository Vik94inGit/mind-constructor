// Node emoji (NodeDoc.emoji): a node with one draws its icon as a two-sided
// card (map/NodeFlipIcon.tsx) — the emoji on one face, the type's own symbol
// (Problem, Solution, …) on the other. Which face is up by default is a
// per-viewer preference kept in this browser, like the compact view:
//  - false (default): the type's symbol up, the emoji on the back;
//  - true ("emoji first"): the emoji up, the type on the back.

const STORAGE_KEY = "mc_emoji_first";

export function loadEmojiFirst(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveEmojiFirst(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // best-effort — the choice just won't survive a reload
  }
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
