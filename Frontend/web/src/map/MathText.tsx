import { Fragment, memo, useEffect, useState } from "react";
import { hasMath, splitMath } from "../utils/mathText";

// A node's text with its formulas drawn as real maths (utils/mathText.ts finds
// them). KaTeX and its stylesheet are a separate download fetched the first
// time a text holds a formula, so maps without maths never load them; until it
// arrives the formula shows as its LaTeX source.

type Katex = typeof import("katex").default;

let katex: Katex | null = null;
let loading: Promise<Katex> | null = null;

function loadKatex(): Promise<Katex> {
  loading ??= Promise.all([import("katex"), import("katex/dist/katex.min.css")]).then(([m]) => {
    katex = m.default;
    return katex;
  });
  return loading;
}

const rendered = new Map<string, string>();

function toHtml(k: Katex, tex: string, display: boolean): string {
  const key = `${display ? "D" : "I"}${tex}`;
  let html = rendered.get(key);
  if (html === undefined) {
    // throwOnError false: a typo shows the source in red rather than breaking
    // the card. trust stays off, so pasted text can't add links or styles.
    html = k.renderToString(tex, { displayMode: display, throwOnError: false, output: "html" });
    if (rendered.size > 500) rendered.clear();
    rendered.set(key, html);
  }
  return html;
}

function MathTextImpl({ text }: { text: string }) {
  const withMath = hasMath(text);
  const [lib, setLib] = useState<Katex | null>(katex);
  useEffect(() => {
    if (!withMath || lib) return;
    let alive = true;
    loadKatex().then(
      (k) => alive && setLib(() => k),
      () => {
        loading = null; // offline: try again next time
      },
    );
    return () => {
      alive = false;
    };
  }, [withMath, lib]);

  if (!withMath) return <>{text}</>;
  return (
    <>
      {splitMath(text).map((p, i) =>
        p.kind === "text" ? (
          <Fragment key={i}>{p.value}</Fragment>
        ) : lib ? (
          <span
            key={i}
            className={p.display ? "block max-w-full overflow-x-auto overflow-y-hidden" : undefined}
            data-math={p.display ? "display" : "inline"}
            dangerouslySetInnerHTML={{ __html: toHtml(lib, p.tex, p.display) }}
          />
        ) : (
          <code key={i} data-math="source">
            {p.tex}
          </code>
        ),
      )}
    </>
  );
}

/** `text` as it reads, with any formulas in it drawn as maths. */
export const MathText = memo(MathTextImpl);
