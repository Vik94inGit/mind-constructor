import { avoidOverlap, CANVAS_H, CANVAS_W, CAPTION_WIDTH, hashOffset } from "./canvasLayout";
import type { Obstacle } from "./canvasLayout";
import { nodeRefId, sentimentOf } from "./nodeType";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

// Timeline, in ms from the show's start. Each node runs its own copy of it,
// shifted by its own delay (see computeSentimentShowPlan), so nodes leave
// one after another and come back one after another.
export const OUT_MS = 1300;
export const BACK_AT_MS = 4000;
export const BACK_MS = 1000;
export const SKIP_MS = 450;
const MAX_STAGGER_MS = 110;
const MAX_SPREAD_MS = 800;

// How far toward the center a majority node is pulled (fraction of its
// current distance), before being nudged clear of the others.
const PULL = 0.4;
// How far toward the canvas edge a minority node is pushed (fraction of its
// remaining room to the edge along its own direction).
const PUSH = 0.6;
// Minimum distance between two nodes' centers at the peak — a caption's
// width plus a margin, so nothing stacks.
const MIN_SEP = CAPTION_WIDTH + 30;

export interface ShowPlan {
  /** How far each moving node travels at the peak. */
  vectors: Map<string, Pt>;
  /** When each moving node sets off, in ms after the show starts. */
  delays: Map<string, number>;
}

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
 * The sentiment show's plan: every node on the map's majority side travels
 * toward the center, every node on the minority side toward the edge, and
 * "unknown" nodes stay where they are. Each node moves on its own — members
 * of one zone can head in different directions, so the zone stretches and
 * shrinks as they go and ends in exactly its original shape once they're
 * all home. Weapons and shields travel with the node they attack/defend so
 * their bows stay on it. Every node's peak spot is kept MIN_SEP clear of
 * every other's, so nothing piles up. Nodes set off one after another,
 * nearest the center first. Pure: no React, no timing, no DOM.
 */
export function computeSentimentShowPlan(
  visibleNodes: NodeDoc[],
  positions: Map<string, Pt>,
  majority: "positive" | "negative",
  center: Pt = { x: CANVAS_W / 2, y: CANVAS_H / 2 },
): ShowPlan {
  const byId = new Map(visibleNodes.map((n) => [n.nodeId, n]));
  const anchorOf = (n: NodeDoc) =>
    n.isWeapon ? nodeRefId(n.targetNodeId) : n.isProtection ? nodeRefId(n.protectsNodeId) : null;
  const isFollower = (n: NodeDoc) => {
    const a = anchorOf(n);
    return !!a && byId.has(a) && positions.has(a);
  };
  const distToCenter = (p: Pt) => Math.hypot(p.x - center.x, p.y - center.y);

  const leaders = visibleNodes.filter((n) => positions.has(n.nodeId) && !isFollower(n));
  const sideOf = (n: NodeDoc) => {
    const s = sentimentOf(n.type);
    return !s ? "neutral" : s === majority ? "majority" : "minority";
  };

  const placed: Pt[] = leaders.filter((n) => sideOf(n) === "neutral").map((n) => positions.get(n.nodeId)!);
  const obstacles = (): Obstacle[] => placed.map((p) => ({ x: p.x, y: p.y, minDist: MIN_SEP }));
  const targets = new Map<string, Pt>();

  const majorityNodes = leaders
    .filter((n) => sideOf(n) === "majority")
    .sort((a, b) => distToCenter(positions.get(a.nodeId)!) - distToCenter(positions.get(b.nodeId)!));
  for (const n of majorityNodes) {
    const p = positions.get(n.nodeId)!;
    const desired = { x: center.x + (p.x - center.x) * (1 - PULL), y: center.y + (p.y - center.y) * (1 - PULL) };
    const t = avoidOverlap(desired, obstacles());
    targets.set(n.nodeId, t);
    placed.push(t);
  }
  for (const n of leaders.filter((n) => sideOf(n) === "minority")) {
    const p = positions.get(n.nodeId)!;
    const d = distToCenter(p);
    const angle = d > 0 ? Math.atan2(p.y - center.y, p.x - center.x) : hashOffset(n.nodeId, 360) * (Math.PI / 180);
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    const room = distanceToEdge(p, dir, 80);
    const desired = { x: p.x + dir.x * room * PUSH, y: p.y + dir.y * room * PUSH };
    const t = avoidOverlap(desired, obstacles());
    targets.set(n.nodeId, t);
    placed.push(t);
  }

  const vectors = new Map<string, Pt>();
  for (const [id, t] of targets) {
    const p = positions.get(id)!;
    const v = { x: t.x - p.x, y: t.y - p.y };
    if (Math.hypot(v.x, v.y) >= 0.5) vectors.set(id, v);
  }

  const movers = Array.from(vectors.keys()).sort(
    (a, b) => distToCenter(positions.get(a)!) - distToCenter(positions.get(b)!),
  );
  const stagger = movers.length > 1 ? Math.min(MAX_STAGGER_MS, MAX_SPREAD_MS / (movers.length - 1)) : 0;
  const delays = new Map<string, number>(movers.map((id, i) => [id, Math.round(i * stagger)]));

  for (const n of visibleNodes) {
    if (!isFollower(n)) continue;
    const a = anchorOf(n)!;
    const v = vectors.get(a);
    if (!v) continue;
    vectors.set(n.nodeId, v);
    delays.set(n.nodeId, delays.get(a)!);
  }
  return { vectors, delays };
}

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
export function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

/** How far along its trip (0 = home, 1 = at its peak spot) a node with this delay is, `elapsedMs` into the show. */
export function revealAmount(elapsedMs: number, delayMs: number): number {
  const tOut = elapsedMs - delayMs;
  if (tOut <= 0) return 0;
  const tBack = elapsedMs - BACK_AT_MS - delayMs;
  if (tBack >= BACK_MS) return 0;
  if (tBack > 0) return 1 - easeInOutCubic(tBack / BACK_MS);
  return easeInOutCubic(Math.min(1, tOut / OUT_MS));
}

/** When the last node of this plan is home again, in ms after the start. */
export function showEndMs(plan: ShowPlan): number {
  let maxDelay = 0;
  for (const d of plan.delays.values()) maxDelay = Math.max(maxDelay, d);
  return BACK_AT_MS + maxDelay + BACK_MS;
}

/**
 * The affine map that moves a→a+da and b→b+db (and every point of the
 * segment between them proportionally) — for a shape laid along a segment
 * between two independently moving nodes, like a bow aimed at its target.
 */
export function segmentMatrix(a: Pt, da: Pt, b: Pt, db: Pt): [number, number, number, number, number, number] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1) return [1, 0, 0, 1, da.x, da.y];
  const ux = dx / len2;
  const uy = dy / len2;
  const kx = db.x - da.x;
  const ky = db.y - da.y;
  const kxx = kx * ux;
  const kxy = kx * uy;
  const kyx = ky * ux;
  const kyy = ky * uy;
  return [1 + kxx, kyx, kxy, 1 + kyy, da.x - (kxx * a.x + kxy * a.y), da.y - (kyx * a.x + kyy * a.y)];
}

const ZERO = { x: 0, y: 0 };
const nums = (s: string | null) => (s ?? "").trim().split(/[\s,]+/).map(Number);
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Draws one frame of the show straight onto the canvas's DOM — no React
 * render. Everything node-attached on the canvas is tagged with data-reveal
 * attributes naming the node(s) it follows, plus data-base holding the real,
 * React-rendered geometry; this rewrites each from its own base plus the
 * current displacement of those nodes. Called with a displacement of null
 * for every node, it writes every base back exactly — the show's clean-up.
 */
export function applyRevealFrame(root: ParentNode, disp: (nodeId: string) => Pt | null) {
  const d = (id: string) => disp(id) ?? ZERO;

  root.querySelectorAll<HTMLElement>("[data-reveal-node]").forEach((el) => {
    const v = disp(el.dataset.revealNode!);
    el.style.translate = v ? `${r2(v.x)}px ${r2(v.y)}px` : "";
  });

  root.querySelectorAll<SVGElement>("[data-reveal-points]").forEach((el) => {
    const ids = el.dataset.revealPoints!.split(" ");
    const base = el.dataset.base ?? "";
    const moving = ids.some((id) => disp(id));
    if (!moving) {
      el.setAttribute("points", base);
      return;
    }
    const b = nums(base);
    el.setAttribute(
      "points",
      ids.map((id, i) => `${r2(b[2 * i] + d(id).x)},${r2(b[2 * i + 1] + d(id).y)}`).join(" "),
    );
  });

  root.querySelectorAll<SVGElement>("[data-reveal-at]").forEach((el) => {
    const [cx, cy] = nums(el.dataset.base ?? null);
    const v = d(el.dataset.revealAt!);
    el.setAttribute("cx", String(r2(cx + v.x)));
    el.setAttribute("cy", String(r2(cy + v.y)));
  });

  root.querySelectorAll<SVGElement>("[data-reveal-line]").forEach((el) => {
    const [ida, idb] = el.dataset.revealLine!.split(" ");
    const [x1, y1, x2, y2] = nums(el.dataset.base ?? null);
    const va = d(ida);
    const vb = d(idb);
    el.setAttribute("x1", String(r2(x1 + va.x)));
    el.setAttribute("y1", String(r2(y1 + va.y)));
    el.setAttribute("x2", String(r2(x2 + vb.x)));
    el.setAttribute("y2", String(r2(y2 + vb.y)));
  });

  root.querySelectorAll<SVGElement>("[data-reveal-seg]").forEach((el) => {
    const [ida, idb] = el.dataset.revealSeg!.split(" ");
    if (!disp(ida) && !disp(idb)) {
      el.removeAttribute("transform");
      return;
    }
    const [ax, ay, bx, by] = nums(el.dataset.base ?? null);
    const m = segmentMatrix({ x: ax, y: ay }, d(ida), { x: bx, y: by }, d(idb));
    el.setAttribute("transform", `matrix(${m.map((n) => Math.round(n * 10000) / 10000).join(" ")})`);
  });
}
