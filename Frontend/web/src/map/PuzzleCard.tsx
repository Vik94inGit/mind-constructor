import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// The puzzle-card reading mode (see utils/readingMode.ts): a node drawn as a
// jigsaw piece — a card whose four edges each carry a tab sticking out, a
// blank cut in, or nothing, picked per node from its id so a map reads as a
// spread of differently-cut pieces rather than one stamp repeated.
//
// The outline is an SVG path sized to the card's own content box (measured
// with a ResizeObserver), so the tabs follow the text however long it grows.

/** One edge's cut: 1 a tab out, -1 a blank in, 0 a flat edge. */
export type PuzzleEdge = -1 | 0 | 1;
/** Top, right, bottom, left — clockwise, the order the outline is drawn in. */
export type PuzzleEdges = [PuzzleEdge, PuzzleEdge, PuzzleEdge, PuzzleEdge];

/** How far a tab sticks out past the card (and a blank cuts in), in px. */
export const PUZZLE_TAB = 15;

// A cheap deterministic hash (FNV-1a) — the same node always gets the same cut.
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Every edge gets a tab or a blank (a flat edge reads as a border piece, and a
// card with no cuts at all wouldn't read as a puzzle), with at least one tab
// and one blank so no piece is all-out or all-in.
export function puzzleEdgesFor(seed: string): PuzzleEdges {
  const h = hash(seed);
  const edges = [0, 1, 2, 3].map((i) => ((h >> i) & 1 ? 1 : -1)) as PuzzleEdges;
  const tabs = edges.filter((e) => e === 1).length;
  if (tabs === 4) edges[(h >> 4) & 3] = -1;
  else if (tabs === 0) edges[(h >> 4) & 3] = 1;
  return edges;
}

type Pt = { x: number; y: number };

// One edge, from `from` along `dir` for `len`, with its tab/blank bulging
// toward `out` (the edge's outward normal) — a blank flips it inward. The
// knob is a round head on a narrower neck (the neck flares a little into the
// edge), so it reads as a jigsaw tab rather than a bump.
function edgePath(from: Pt, dir: Pt, out: Pt, len: number, cut: PuzzleEdge): string {
  const at = (u: number, v: number) => {
    const x = from.x + dir.x * u + out.x * v;
    const y = from.y + dir.y * u + out.y * v;
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  };
  const end = at(len, 0);
  if (cut === 0 || len < 26) return `L ${end}`;
  const r = PUZZLE_TAB * 0.42; // the head's radius
  const neck = r * 0.6; // half the neck's width
  const flare = 2.5;
  const mid = len / 2;
  // Where the neck meets the head: on the head's circle (centered a radius
  // in from the tab's tip), at the neck's width.
  const join = (PUZZLE_TAB - r - Math.sqrt(r * r - neck * neck)) * cut;
  // Every edge is walked clockwise, so going around a tab's head is
  // clockwise too, and around a blank's (the same shape mirrored in) isn't.
  const sweep = cut === 1 ? 1 : 0;
  return [
    `L ${at(mid - neck - flare, 0)}`,
    `Q ${at(mid - neck, 0)} ${at(mid - neck, join)}`,
    `A ${r} ${r} 0 1 ${sweep} ${at(mid + neck, join)}`,
    `Q ${at(mid + neck, 0)} ${at(mid + neck + flare, 0)}`,
    `L ${end}`,
  ].join(" ");
}

/** The whole piece's outline for a `w`×`h` card whose top-left corner is at (`x`, `y`). */
export function puzzlePath(x: number, y: number, w: number, h: number, edges: PuzzleEdges): string {
  const r = Math.min(6, w / 4, h / 4); // corner radius
  const [top, right, bottom, left] = edges;
  return [
    `M ${x + r} ${y}`,
    edgePath({ x: x + r, y }, { x: 1, y: 0 }, { x: 0, y: -1 }, w - 2 * r, top),
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    edgePath({ x: x + w, y: y + r }, { x: 0, y: 1 }, { x: 1, y: 0 }, h - 2 * r, right),
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    edgePath({ x: x + w - r, y: y + h }, { x: -1, y: 0 }, { x: 0, y: 1 }, w - 2 * r, bottom),
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    edgePath({ x, y: y + h - r }, { x: 0, y: -1 }, { x: -1, y: 0 }, h - 2 * r, left),
    `Q ${x} ${y} ${x + r} ${y}`,
    "Z",
  ].join(" ");
}

export interface PuzzleCardProps {
  /** Picks the piece's cut — the node's id, so it stays the same piece across renders. */
  seed: string;
  /** The type color the piece is outlined in. */
  color: string;
  /** A ring drawn around the piece's outline (selection, drop target…), or none. */
  halo?: { color: string; dashed?: boolean; pulse?: boolean } | null;
  minWidth: number;
  maxWidth: number;
  children: ReactNode;
}

export function PuzzleCard({ seed, color, halo, minWidth, maxWidth, children }: PuzzleCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  // A sensible first guess so the very first paint already has a piece
  // around it; the observer corrects it straight away.
  const [size, setSize] = useState({ w: minWidth, h: 40 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w > 0 && h > 0) setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const edges = puzzleEdgesFor(seed);
  // Room around the card for tabs, the outline's stroke and the halo.
  const pad = PUZZLE_TAB + 6;
  const d = puzzlePath(pad, pad, size.w, size.h, edges);
  // A blank cuts into the card, so the text keeps clear of it: each side's
  // padding grows by the depth of a blank on that side.
  const inset = (e: PuzzleEdge) => (e === -1 ? PUZZLE_TAB : 0);
  const [top, right, bottom, left] = edges;

  return (
    <div
      ref={ref}
      className="relative box-border text-left"
      style={{
        width: "max-content",
        minWidth,
        maxWidth,
        padding: `${6 + inset(top)}px ${10 + inset(right)}px ${6 + inset(bottom)}px ${10 + inset(left)}px`,
      }}
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute overflow-visible"
        style={{ left: -pad, top: -pad, width: size.w + 2 * pad, height: size.h + 2 * pad }}
      >
        {halo && (
          <path
            d={d}
            fill="none"
            stroke={halo.color}
            strokeWidth={halo.dashed ? 3 : 6}
            strokeDasharray={halo.dashed ? "6 4" : undefined}
            strokeLinejoin="round"
            opacity={halo.dashed ? 1 : 0.55}
            className={halo.pulse ? "animate-pulse" : undefined}
          />
        )}
        <path
          d={d}
          fill="var(--node-fill)"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.18))" }}
        />
        {/* A faint wash of the type's color over the fill, so pieces of
            different types read apart at a glance, not only by their outline. */}
        <path d={d} fill={color} opacity={0.1} />
      </svg>
      <div className="relative">{children}</div>
    </div>
  );
}
