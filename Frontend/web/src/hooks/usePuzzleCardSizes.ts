import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import type { Size } from "../utils/puzzleAssembly";

// Every puzzle card's box as drawn on screen, in screen pixels, by node id —
// what utils/puzzleAssembly.ts lays pieces out by. A card keeps its size on
// screen whatever the zoom (NodeCard scales it by 1/zoom), so these don't
// change while zooming; divide by the zoom for canvas units. Re-measured
// after every render and whenever a card resizes on its own (text wrapping,
// a font arriving).
export function usePuzzleCardSizes(rootRef: RefObject<HTMLElement>): Map<string, Size> {
  const [sizes, setSizes] = useState<Map<string, Size>>(() => new Map());
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const cards = () => root.querySelectorAll<HTMLElement>("[data-reveal-node] [data-puzzle-card]");
    const measure = () => {
      const next = new Map<string, Size>();
      for (const card of cards()) {
        const id = card.closest("[data-reveal-node]")?.getAttribute("data-reveal-node");
        const r = card.getBoundingClientRect();
        if (id && r.width > 0 && r.height > 0) next.set(id, { w: Math.round(r.width), h: Math.round(r.height) });
      }
      setSizes((prev) => (sameSizes(prev, next) ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    for (const card of cards()) ro.observe(card);
    return () => ro.disconnect();
  });
  return sizes;
}

function sameSizes(a: Map<string, Size>, b: Map<string, Size>): boolean {
  if (a.size !== b.size) return false;
  for (const [id, s] of a) {
    const o = b.get(id);
    if (!o || o.w !== s.w || o.h !== s.h) return false;
  }
  return true;
}
