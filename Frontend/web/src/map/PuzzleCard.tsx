import { useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { PuzzleJoins } from "../utils/puzzleLinks";

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

/** A piece's cut as drawn: its seeded cut, with the sides joined to linked nodes overriding it. */
export function pieceEdges(seed: string, joins?: PuzzleJoins): PuzzleEdges {
  return puzzleEdgesFor(seed).map((e, i) => joins?.cuts[i] ?? e) as PuzzleEdges;
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

// Each side's own stretch of outline, top/right/bottom/left, each starting
// at its own first point (so one can be drawn on its own, as a joined side
// is) — the straight runs between the rounded corners.
function sideRuns(x: number, y: number, w: number, h: number, edges: PuzzleEdges) {
  const r = Math.min(6, w / 4, h / 4); // corner radius
  const [top, right, bottom, left] = edges;
  return {
    r,
    runs: [
      { start: { x: x + r, y }, path: edgePath({ x: x + r, y }, { x: 1, y: 0 }, { x: 0, y: -1 }, w - 2 * r, top) },
      { start: { x: x + w, y: y + r }, path: edgePath({ x: x + w, y: y + r }, { x: 0, y: 1 }, { x: 1, y: 0 }, h - 2 * r, right) },
      { start: { x: x + w - r, y: y + h }, path: edgePath({ x: x + w - r, y: y + h }, { x: -1, y: 0 }, { x: 0, y: 1 }, w - 2 * r, bottom) },
      { start: { x, y: y + h - r }, path: edgePath({ x, y: y + h - r }, { x: 0, y: -1 }, { x: -1, y: 0 }, h - 2 * r, left) },
    ],
  };
}

/** The whole piece's outline for a `w`×`h` card whose top-left corner is at (`x`, `y`). */
export function puzzlePath(x: number, y: number, w: number, h: number, edges: PuzzleEdges): string {
  const { r, runs } = sideRuns(x, y, w, h, edges);
  return [
    `M ${x + r} ${y}`,
    runs[0].path,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    runs[1].path,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    runs[2].path,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    runs[3].path,
    `Q ${x} ${y} ${x + r} ${y}`,
    "Z",
  ].join(" ");
}

/** One side's outline on its own (0 top, 1 right, 2 bottom, 3 left). */
export function puzzleSidePath(x: number, y: number, w: number, h: number, edges: PuzzleEdges, side: number): string {
  const run = sideRuns(x, y, w, h, edges).runs[side];
  return `M ${run.start.x.toFixed(2)} ${run.start.y.toFixed(2)} ${run.path}`;
}

export interface PuzzleCardProps {
  /** Picks the piece's cut — the node's id, so it stays the same piece across renders. */
  seed: string;
  /** The type color the piece is outlined in. */
  color: string;
  /** A ring drawn around the piece's outline (selection, drop target…), or none. */
  halo?: { color: string; dashed?: boolean; pulse?: boolean } | null;
  /** Sides interlocked with a linked node (see utils/puzzleLinks.ts): their cut overrides the seeded one and is drawn heavier. */
  joins?: PuzzleJoins;
  /** The viewer's own fill for this piece (see utils/cardFill.ts); the theme's node fill when unset. */
  fill?: string;
  /** Makes every tab a handle: pressing one starts dragging a connection out of this piece (see MapPage's startPuzzleConnect). */
  onConnectStart?: (e: ReactPointerEvent) => void;
  /** The handles' tooltip. */
  connectHint?: string;
  /** Locked by its owner (utils/blockLock.ts): shows a padlock. */
  locked?: boolean;
  /** Locks/unlocks the block — the padlock becomes a button. Unset for someone else's piece. */
  onToggleLock?: () => void;
  /** The padlock's tooltip, for its current state. */
  lockLabel?: string;
  minWidth: number;
  maxWidth: number;
  children: ReactNode;
}

export function PuzzleCard({
  seed,
  color,
  halo,
  joins,
  fill,
  onConnectStart,
  connectHint,
  locked = false,
  onToggleLock,
  lockLabel,
  minWidth,
  maxWidth,
  children,
}: PuzzleCardProps) {
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

  const edges = pieceEdges(seed, joins);
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
      // Measured by usePuzzleCardSizes, which the puzzle assembly is laid out from.
      data-puzzle-card
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
          fill={fill ?? "var(--node-fill)"}
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.18))" }}
        />
        {/* A faint wash of the type's color over the theme's fill, so pieces
            of different types read apart at a glance, not only by their
            outline — stronger once the piece is complete. A fill the viewer
            picked is shown as picked. */}
        {!fill && <path d={d} fill={color} opacity={joins?.complete ? 0.2 : 0.1} />}
        {/* Joined sides: the cut that fits a linked neighbour, drawn heavier. */}
        {joins?.cuts.map((c, i) =>
          c === undefined ? null : (
            <path
              key={i}
              d={puzzleSidePath(pad, pad, size.w, size.h, edges, i)}
              fill="none"
              stroke={color}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ),
        )}
      </svg>
      {/* Connection handles: one on each tab's head. Dragging one onto
          another piece links the two (MapPage opens the link dialog). */}
      {onConnectStart &&
        edges.map((cut, side) => {
          const r = Math.min(6, size.w / 4, size.h / 4);
          const len = (side % 2 === 0 ? size.w : size.h) - 2 * r;
          if (cut !== 1 || len < 26) return null;
          const reach = PUZZLE_TAB * 0.58; // the head's center, past the edge
          const at = [
            { left: size.w / 2, top: -reach },
            { left: size.w + reach, top: size.h / 2 },
            { left: size.w / 2, top: size.h + reach },
            { left: -reach, top: size.h / 2 },
          ][side];
          return (
            <div
              key={side}
              role="button"
              aria-label={connectHint}
              title={connectHint}
              data-puzzle-handle
              className="pointer-events-auto absolute z-[2] h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 cursor-crosshair touch-none rounded-full transition-[box-shadow] duration-150 hover:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
              style={at}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onConnectStart(e);
              }}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            />
          );
        })}
      {/* Lock — bottom-left corner. Solid on a locked block; faint on an
          unlocked one of your own (full strength while hovered), so it can
          be found on a touch screen too without shouting from every card.
          Also in the node panel and the right-click menu. */}
      {(locked || onToggleLock) && (
        <button
          type="button"
          className={`absolute -bottom-2 -left-2 z-[3] flex h-5 w-5 items-center justify-center rounded-full border text-[0.62rem] leading-none shadow-card transition-opacity duration-150 ${
            onToggleLock ? "pointer-events-auto cursor-pointer" : "pointer-events-none"
          } ${
            locked
              ? "border-accent bg-accent text-white"
              : "border-line bg-surface text-ink-soft opacity-40 group-hover:opacity-100 focus-visible:opacity-100"
          }`}
          title={lockLabel}
          aria-label={lockLabel}
          aria-pressed={locked}
          tabIndex={onToggleLock ? 0 : -1}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock?.();
          }}
        >
          <svg width="10" height="11" viewBox="0 0 10 11" aria-hidden="true">
            <rect x="1" y="4.6" width="8" height="6" rx="1.2" fill="currentColor" />
            <path
              d={locked ? "M2.8 4.8 V3.2 a2.2 2.2 0 0 1 4.4 0 V4.8" : "M2.8 4.8 V3.2 a2.2 2.2 0 0 1 4.3 -0.6"}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
          </svg>
        </button>
      )}
      {joins?.complete && (
        <div
          className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full text-[0.6rem] leading-none font-bold text-white"
          style={{ background: color }}
          aria-hidden="true"
        >
          ✓
        </div>
      )}
      {/* A custom fill is always a light swatch, so its text stays dark
          whatever the theme. */}
      <div className="relative" style={fill ? { color: "#1f2937" } : undefined}>
        {children}
      </div>
    </div>
  );
}
