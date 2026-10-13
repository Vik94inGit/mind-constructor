import { ROOT_ID, emptyDraft } from "./thoughtFlow";
import type { ThoughtDraft } from "./thoughtFlow";
import type { NodeType } from "../types";

// "Text → map" (pages/SplitTextPage.tsx): a whole text becomes the map's main
// node, and each piece of it the user marks (tapping the word it starts on,
// then the word it ends on) and gives a type becomes a node hanging from it. Pieces are character ranges into the
// text; they never overlap, so every character belongs to at most one.

export interface TextPiece {
  id: string;
  /** [start, end) into the text. */
  start: number;
  end: number;
  type: NodeType;
  /**
   * What it hangs from: another piece's id (that piece becomes a parent), or
   * — on a map (map/TextToNodesModal.tsx) — a node already there. Absent: the
   * main node.
   */
  parentId?: string;
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

/** Whether `id` hangs, directly or further down, from `ancestorId` (through other pieces). */
function hangsFrom(pieces: TextPiece[], id: string, ancestorId: string): boolean {
  const byId = new Map(pieces.map((p) => [p.id, p]));
  const seen = new Set<string>();
  let cur = byId.get(id)?.parentId;
  while (cur && !seen.has(cur)) {
    if (cur === ancestorId) return true;
    seen.add(cur);
    cur = byId.get(cur)?.parentId;
  }
  return false;
}

/** The pieces `id` can hang from: every other one that doesn't already hang from it. */
export function parentCandidates(pieces: TextPiece[], id: string): TextPiece[] {
  return pieces.filter((p) => p.id !== id && !hangsFrom(pieces, p.id, id));
}

function withParent(piece: TextPiece, parentId: string | undefined): TextPiece {
  const { parentId: _old, ...rest } = piece;
  return parentId ? { ...rest, parentId } : rest;
}

/** `id` hung from `parentId` (undefined: the main node); unchanged when that would make a loop. */
export function setPieceParent(pieces: TextPiece[], id: string, parentId: string | undefined): TextPiece[] {
  if (parentId && (parentId === id || hangsFrom(pieces, parentId, id))) return pieces;
  return pieces.map((p) => (p.id === id ? withParent(p, parentId) : p));
}

/** `pieces` without `id`; the ones that hung from it go up to whatever it hung from. */
export function removePiece(pieces: TextPiece[], id: string): TextPiece[] {
  const gone = pieces.find((p) => p.id === id);
  return pieces.filter((p) => p.id !== id).map((p) => (p.parentId === id ? withParent(p, gone?.parentId) : p));
}

/** Parents before the pieces that hang from them (otherwise text order). */
export function piecesParentsFirst<T extends { id: string; parentId?: string }>(pieces: T[]): T[] {
  const ids = new Set(pieces.map((p) => p.id));
  const out: T[] = [];
  const placed = new Set<string>();
  const visit = (p: T, trail: Set<string>) => {
    if (placed.has(p.id) || trail.has(p.id)) return;
    trail.add(p.id);
    const parent = p.parentId && ids.has(p.parentId) ? pieces.find((x) => x.id === p.parentId) : undefined;
    if (parent) visit(parent, trail);
    placed.add(p.id);
    out.push(p);
  };
  for (const p of pieces) visit(p, new Set());
  return out;
}

/** Every word of the text (a run of non-whitespace) as a [start, end) range — what a tap marks a piece's start or finish on. */
export function wordRanges(text: string): { start: number; end: number }[] {
  return [...text.matchAll(/\S+/g)].map((m) => ({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
}

/** The piece from one tapped word to another, whichever order they were tapped in, both words included. */
export function spanBetween(a: { start: number; end: number }, b: { start: number; end: number }): { start: number; end: number } {
  return { start: Math.min(a.start, b.start), end: Math.max(a.end, b.end) };
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
      parentId: p.parentId && draft.pieces.some((x) => x.id === p.parentId) ? p.parentId : ROOT_ID,
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
