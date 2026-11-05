import type { ClipboardEvent } from "react";

/** The most a node's text can hold when typed in — the inline inputs, the pending card and the panel's text box. */
export const MAX_NODE_TEXT = 1000;

// How far back from a cut a break (a space or a line end) is looked for, so a
// word isn't torn in half between a node and the one carrying on from it.
const BREAK_LOOKBACK = 120;

/** Where to cut `text` so the first part holds at most `max` characters: after a line end, then a sentence, then a space, else right at `max`. */
function cutPoint(text: string, max: number): number {
  if (text.length <= max) return text.length;
  // Already at a break: the first part ends right where a word does.
  if (max > 0 && /\s/.test(text[max])) return max;
  const from = Math.max(0, max - BREAK_LOOKBACK);
  const window = text.slice(from, max + 1);
  for (const pattern of [/\n/g, /[.!?…]\s/g, /\s/g]) {
    let best = -1;
    for (const m of window.matchAll(pattern)) {
      // The cut goes after the break; past `max` it would hold one too many.
      const end = from + m.index! + m[0].length;
      if (end <= max) best = end;
    }
    // A cut at 0 would leave nothing in the first part.
    if (best > 0) return best;
  }
  return max;
}

/**
 * Text pasted into a node's field that doesn't all fit: what the field holds
 * after the paste (the paste cut at a break, so a word isn't torn), where the
 * caret goes, and the rest — to be offered for a new node rather than lost the
 * way a field's maxLength silently drops it. Null when everything fits.
 */
export function fitPastedText(
  value: string,
  selStart: number,
  selEnd: number,
  pasted: string,
  max = MAX_NODE_TEXT,
): { text: string; caret: number; overflow: string } | null {
  const before = value.slice(0, selStart);
  const after = value.slice(selEnd);
  if (before.length + pasted.length + after.length <= max) return null;
  const room = Math.max(0, max - before.length - after.length);
  const cut = pasted.length <= room ? pasted.length : cutPoint(pasted, room);
  const kept = pasted.slice(0, cut);
  const overflow = pasted.slice(cut).trim();
  if (!overflow) return null;
  return { text: before + kept + after, caret: before.length + kept.length, overflow };
}

/** `text` in pieces of at most `max` characters, each cut at a break where there is one — the nodes a long text carries on into. */
export function splitNodeText(text: string, max = MAX_NODE_TEXT): string[] {
  const pieces: string[] = [];
  let rest = text.trim();
  while (rest) {
    const cut = cutPoint(rest, max);
    const piece = rest.slice(0, cut).trim();
    if (piece) pieces.push(piece);
    rest = rest.slice(cut).trim();
  }
  return pieces;
}

/**
 * A text field's onPaste: when the paste would go past `max`, it puts in what
 * fits (a field's own maxLength would cut it silently, a tablet's paste
 * bubble included) and hands the rest to `onOverflow`. A paste that fits is
 * left to the browser.
 */
export function pasteKeepingOverflow(
  e: ClipboardEvent<HTMLTextAreaElement>,
  setValue: (text: string) => void,
  onOverflow: (rest: string) => void,
  max = MAX_NODE_TEXT,
) {
  let pasted = "";
  try {
    pasted = e.clipboardData?.getData("text/plain") ?? "";
  } catch {
    return;
  }
  if (!pasted) return;
  const el = e.currentTarget;
  const fit = fitPastedText(el.value, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, pasted, max);
  if (!fit) return;
  e.preventDefault();
  setValue(fit.text);
  onOverflow(fit.overflow);
  // The caret after what was put in, once React has drawn the new text.
  requestAnimationFrame(() => {
    if (document.activeElement === el) el.setSelectionRange(fit.caret, fit.caret);
  });
}
