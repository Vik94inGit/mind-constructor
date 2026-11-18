// "Copy" on a node's panel: the node's own text, the whole zone it heads (or
// sits in), or the tree above it — the chain of parents from the top of its
// branch down to it. Formulas copy as text a person can read anywhere
// (x² + y², (a)/(b), √(x)) instead of raw LaTeX, which most places a copy is
// pasted into won't draw.
import { splitMath } from "./mathText";
import { nodeRefId } from "./nodeType";
import { stepPrefix } from "./textExport";
import type { NodeGroup } from "./canvasLayout";
import type { NodeDoc } from "../types";

export type CopyScope = "node" | "zone" | "above";

const SYMBOLS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η",
  theta: "θ", vartheta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π",
  rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ", phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  cdot: "·", times: "×", div: "÷", pm: "±", mp: "∓", le: "≤", leq: "≤", ge: "≥", geq: "≥", neq: "≠", ne: "≠",
  approx: "≈", equiv: "≡", sim: "~", propto: "∝", infty: "∞", sum: "∑", prod: "∏", int: "∫", oint: "∮",
  partial: "∂", nabla: "∇", to: "→", rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", Leftarrow: "⇐",
  leftrightarrow: "↔", Leftrightarrow: "⇔", implies: "⇒", iff: "⇔", in: "∈", notin: "∉", subset: "⊂",
  subseteq: "⊆", supset: "⊃", cup: "∪", cap: "∩", emptyset: "∅", forall: "∀", exists: "∃", neg: "¬",
  land: "∧", lor: "∨", cdots: "⋯", ldots: "…", dots: "…", circ: "∘", degree: "°", angle: "∠",
  perp: "⊥", parallel: "∥", ell: "ℓ", hbar: "ħ", star: "⋆", prime: "′", lbrace: "{", rbrace: "}",
  langle: "⟨", rangle: "⟩", lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉", vert: "|", mid: "|",
  "{": "{", "}": "}", "%": "%", "$": "$", "&": "&", "#": "#", "_": "_",
  ",": " ", ";": " ", ":": " ", "!": "", " ": " ", quad: " ", qquad: "  ",
  // Named functions read as their own name.
  sin: "sin", cos: "cos", tan: "tan", cot: "cot", log: "log", ln: "ln", exp: "exp", lim: "lim",
  max: "max", min: "min", det: "det", arcsin: "arcsin", arccos: "arccos", arctan: "arctan",
};

// Dropped: they only size or style what follows.
const IGNORED = new Set(["left", "right", "big", "Big", "bigg", "Bigg", "displaystyle", "textstyle", "limits", "nolimits"]);
// Their argument is kept as it is.
const WRAPPERS = new Set(["text", "mathrm", "mathbf", "mathit", "mathsf", "mathtt", "mathcal", "mathbb", "operatorname", "textbf", "textit", "boldsymbol", "bm", "vec", "hat", "bar", "overline", "underline", "tilde", "dot"]);

const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ",
};
const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", o: "ₒ", x: "ₓ", i: "ᵢ", j: "ⱼ",
  k: "ₖ", n: "ₙ", m: "ₘ", p: "ₚ", s: "ₛ", t: "ₜ",
};

// `s` written with small raised (or lowered) characters when every one has
// one, else `^(s)` / `_(s)`.
function script(s: string, table: Record<string, string>, mark: string): string {
  const chars = Array.from(s);
  if (chars.length > 0 && chars.every((c) => table[c])) return chars.map((c) => table[c]).join("");
  return chars.length === 1 ? `${mark}${s}` : `${mark}(${s})`;
}

// True when `s` is one bracketed group, maybe after a root sign: "(a+b)", "√(x)" — not "(a)+(b)".
function oneGroup(s: string): boolean {
  const body = s.replace(/^[√∛∜]/, "");
  if (!body.startsWith("(") || !body.endsWith(")")) return false;
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "(") depth++;
    else if (body[i] === ")" && --depth === 0 && i < body.length - 1) return false;
  }
  return true;
}

// A fraction's part keeps its own brackets only when it needs them.
const wrap = (s: string) => (/^[\p{L}\p{N}.]+$/u.test(s) || oneGroup(s) ? s : `(${s})`);

/** One formula's LaTeX as plain readable text: x^{2} → x², \frac{a+b}{2} → (a+b)/2, \sqrt{x} → √x. */
export function texToText(tex: string): string {
  let i = 0;
  // The text of one argument: a {group}, a \command or a single character.
  function readArg(): string {
    while (tex[i] === " ") i++;
    if (tex[i] === "{") {
      let depth = 0;
      const start = i;
      for (; i < tex.length; i++) {
        if (tex[i] === "\\") {
          i++;
          continue;
        }
        if (tex[i] === "{") depth++;
        else if (tex[i] === "}" && --depth === 0) break;
      }
      const inner = tex.slice(start + 1, i);
      i++;
      return texToText(inner);
    }
    if (tex[i] === "\\") return readCommand();
    return tex[i++] ?? "";
  }
  function readCommand(): string {
    i++; // the backslash
    let name = "";
    if (/[a-zA-Z]/.test(tex[i] ?? "")) while (/[a-zA-Z]/.test(tex[i] ?? "")) name += tex[i++];
    else name = tex[i++] ?? "";
    if (name === "\\") return "\n";
    if (IGNORED.has(name)) return "";
    if (name === "frac" || name === "dfrac" || name === "tfrac") {
      const num = readArg();
      const den = readArg();
      // d/dx x², not d/dxx²: a letter right after a fraction stays apart from it.
      const gap = /^\s*[\\a-zA-Z]/.test(tex.slice(i)) && !/^\s/.test(tex.slice(i)) ? " " : "";
      return `${wrap(num)}/${wrap(den)}${gap}`;
    }
    if (name === "sqrt") {
      let index = "";
      while (tex[i] === " ") i++;
      if (tex[i] === "[") {
        const end = tex.indexOf("]", i);
        if (end !== -1) {
          index = texToText(tex.slice(i + 1, end));
          i = end + 1;
        }
      }
      const body = readArg();
      const root = index === "3" ? "∛" : index === "4" ? "∜" : index ? `${script(index, SUP, "^")}√` : "√";
      return `${root}${wrap(body)}`;
    }
    if (WRAPPERS.has(name)) return readArg();
    return SYMBOLS[name] ?? name;
  }

  let out = "";
  while (i < tex.length) {
    const c = tex[i];
    if (c === "\\") out += readCommand();
    else if (c === "^" || c === "_") {
      i++;
      out += script(readArg(), c === "^" ? SUP : SUB, c);
    } else if (c === "{" ) out += readArg();
    else if (c === "}" || c === "&") i++;
    else if (c === "~") {
      out += " ";
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

/** A node's text with every formula in it written as readable text. Text with no formula comes back as it was. */
export function readableText(text: string): string {
  const pieces = splitMath(text);
  if (pieces.every((p) => p.kind === "text")) return text;
  return pieces.map((p) => (p.kind === "text" ? p.value : texToText(p.tex))).join("");
}

/** The parents above `nodeId`, from the top of its branch down to the node itself. Empty when it isn't on the map. */
export function ancestorChain(nodes: NodeDoc[], nodeId: string): NodeDoc[] {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const chain: NodeDoc[] = [];
  const seen = new Set<string>();
  let current = byId.get(nodeId);
  while (current && !seen.has(current.nodeId)) {
    seen.add(current.nodeId);
    chain.unshift(current);
    const parentId = nodeRefId(current.parentId);
    current = parentId ? byId.get(parentId) : undefined;
  }
  return chain;
}

/** The chain as an outline, each node indented under the one above it, a long text's later lines kept under its first. */
export function formatChain(chain: NodeDoc[], textOf: (n: NodeDoc) => string = (n) => n.text): string {
  return chain
    .map((n, depth) => {
      const pad = "  ".repeat(depth);
      const [first, ...rest] = readableText(textOf(n)).split("\n");
      const head = `${pad}${stepPrefix(n)}${n.type}: ${first}`;
      return [head, ...rest.map((line) => `${pad}  ${line}`)].join("\n");
    })
    .join("\n");
}

/** The zone a node's panel copies: the one it heads, else the one it sits in under its parent. Null when it is in none. */
export function zoneRootFor(nodes: NodeDoc[], groups: NodeGroup[], nodeId: string): string | null {
  if (groups.some((g) => g.rootId === nodeId)) return nodeId;
  const node = nodes.find((n) => n.nodeId === nodeId);
  const parentId = node ? nodeRefId(node.parentId) : undefined;
  if (parentId && groups.some((g) => g.rootId === parentId)) return parentId;
  return groups.find((g) => g.members.some((m) => m.nodeId === nodeId))?.rootId ?? null;
}

/**
 * Puts text on the system clipboard. Given a promise (text still loading), it
 * hands the browser a clipboard item that waits for it, so Safari still counts
 * the copy as part of the tap; elsewhere it waits, then writes.
 */
export async function writeClipboardText(text: string | Promise<string>): Promise<void> {
  if (typeof text !== "string" && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      const blob = text.then((s) => new Blob([s], { type: "text/plain" }));
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
      return;
    } catch {
      // A browser that won't take a waiting item: write the text once it's here.
    }
  }
  await navigator.clipboard.writeText(await text);
}
