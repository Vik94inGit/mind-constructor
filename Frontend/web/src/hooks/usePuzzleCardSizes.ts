import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Size } from "../utils/puzzleAssembly";

// Every puzzle card's box as drawn on screen, in screen pixels, by node id —
// what utils/puzzleAssembly.ts lays pieces out by. A card keeps its size on
// screen whatever the zoom (NodeCard scales it by 1/zoom), so these don't
// change while zooming; divide by the zoom for canvas units. Re-measured
// after every render and whenever a card resizes on its own (text wrapping,
// a font arriving).
//
// A card's box depends on its joins (a blank side adds PUZZLE_TAB of padding),
// the joins depend on which pieces the assembly seated, and the assembly
// depends on these sizes — so for some layouts the measurements never settle
// and just flip between a few states, which re-renders forever (React error
// #185). `settleKey` is an identity that changes whenever the assembly's own
// inputs (nodes, links, positions, zoom, display) change; while it stays the
// same, a measurement that repeats one already taken is a cycle, and the
// last layout is held rather than chased.
export function usePuzzleCardSizes(rootRef: RefObject<HTMLElement>, settleKey: unknown): Map<string, Size> {
  const [sizes, setSizes] = useState<Map<string, Size>>(() => new Map());
  const current = useRef(sizes);
  current.current = sizes;
  const seen = useRef<string[]>([]);
  const keyRef = useRef(settleKey);
  useLayoutEffect(() => {
    if (keyRef.current !== settleKey) {
      keyRef.current = settleKey;
      seen.current = [];
    }
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
      if (sameSizes(current.current, next)) {
        // Settled: what's drawn is what was measured.
        seen.current = [];
        return;
      }
      const sig = signature(next);
      if (seen.current.includes(sig)) return; // cycling — hold the current layout
      seen.current = [...seen.current.slice(-7), sig];
      current.current = next;
      setSizes(next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    for (const card of cards()) ro.observe(card);
    return () => ro.disconnect();
  });
  return sizes;
}

function signature(sizes: Map<string, Size>): string {
  return Array.from(sizes, ([id, s]) => `${id}:${s.w}x${s.h}`)
    .sort()
    .join("|");
}

function sameSizes(a: Map<string, Size>, b: Map<string, Size>): boolean {
  if (a.size !== b.size) return false;
  for (const [id, s] of a) {
    const o = b.get(id);
    if (!o || o.w !== s.w || o.h !== s.h) return false;
  }
  return true;
}
