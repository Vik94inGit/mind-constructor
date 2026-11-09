// Formulas in a node's text. Text copied from ChatGPT, Wikipedia, Overleaf,
// lecture notes and the like carries its maths as LaTeX between markers; this
// finds those pieces so they can be drawn as real formulas (map/MathText.tsx,
// with KaTeX loaded only when a text has one). The stored text stays plain, so
// search, export and the length cap see exactly what was typed or pasted.
//
// Recognized, in this order:
//   $$…$$  and  \[…\]                 a formula on its own line
//   \(…\)                             a formula inside a sentence
//   {\displaystyle …}                 what a copy from Wikipedia leaves
//   $…$                               inside a sentence, but only when it
//                                     can't be money: no space just inside
//                                     either $, and no digit right after the
//                                     closing one ("$5 and $10" stays text)

export type MathPiece =
  | { kind: "text"; value: string }
  | { kind: "math"; tex: string; display: boolean };

/** True when `text` holds at least one formula — the cheap check that decides whether KaTeX is needed at all. */
export function hasMath(text: string | undefined | null): boolean {
  if (!text) return false;
  if (!/[$\\]/.test(text)) return false;
  return splitMath(text).some((p) => p.kind === "math");
}

// Where a {\displaystyle …} group ends: its braces counted, so nested groups
// ({x^{2}}) don't end it early. -1 when it never closes.
function closingBrace(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") {
      i++; // an escaped brace (\{) doesn't count
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// A backslash before `i` that escapes it (\$ is a literal dollar sign).
function escaped(text: string, i: number): boolean {
  let n = 0;
  for (let j = i - 1; j >= 0 && text[j] === "\\"; j--) n++;
  return n % 2 === 1;
}

/** Where the single-$ formula that opens at `open` closes, or -1 when that $ isn't a formula. */
function inlineDollarEnd(text: string, open: number): number {
  const first = text[open + 1];
  if (first === undefined || /\s/.test(first) || first === "$") return -1;
  for (let i = open + 1; i < text.length; i++) {
    const c = text[i];
    if (c === "\n" && text[i + 1] === "\n") return -1; // a formula doesn't run across paragraphs
    if (c !== "$" || escaped(text, i)) continue;
    if (/\s/.test(text[i - 1])) return -1;
    if (/\d/.test(text[i + 1] ?? "")) return -1;
    return i;
  }
  return -1;
}

/** `text` cut into plain pieces and formulas, in order. Text with no formula comes back as one plain piece. */
export function splitMath(text: string): MathPiece[] {
  const pieces: MathPiece[] = [];
  let plain = "";
  const pushMath = (tex: string, display: boolean) => {
    const trimmed = tex.trim();
    if (!trimmed) return false;
    if (plain) pieces.push({ kind: "text", value: plain });
    plain = "";
    pieces.push({ kind: "math", tex: trimmed, display });
    return true;
  };

  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "\\" && (text[i + 1] === "[" || text[i + 1] === "(")) {
      const close = text[i + 1] === "[" ? "\\]" : "\\)";
      const end = text.indexOf(close, i + 2);
      if (end !== -1 && pushMath(text.slice(i + 2, end), text[i + 1] === "[")) {
        i = end + 2;
        continue;
      }
    } else if (c === "{" && text.startsWith("{\\displaystyle", i)) {
      const end = closingBrace(text, i);
      if (end !== -1 && pushMath(text.slice(i + "{\\displaystyle".length, end), false)) {
        i = end + 1;
        continue;
      }
    } else if (c === "$" && !escaped(text, i)) {
      if (text[i + 1] === "$") {
        const end = text.indexOf("$$", i + 2);
        if (end !== -1 && pushMath(text.slice(i + 2, end), true)) {
          i = end + 2;
          continue;
        }
      } else {
        const end = inlineDollarEnd(text, i);
        if (end !== -1 && pushMath(text.slice(i + 1, end), false)) {
          i = end + 1;
          continue;
        }
      }
    }
    plain += c;
    i++;
  }
  if (plain || pieces.length === 0) pieces.push({ kind: "text", value: plain });
  return pieces;
}
