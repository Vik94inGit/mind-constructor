import type { CSSProperties } from "react";
import { avoidOverlap, CANVAS_H, CANVAS_W, CAPTION_WIDTH, circleSentiment, hashOffset } from "./canvasLayout";
import type { NodeGroup, Obstacle } from "./canvasLayout";
import { nodeRefId, sentimentOf } from "./nodeType";
import type { Sentiment } from "./nodeType";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

// The single number the whole show animates: 0 = everything at its real
// position, 1 = everything at its show target. Registered with @property in
// index.css so the browser can transition it; every node, zone, ring, link
// and bow derives its own offset from it with calc(), so one CSS transition
// on the canvas moves all of them on the same clock.
export const REVEAL_VAR = "--reveal-s";

// How far toward the canvas center a positive unit's centroid is pulled
// (fraction of its current distance), before overlap resolution.
const PULL = 0.4;
// How far toward the canvas edge a negative unit's centroid is pushed
// (fraction of its remaining room to the edge along its own direction).
const PUSH = 0.6;
// Clear space kept between any two units at their show targets.
const GAP = 40;
// A lone node's footprint radius — half its caption plus a little.
const NODE_PAD = CAPTION_WIDTH / 2 + 16;

interface Unit {
  ids: string[];
  sentiment: Sentiment;
  c: Pt;
  r: number;
}

function find(parent: Map<string, string>, id: string): string {
  let root = id;
  while (parent.get(root) !== root) root = parent.get(root)!;
  let cur = id;
  while (parent.get(cur) !== root) {
    const next = parent.get(cur)!;
    parent.set(cur, root);
    cur = next;
  }
  return root;
}

// Nodes that must travel together as one rigid body: every circle's root
// and members (and circles sharing a node — a nested circle's root is also
// a member of its parent circle — merge into one body, so every zone
// polygon keeps its exact shape), plus each weapon/shield riding with the
// node it attacks/defends so its bow stays pinned to it.
function buildUnits(visibleNodes: NodeDoc[], positions: Map<string, Pt>, groups: NodeGroup[]): Unit[] {
  const parent = new Map<string, string>();
  const present = visibleNodes.filter((n) => positions.has(n.nodeId));
  for (const n of present) parent.set(n.nodeId, n.nodeId);
  const union = (a: string, b: string) => {
    if (!parent.has(a) || !parent.has(b)) return;
    const ra = find(parent, a);
    const rb = find(parent, b);
    if (ra !== rb) parent.set(ra, rb);
  };
  const inGroup = new Set<string>();
  for (const g of groups) {
    for (const m of g.members) {
      union(g.rootId, m.nodeId);
      inGroup.add(m.nodeId);
    }
  }
  for (const n of present) {
    const anchor = n.isWeapon ? nodeRefId(n.targetNodeId) : n.isProtection ? nodeRefId(n.protectsNodeId) : null;
    if (anchor) union(n.nodeId, anchor);
  }

  const byRoot = new Map<string, NodeDoc[]>();
  for (const n of present) {
    const root = find(parent, n.nodeId);
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root)!.push(n);
  }

  const units: Unit[] = [];
  for (const members of byRoot.values()) {
    const pts = members.map((m) => positions.get(m.nodeId)!);
    const c = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
    const r = Math.max(...pts.map((p) => Math.hypot(p.x - c.x, p.y - c.y))) + NODE_PAD;
    // A body containing a circle votes like its zone does; a plain node (or
    // a node plus its weapons/shields) goes by the plain node's own type.
    const isCircle = members.some((m) => inGroup.has(m.nodeId));
    let sentiment: Sentiment;
    if (isCircle) {
      sentiment = circleSentiment(members.filter((m) => inGroup.has(m.nodeId)));
    } else {
      const main = members.find((m) => !m.isWeapon && !m.isProtection) ?? members[0];
      sentiment = sentimentOf(main.type) ?? "neutral";
    }
    units.push({ ids: members.map((m) => m.nodeId), sentiment, c, r });
  }
  return units;
}

// Distance from `from` along unit vector `dir` to the canvas boundary, kept
// `clearance` inside it — ray/box slab method.
function distanceToEdge(from: Pt, dir: Pt, clearance: number): number {
  const candidates: number[] = [];
  if (dir.x > 0) candidates.push((CANVAS_W - clearance - from.x) / dir.x);
  if (dir.x < 0) candidates.push((clearance - from.x) / dir.x);
  if (dir.y > 0) candidates.push((CANVAS_H - clearance - from.y) / dir.y);
  if (dir.y < 0) candidates.push((clearance - from.y) / dir.y);
  const positive = candidates.filter((v) => v > 0);
  return positive.length > 0 ? Math.min(...positive) : 0;
}

/**
 * Where every node travels for the map's sentiment show, as an offset from
 * its real position (only nodes that actually move are included). Positive
 * bodies are pulled toward the canvas center, negative ones pushed toward
 * the edge, neutral ones stay put — and every body is placed clear of every
 * other one by its own real radius plus GAP, so nothing ends up stacked on
 * anything else at the peak of the show. Pure: no React, no timing.
 */
export function computeSentimentShowVectors(
  visibleNodes: NodeDoc[],
  positions: Map<string, Pt>,
  groups: NodeGroup[],
  center: Pt = { x: CANVAS_W / 2, y: CANVAS_H / 2 },
): Map<string, Pt> {
  const units = buildUnits(visibleNodes, positions, groups);
  const placed: { c: Pt; r: number }[] = [];
  const targets = new Map<Unit, Pt>();
  const obstaclesFor = (u: Unit): Obstacle[] =>
    placed.map((p) => ({ x: p.c.x, y: p.c.y, minDist: p.r + u.r + GAP }));

  // Neutral bodies never move — they're fixed terrain the others avoid.
  for (const u of units.filter((u) => u.sentiment === "neutral")) placed.push({ c: u.c, r: u.r });

  // Positive: closest to center claims the middle first; everyone keeps
  // roughly their own side of the map (a straight pull toward center, not a
  // reshuffle), then gets nudged clear of whatever's already there.
  const positives = units
    .filter((u) => u.sentiment === "positive")
    .sort((a, b) => Math.hypot(a.c.x - center.x, a.c.y - center.y) - Math.hypot(b.c.x - center.x, b.c.y - center.y));
  for (const u of positives) {
    const desired = { x: center.x + (u.c.x - center.x) * (1 - PULL), y: center.y + (u.c.y - center.y) * (1 - PULL) };
    const t = avoidOverlap(desired, obstaclesFor(u));
    targets.set(u, t);
    placed.push({ c: t, r: u.r });
  }

  for (const u of units.filter((u) => u.sentiment === "negative")) {
    const dx = u.c.x - center.x;
    const dy = u.c.y - center.y;
    const dist = Math.hypot(dx, dy);
    const angle = dist > 0 ? Math.atan2(dy, dx) : hashOffset(u.ids[0], 360) * (Math.PI / 180);
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    const room = distanceToEdge(u.c, dir, Math.min(u.r, CANVAS_H / 4));
    const desired = { x: u.c.x + dir.x * room * PUSH, y: u.c.y + dir.y * room * PUSH };
    const t = avoidOverlap(desired, obstaclesFor(u));
    targets.set(u, t);
    placed.push({ c: t, r: u.r });
  }

  const vectors = new Map<string, Pt>();
  for (const [u, t] of targets) {
    const v = { x: t.x - u.c.x, y: t.y - u.c.y };
    if (Math.hypot(v.x, v.y) < 0.5) continue;
    for (const id of u.ids) vectors.set(id, v);
  }
  return vectors;
}

const r4 = (n: number) => Math.round(n * 10000) / 10000;
const s = `var(${REVEAL_VAR}, 0)`;

/** Value for the CSS `translate` property on an HTML element (a NodeCard). */
export function revealTranslate(v: Pt): string {
  return `calc(${s} * ${r4(v.x)}px) calc(${s} * ${r4(v.y)}px)`;
}

const SVG_TRANSFORM_BASE: CSSProperties = { transformOrigin: "0 0", transformBox: "view-box" };

/** Style for an SVG shape that moves rigidly with one node/body. */
export function revealPointStyle(v: Pt | null | undefined): CSSProperties | undefined {
  if (!v) return undefined;
  return { ...SVG_TRANSFORM_BASE, transform: `translate(calc(${s} * ${r4(v.x)}px), calc(${s} * ${r4(v.y)}px))` };
}

/**
 * Style for an SVG shape laid along the segment a→b whose two ends move by
 * different vectors (a link between two bodies, a bow aimed at another
 * body). The matrix's entries are linear in the animated number, so at every
 * frame a lands exactly at a + s·va and b exactly at b + s·vb — the line
 * stretches/turns between its two moving nodes instead of detaching. Pair
 * with vector-effect="non-scaling-stroke" so the stroke width doesn't stretch.
 */
export function revealSegmentStyle(a: Pt, va: Pt | null | undefined, b: Pt, vb: Pt | null | undefined): CSSProperties | undefined {
  const A = va ?? { x: 0, y: 0 };
  const B = vb ?? { x: 0, y: 0 };
  if (!va && !vb) return undefined;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1 || (A.x === B.x && A.y === B.y)) return revealPointStyle(A);
  const ux = dx / len2;
  const uy = dy / len2;
  const ddx = B.x - A.x;
  const ddy = B.y - A.y;
  const kxx = ddx * ux;
  const kxy = ddx * uy;
  const kyx = ddy * ux;
  const kyy = ddy * uy;
  const e = A.x - (kxx * a.x + kxy * a.y);
  const f = A.y - (kyx * a.x + kyy * a.y);
  return {
    ...SVG_TRANSFORM_BASE,
    transform: `matrix(calc(1 + ${s} * ${r4(kxx)}), calc(${s} * ${r4(kyx)}), calc(${s} * ${r4(kxy)}), calc(1 + ${s} * ${r4(kyy)}), calc(${s} * ${r4(e)}), calc(${s} * ${r4(f)}))`,
  };
}

/** Opacity that fades a shape out while the show is out and back in as it returns. */
export const REVEAL_FADE_OPACITY = `calc(1 - ${s})`;
