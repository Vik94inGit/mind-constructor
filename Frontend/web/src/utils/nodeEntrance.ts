import type { NodeDoc } from "../types";

// Timeline, in ms from the entrance's start. A short welcome, not a replay
// (the time-lapse tells the whole story, node by node): nodes come first,
// each fading and growing in over APPEAR_MS, STAGGER_MS after the one before,
// the first after LEAD_MS. Then the zones: once the last node is in, each
// zone (its fill, its wall, the realm border round a kingdom) fades in whole,
// ZONE_STAGGER_MS after the one before. However many nodes and zones there
// are, the last of each starts within MAX_SPREAD_MS and MAX_ZONE_SPREAD_MS of
// its first, so the whole entrance is over within MAX_ENTRANCE_MS, and a
// click skips the rest.
export const APPEAR_MS = 450;
export const SKIP_MS = 250;
export const LEAD_MS = 150;
export const STAGGER_MS = 220;
export const MAX_SPREAD_MS = 1100;
export const ZONE_STAGGER_MS = 150;
export const MAX_ZONE_SPREAD_MS = 350;
export const MAX_ENTRANCE_MS = LEAD_MS + MAX_SPREAD_MS + APPEAR_MS + MAX_ZONE_SPREAD_MS + APPEAR_MS;

// A map plays its entrance only the first time it opens in this browser;
// after that it is simply there. Kept per browser and per map, like the
// locked blocks (utils/blockLock.ts).
const seenKey = (mapId: string) => `mc_entrance_seen:${mapId}`;

export function hasSeenEntrance(mapId: string): boolean {
  try {
    return localStorage.getItem(seenKey(mapId)) !== null;
  } catch {
    return false;
  }
}

export function markEntranceSeen(mapId: string): void {
  try {
    localStorage.setItem(seenKey(mapId), "1");
  } catch {
    // best-effort — the entrance just plays again next time
  }
}

// How small a node starts before it grows to its full size.
const START_SCALE = 0.6;

/** The timeline key of a zone, by its parent's id — kept apart from the parent node's own. */
export const zoneKey = (rootId: string) => `zone:${rootId}`;
export const isZoneKey = (key: string) => key.startsWith("zone:");

/**
 * When each node and zone starts to appear, in ms after the entrance starts,
 * listed earliest first: every node, then every zone (under zoneKey). Both in
 * the order the nodes were made (createdAt, oldest first; a zone by its
 * parent's), so the map is told the way it was written — a problem before its
 * options, a node before the objection against it. Nodes without a createdAt
 * keep their place in the list, ahead of dated ones. Pure: no React, no
 * timing, no DOM.
 */
export function computeEntranceDelays(nodes: NodeDoc[], zoneRootIds: string[] = []): Map<string, number> {
  const ordered = nodes
    .map((n, i) => ({ id: n.nodeId, at: n.createdAt ?? "", i }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.i - b.i));
  const delays = new Map<string, number>();
  const stagger = ordered.length > 1 ? Math.min(STAGGER_MS, MAX_SPREAD_MS / (ordered.length - 1)) : 0;
  ordered.forEach((o, i) => delays.set(o.id, Math.round(LEAD_MS + i * stagger)));
  const roots = new Set(zoneRootIds);
  const zones = ordered.filter((o) => roots.has(o.id));
  const zonesFrom = Math.round(LEAD_MS + Math.max(0, ordered.length - 1) * stagger) + APPEAR_MS;
  const zoneStagger = zones.length > 1 ? Math.min(ZONE_STAGGER_MS, MAX_ZONE_SPREAD_MS / (zones.length - 1)) : 0;
  zones.forEach((z, i) => delays.set(zoneKey(z.id), Math.round(zonesFrom + i * zoneStagger)));
  return delays;
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
 * own turn (under zoneKey), and a figure
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
  root
    .querySelectorAll<SVGElement>("[data-reveal-zone]")
    .forEach((el) => setAmount(el, amount(zoneKey(el.dataset.revealZone!))));
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
