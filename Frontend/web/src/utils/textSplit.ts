import { ROOT_ID, emptyDraft } from "./thoughtFlow";
import type { ThoughtDraft } from "./thoughtFlow";
import type { NodeType } from "../types";

// "Text → map" (pages/SplitTextPage.tsx): a whole text becomes the map's main
// node, and each piece of it the user selects with the cursor and gives a
// type becomes a node hanging from it. Pieces are character ranges into the
// text; they never overlap, so every character belongs to at most one.

export interface TextPiece {
  id: string;
  /** [start, end) into the text. */
  start: number;
  end: number;
  type: NodeType;
}

export interface SplitDraft {
  name: string;
  text: string;
  rootType: NodeType;
  pieces: TextPiece[];
  /** 0: writing the text, 1: marking pieces. */
  step: 0 | 1;
}

export function emptySplitDraft(): SplitDraft {
  return { name: "", text: "", rootType: "Problem", pieces: [], step: 0 };
}

/** A selected range with the whitespace at either end left out; null when nothing but whitespace is left. */
export function trimRange(text: string, start: number, end: number): { start: number; end: number } | null {
  let s = Math.max(0, Math.min(start, end));
  let e = Math.min(text.length, Math.max(start, end));
  while (s < e && /\s/.test(text[s])) s++;
  while (e > s && /\s/.test(text[e - 1])) e--;
  return s < e ? { start: s, end: e } : null;
}

export function overlapsPiece(pieces: TextPiece[], start: number, end: number): boolean {
  return pieces.some((p) => start < p.end && p.start < end);
}

/** `pieces` with `piece` added, in text order; null when it would overlap one already there. */
export function addPiece(pieces: TextPiece[], piece: TextPiece): TextPiece[] | null {
  if (overlapsPiece(pieces, piece.start, piece.end)) return null;
  return [...pieces, piece].sort((a, b) => a.start - b.start);
}

/** The text cut into runs, each either one piece or the plain text between pieces. */
export function textSegments(text: string, pieces: TextPiece[]): { start: number; end: number; piece?: TextPiece }[] {
  const out: { start: number; end: number; piece?: TextPiece }[] = [];
  let at = 0;
  for (const piece of [...pieces].sort((a, b) => a.start - b.start)) {
    if (piece.start > at) out.push({ start: at, end: piece.start });
    out.push({ start: piece.start, end: piece.end, piece });
    at = piece.end;
  }
  if (at < text.length) out.push({ start: at, end: text.length });
  return out;
}

/** The draft the "Think it through" builder makes a map from: the whole text in the middle, each piece hanging from it. */
export function splitToThoughtDraft(draft: SplitDraft): ThoughtDraft {
  return {
    ...emptyDraft("problem", draft.text.trim()),
    thoughts: draft.pieces.map((p) => ({
      id: p.id,
      text: draft.text.slice(p.start, p.end),
      type: p.type,
      parentId: ROOT_ID,
      prompt: "anythingElse",
    })),
  };
}

// Kept in this browser until the map is made, like the Think flow's draft.
const storageKey = (userId: string) => `mc_text_split:${userId}`;

/** A draft read back from storage or the server, or null when it isn't one. */
export function parseSplitDraft(data: unknown): SplitDraft | null {
  const d = data as SplitDraft | null;
  if (!d || typeof d.text !== "string" || !Array.isArray(d.pieces)) return null;
  return { ...emptySplitDraft(), ...d };
}

export function loadSplitDraft(userId: string): SplitDraft | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? parseSplitDraft(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveSplitDraft(userId: string, draft: SplitDraft) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(draft));
  } catch {
    // best-effort
  }
}

export function clearSplitDraft(userId: string) {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // best-effort
  }
}

/**
 * Pieces cut out of `text` automatically — one per non-empty line, or one per
 * sentence — skipping any that would overlap a piece already there. Ranges
 * leave out surrounding whitespace, same as a hand-made selection.
 */
export function autoPieces(
  text: string,
  existing: TextPiece[],
  by: "lines" | "sentences",
  type: NodeType,
  newId: () => string,
): TextPiece[] {
  const pattern = by === "lines" ? /[^\n]+/g : /[^.!?…\n]+(?:[.!?…]+|$)/gm;
  let pieces = existing;
  for (const m of text.matchAll(pattern)) {
    const range = trimRange(text, m.index ?? 0, (m.index ?? 0) + m[0].length);
    if (!range) continue;
    pieces = addPiece(pieces, { id: newId(), ...range, type }) ?? pieces;
  }
  return pieces;
}
