import type { NodeDoc } from "../types";

// Timeline, in ms from the entrance's start. Each node fades and grows in
// over APPEAR_MS, starting at its own delay, so the map builds itself up one
// node after another, slowly enough to read each one before the next comes,
// the way the thoughts came. The
// first one waits LEAD_MS, so the camera has settled on it before it shows.
// However many nodes there are, the last one starts by MAX_SPREAD_MS, and a
// click skips the rest, so a big map never keeps the user waiting.
export const APPEAR_MS = 1000;
export const SKIP_MS = 250;
export const LEAD_MS = 350;
export const STAGGER_MS = 1800;
export const MAX_SPREAD_MS = 60000;
// How small a node starts before it grows to its full size.
const START_SCALE = 0.6;

/**
 * When each node starts to appear, in ms after the entrance starts, listed
 * earliest first: in the
 * order the nodes were made (createdAt, oldest first), so the map is told the
 * way it was written — a problem before its options, a node before the
 * objection against it. Nodes without a createdAt keep their place in the
 * list, ahead of dated ones. Pure: no React, no timing, no DOM.
 */
export function computeEntranceDelays(nodes: NodeDoc[]): Map<string, number> {
  const ordered = nodes
    .map((n, i) => ({ id: n.nodeId, at: n.createdAt ?? "", i }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.i - b.i));
  const stagger = ordered.length > 1 ? Math.min(STAGGER_MS, MAX_SPREAD_MS / (ordered.length - 1)) : 0;
  return new Map(ordered.map((o, i) => [o.id, Math.round(LEAD_MS + i * stagger)]));
}

export function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

/** How far in a node with this delay is, `elapsedMs` into the entrance: 0 = not yet, 1 = fully there. */
export function appearAmount(elapsedMs: number, delayMs: number): number {
  const t = (elapsedMs - delayMs) / APPEAR_MS;
  return t <= 0 ? 0 : t >= 1 ? 1 : easeOutCubic(t);
}

/** When the last node of this entrance is fully there, in ms after the start. */
export function entranceEndMs(delays: Map<string, number>): number {
  let maxDelay = 0;
  for (const d of delays.values()) maxDelay = Math.max(maxDelay, d);
  return maxDelay + APPEAR_MS;
}

// Each element's own opacity before the entrance touched it, kept on the
// element while the entrance runs, so the fade multiplies it (a dimmed zone
// fades in to its dimmed look, not to full).
function opacityOf(el: HTMLElement | SVGElement): number {
  const kept = el.dataset.entranceBase;
  if (kept !== undefined) return Number(kept);
  const own = el instanceof SVGElement ? el.getAttribute("opacity") : getComputedStyle(el).opacity;
  const base = own && Number.isFinite(Number(own)) ? Number(own) : 1;
  el.dataset.entranceBase = String(base);
  return base;
}

function setAmount(el: HTMLElement | SVGElement, a: number | null) {
  if (a === null || a >= 1) {
    el.style.opacity = "";
    delete el.dataset.entranceBase;
    return;
  }
  el.style.opacity = String(Math.round(opacityOf(el) * a * 1000) / 1000);
}

/**
 * Draws one frame of the entrance straight onto the canvas's DOM — no React
 * render. Everything node-attached on the canvas is tagged with data-reveal
 * attributes naming the node(s) it belongs to: a node card fades and grows
 * in, a mark on one node fades in with it, a link or weapon bow once both its
 * ends are there, a zone (its fill, its wall, the realm border) whole in its
 * own turn, with its parent node, so the map fills zone by zone, and a figure
 * drawn through several nodes as they arrive. `amount` gives null for a
 * node that isn't part of the entrance; called with null for every node, it
 * clears every inline style it set — the entrance's clean-up.
 */
export function applyEntranceFrame(root: ParentNode, amount: (nodeId: string) => number | null) {
  const of = (ids: string[], combine: (xs: number[]) => number) => {
    const xs = ids.map((id) => amount(id)).filter((x): x is number => x !== null);
    return xs.length > 0 ? combine(xs) : null;
  };
  const min = (xs: number[]) => Math.min(...xs);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

  root.querySelectorAll<HTMLElement>("[data-reveal-node]").forEach((el) => {
    const a = amount(el.dataset.revealNode!);
    setAmount(el, a);
    el.style.scale = a === null || a >= 1 ? "" : String(Math.round((START_SCALE + (1 - START_SCALE) * a) * 1000) / 1000);
  });
  root.querySelectorAll<SVGElement>("[data-reveal-at]").forEach((el) => setAmount(el, amount(el.dataset.revealAt!)));
  root.querySelectorAll<SVGElement>("[data-reveal-zone]").forEach((el) => setAmount(el, amount(el.dataset.revealZone!)));
  root
    .querySelectorAll<SVGElement>("[data-reveal-line]")
    .forEach((el) => setAmount(el, of(el.dataset.revealLine!.split(" "), min)));
  root
    .querySelectorAll<SVGElement>("[data-reveal-seg]")
    .forEach((el) => setAmount(el, of(el.dataset.revealSeg!.split(" "), min)));
  root
    .querySelectorAll<SVGElement>("[data-reveal-points]")
    .forEach((el) => setAmount(el, of(el.dataset.revealPoints!.split(" "), mean)));
}
