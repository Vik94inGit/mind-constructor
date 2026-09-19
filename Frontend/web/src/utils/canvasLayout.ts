// Pure, stateless canvas-geometry helpers previously living at module scope
// inside MapPage.tsx — placement math, obstacle-avoidance, and a couple of
// small pure predicates none of which touch React state/refs/closures at
// all, just plain inputs to plain outputs. Pulled out here so MapPage.tsx
// itself (which was pushing 3,500 lines) is just the component and its own
// state/handlers; nothing here changed behavior, only location.
import { nodeRefId, sentimentOf } from "./nodeType";
import type { Sentiment } from "./nodeType";
import type { EdgeDoc, NodeDoc, NodeType } from "../types";

export const CANVAS_W = 2400;
export const CANVAS_H = 1600;

// Canvas zoom bounds/step — see MapPage's own zoom state and zoomAt(). 0.5x
// still leaves individual node captions legible; 2.5x is plenty for
// picking out detail in a crowded circle without the canvas's own
// 2400x1600 bound making a fully-zoomed-out view pointless.
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 0.35;

// How much of the screen's height NodePanel/LinkPickerPanel's bottom sheet
// is allowed to cover — kept in one function so centerOnNode (which
// reserves this much space when parking the chosen node) and
// viewportBounds (which reserves the same strip when clamping where a new
// node/ghost is allowed to land) can never drift out of sync with each
// other, or with the sheet's own max-height (see NodePanel's PANEL_CLASS,
// whose own max-h-[..dvh] pair has to keep matching these two numbers).
// Different per device on purpose now: on desktop there's plenty of
// headroom above even a generous sheet, but a phone's short viewport is
// what actually makes a mismatch here bite — the old 75dvh sheet against a
// 40%-reserve camera left the just-selected node (and its quick-add
// ghosts) parked behind the sheet more often than not, and made every
// *other* node in that bottom stretch physically untappable (the sheet is
// opaque and sits above every node in z-index, so a tap there never
// reaches the canvas at all). 1/3 on desktop leaves two full thirds of the
// screen clear for the canvas; mobile's own screen is short enough that a
// sheet worth reading needs more of it, so it gets 1/2 instead, leaving
// the top half clear.
//
// Was 2/3 on mobile — cut back to 1/2 because the quick-add ghost ring
// (QuickAddGhosts) needs real room on *both* sides of the node, not just
// above it: with only the top third clear, the node ends up sitting right
// against the sheet's own edge, so the bottom half of the ring gets
// clamped to that edge (bounds.maxY) and renders right underneath the
// sheet — invisible, since the sheet is opaque and sits above the ghosts
// in z-index (z-46 vs z-33). The ring's own circle-fix (see its MIN_RADIUS
// comment) keeps every point mathematically on a real circle, but a
// circle half-hidden behind an opaque sheet still reads as "just the
// visible top arc" — a row, not a ring. 1/2 doesn't eliminate the
// clamp in every case, but it gives the ring meaningfully more room to
// actually close underneath the node before hitting that edge.
export function panelReserveFrac(isMobile: boolean) {
  return isMobile ? 1 / 2 : 1 / 3;
}

// Node copy/paste clipboard (see MapPage's own copySelection/pasteClipboard)
// — deliberately module-level, not component state/a ref inside MapPage.
// Navigating from one map to another is a client-side route change
// (`/maps/:mapId`) that fully unmounts and remounts MapPage, which would
// wipe out anything held in that component's own state/refs — copying on
// one map and pasting on another needs this to survive exactly that.
// Lost on a real page reload (this module gets re-evaluated then), which
// is fine — it's a live editing convenience for the current tab session,
// not data anything needs to persist beyond it. sourceMapId records which
// map the copy was made on, so pasteClipboard can tell a same-map paste
// (anchor near the originals) from a cross-map one (the originals' own
// x/y don't mean anything on a different map — anchor in the current
// viewport instead; see pasteClipboard's own comment).
export let nodeClipboard: { sourceMapId: string; nodes: { text: string; type: NodeType; x: number; y: number }[] } | null =
  null;
export function setNodeClipboard(value: typeof nodeClipboard) {
  nodeClipboard = value;
}

// Low-level seeded-hash primitive shared by this file's own hashOffset,
// NodeCard's flightOffset, and NodeCard's seededRandoms — three independent
// "hash a string into pseudo-random number(s)" implementations used to live
// separately (slightly different mod bases, one returning a single number,
// one an {x,y} pair, one an array of N fracts), which meant three formulas
// to keep straight for what's conceptually the same trick. Consolidated
// here as the one primitive all three now derive from — count independent
// pseudo-random values in [0, 1) from one seed, matching seededRandoms's own
// existing contract exactly (same mod base, same per-index sin/fract
// formula) since that's both the most general of the three (the other two
// each only need a subset of what it already produces) and the one on the
// hottest path (every drifting/chaotic node re-reads it on every render via
// chaosStyle), so its own output for a given seed stays bit-identical to
// before — nothing about which drift waypoints an already-visible node
// picked changes. hashOffset/flightOffset below are reimplemented as thin
// wrappers around this instead of keeping their own separate hash loops;
// their own numeric output for a given seed shifts as a result (different
// mod base than before), which isn't a functional change — same output
// range/shape either way — just a one-time visual reshuffle of exactly
// which offset/flight-direction an existing weapon node's animation seed
// happens to land on, not worth keeping a third formula around to avoid.
export function hashSeed(seed: string, count: number): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 1000003;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const v = Math.sin(h + i * 999.317) * 43758.5453;
    out.push(v - Math.floor(v)); // fract() — always in [0, 1)
  }
  return out;
}

export function hashOffset(seed: string, range: number) {
  const [r] = hashSeed(seed, 1);
  return Math.floor(r * range * 2) - range;
}

// Every node "linked" to anchorId, either by branch lineage (its direct
// parentId children, or its own parentId parent) or by an explicit Edge in
// either direction — the shared union both MapPage's own radial neighbor
// ring (radialPositions) and pack-eligibility (startPackFrom) are built
// from. Kept as a plain function (not a hook) since both call sites derive
// it from data they already have on hand, not from any state of their own.
export function computeLinkedNeighborIds(anchorId: string, nodes: NodeDoc[], edges: EdgeDoc[]): Set<string> {
  const neighborIds = new Set<string>();
  const anchor = nodes.find((n) => n.nodeId === anchorId);
  const ownParentId = anchor ? nodeRefId(anchor.parentId) : undefined;
  if (ownParentId) neighborIds.add(ownParentId);
  for (const n of nodes) {
    if (nodeRefId(n.parentId) === anchorId) neighborIds.add(n.nodeId);
  }
  for (const e of edges) {
    const fromId = nodeRefId(e.fromNodeId);
    const toId = nodeRefId(e.toNodeId);
    if (fromId === anchorId && toId) neighborIds.add(toId);
    if (toId === anchorId && fromId) neighborIds.add(fromId);
  }
  neighborIds.delete(anchorId);
  return neighborIds;
}

// Shared phone-width breakpoint — used to be independently duplicated in
// (at least) this file's own getNodeMinDist, MapPage.tsx, NodePanel.tsx, and
// QuickAddGhosts.tsx; consolidated here as the one place that decides what
// "mobile" means for canvas layout purposes. Read live (not memoized) since
// every call site only cares at the moment something is actually placed/
// rendered, by which point the real viewport width is already known.
export function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= 640;
}

// The widest thing a node draws is its caption — 148px (see NodeCard's
// CAPTION_WIDTH: two rows, each twice as wide as the 74px node itself used
// to allow), not the 74px icon. Freshly-placed nodes are kept at least that
// far apart (plus a margin) so a new node never lands on top of an
// existing one's title, and so the zone drawn through a circle's children
// (see computeNodeGroups) has real room inside it rather than collapsing
// around a tight cluster. This stays one flat minDist for every point
// regardless of which node ends up there (see nodeObstacles' own doc
// comment on why it isn't size-tier-aware) — a circle-parent renders at the
// 130% tier, but the caption width, not the icon, is already the limiting
// footprint, so the same number covers it. The margin shrinks on a phone-
// width viewport: the canvas is the same 2400x1600 regardless of screen
// size, so the same buffer that's comfortable on desktop just means more
// panning/zooming to see fewer nodes at once on mobile.
// Read live (not memoized) since it only matters at the moment a node is
// placed/dragged, by which point the real viewport width is already known.
//
// The margin is a full ~100px on desktop (it was 60): 60 left just enough
// that two titles didn't touch, which still read as crowded — nodes packed
// edge to edge with nothing between them to rest the eye on.
export const CAPTION_WIDTH = 148;
export function getNodeMinDist() {
  return CAPTION_WIDTH + (isMobileViewport() ? 50 : 100);
}

// The rectangle (in canvas coordinates) a placement is allowed to land in —
// defaults to the whole canvas, but every creation/drag path in MapPage is
// handed the currently-scrolled-into-view rectangle instead, so a new or
// dropped node never lands somewhere the user would have to go scroll to
// find.
export interface ViewportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
export const FULL_CANVAS_BOUNDS: ViewportBounds = { minX: 0, minY: 0, maxX: CANVAS_W, maxY: CANVAS_H };

export function pickNonOverlappingPosition(
  existing: { x: number; y: number }[],
  bigObstacles: { x: number; y: number; minDist: number }[] = [],
  bounds: ViewportBounds = FULL_CANVAS_BOUNDS,
): { x: number; y: number } {
  const margin = 120;
  // A viewport narrower/shorter than 2*margin would invert min/max — clamp
  // each pair together so the search range never goes negative-width.
  const minX = Math.min(Math.max(margin, bounds.minX), CANVAS_W - margin);
  const minY = Math.min(Math.max(margin, bounds.minY), CANVAS_H - margin);
  const maxX = Math.max(minX, Math.min(CANVAS_W - margin, bounds.maxX));
  const maxY = Math.max(minY, Math.min(CANVAS_H - margin, bounds.maxY));
  for (let attempt = 0; attempt < 80; attempt++) {
    const x = minX + Math.random() * (maxX - minX);
    const y = minY + Math.random() * (maxY - minY);
    if (
      existing.every((p) => Math.hypot(p.x - x, p.y - y) >= getNodeMinDist()) &&
      bigObstacles.every((p) => Math.hypot(p.x - x, p.y - y) >= p.minDist)
    ) {
      return { x, y };
    }
  }
  // Viewport is crowded enough that 80 random tries never cleared the
  // margin — search outward from its center for a spot that genuinely
  // clears everything (in view first, then anywhere on the canvas) instead
  // of returning a guess that may overlap silently.
  const minDist = getNodeMinDist();
  const obstacles: Obstacle[] = [...existing.map((p) => ({ x: p.x, y: p.y, minDist })), ...bigObstacles];
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const inView = nearestClearSpot(center, obstacles, bounds, margin);
  if (inView.clear) return inView.point;
  const anywhere = nearestClearSpot(center, obstacles, FULL_CANVAS_BOUNDS, margin);
  return anywhere.clear ? anywhere.point : inView.point;
}

// One obstacle to stay clear of — a regular node (minDist ~= its icon
// footprint) or a big group backdrop (minDist ~= its own radius plus a
// node's footprint), so the same nudging loop below handles both.
export interface Obstacle {
  x: number;
  y: number;
  minDist: number;
  // What a node actually draws — its icon plus title, a box centered on x/y.
  // Set for regular nodes only (a zone backdrop is a circle: just minDist).
  // minDist is a *spacing policy* for placing something new (comfortably
  // more than the drawn footprint); findFreeShift, which moves things that
  // already exist, measures real overlap against this instead.
  footprint?: { w: number; h: number };
}

// Icon (48) + gap + a two-row title, roughly — and CAPTION_WIDTH wide.
const NODE_FOOTPRINT = { w: CAPTION_WIDTH, h: 90 };

// Deliberately still one flat minDist for every point, not per-node-size
// aware — every call site today only ever has bare {x,y} points in hand
// (positions.values(), stripped of which node each one came from), not the
// NodeDoc each position belongs to. Making this size-tier-aware for real
// would mean threading node objects (not just positions) through all ~8
// call sites of this function, several of them in already-dense
// paste/group-creation code paths — a real but purely cosmetic refinement
// (a 130% node could in principle still land slightly closer to another
// node than its bigger visual footprint would ideally want), not a
// functional bug, so it's left as a known simplification rather than a
// wider refactor.
export function nodeObstacles(points: { x: number; y: number }[], minDist = getNodeMinDist()): Obstacle[] {
  return points.map((p) => ({ x: p.x, y: p.y, minDist, footprint: NODE_FOOTPRINT }));
}

// Same min/max-pair clamp pickNonOverlappingPosition uses: a too-small
// viewport clamps to its own center line rather than inverting.
function clampIntoBounds(
  p: { x: number; y: number },
  bounds: ViewportBounds,
  margin: number,
): { x: number; y: number } {
  const minX = Math.min(Math.max(margin, bounds.minX), CANVAS_W - margin);
  const minY = Math.min(Math.max(margin, bounds.minY), CANVAS_H - margin);
  const maxX = Math.max(minX, Math.min(CANVAS_W - margin, bounds.maxX));
  const maxY = Math.max(minY, Math.min(CANVAS_H - margin, bounds.maxY));
  return { x: Math.min(maxX, Math.max(minX, p.x)), y: Math.min(maxY, Math.max(minY, p.y)) };
}

function isClearOf(p: { x: number; y: number }, obstacles: Obstacle[]): boolean {
  return obstacles.every((o) => Math.hypot(o.x - p.x, o.y - p.y) >= o.minDist);
}

// Distance to spare past the nearest obstacle's required clearance —
// negative while overlapping, Infinity with nothing in the way.
function clearanceOf(p: { x: number; y: number }, obstacles: Obstacle[]): number {
  let c = Infinity;
  for (const o of obstacles) c = Math.min(c, Math.hypot(o.x - p.x, o.y - p.y) - o.minDist);
  return c;
}

const SEARCH_STEP = 20;

// The nearest position to `desired` (inside `bounds`) that clears every
// obstacle, found by scanning outward in rings — so it's guaranteed clear
// whenever *any* clear spot exists in bounds, unlike nudging away from one
// collision at a time (which can push into the next obstacle, run out of
// retries, or get clamped back into something). `clear: false` means
// nothing in bounds was free; `point` is then the least-bad spot seen (the
// one with the most clearance).
function nearestClearSpot(
  desired: { x: number; y: number },
  obstacles: Obstacle[],
  bounds: ViewportBounds,
  margin: number,
  accept?: (p: { x: number; y: number }) => boolean,
  step = SEARCH_STEP,
  radiusCap = Infinity,
): { point: { x: number; y: number }; clear: boolean } {
  // A spot only counts as clear if it also passes `accept` (a caller's own
  // extra rule — see avoidOverlap).
  const isClear = (p: { x: number; y: number }) => isClearOf(p, obstacles) && (!accept || accept(p));
  const first = clampIntoBounds(desired, bounds, margin);
  if (isClear(first)) return { point: first, clear: true };
  let best = { point: first, clearance: clearanceOf(first, obstacles) };
  // Rings past the farthest corner of the search area only ever re-visit
  // clamped edge points — nothing new to find.
  const lo = clampIntoBounds({ x: -Infinity, y: -Infinity }, bounds, margin);
  const hi = clampIntoBounds({ x: Infinity, y: Infinity }, bounds, margin);
  const maxR =
    Math.max(
      Math.hypot(desired.x - lo.x, desired.y - lo.y),
      Math.hypot(desired.x - hi.x, desired.y - lo.y),
      Math.hypot(desired.x - lo.x, desired.y - hi.y),
      Math.hypot(desired.x - hi.x, desired.y - hi.y),
    ) + step;
  for (let r = step; r <= Math.min(maxR, radiusCap); r += step) {
    const steps = Math.max(16, Math.ceil((2 * Math.PI * r) / step));
    let nearest: { p: { x: number; y: number }; d: number } | null = null;
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      const p = clampIntoBounds({ x: desired.x + r * Math.cos(a), y: desired.y + r * Math.sin(a) }, bounds, margin);
      if (isClear(p)) {
        const d = Math.hypot(p.x - desired.x, p.y - desired.y);
        if (!nearest || d < nearest.d) nearest = { p, d };
      } else {
        const c = clearanceOf(p, obstacles);
        if (c > best.clearance) best = { point: p, clearance: c };
      }
    }
    if (nearest) return { point: nearest.p, clear: true };
  }
  return { point: best.point, clear: false };
}

// Moves a *desired* position to the nearest spot that doesn't overlap
// anything — for placements anchored to something specific (a drag's drop
// point, a quick-add ghost's slot, a weapon node's spot near its target)
// where a random relocation would lose the "why is it here" relationship
// pickNonOverlappingPosition doesn't need to preserve. Obstacles carry
// their own required clearance — a big group backdrop needs far more room
// than a regular node does. Prefers a spot inside `bounds` (the visible
// part of the canvas, so the result is somewhere the user can see); only
// if that's completely full does it look across the whole canvas, because
// landing off-screen is better than landing on top of another node.
//
// `accept` is an optional extra rule a spot must also satisfy (see
// siblingsClearOfCenter) — for constraints that depend on the layout
// *after* the node lands, which static obstacles can't express. It's tried
// everywhere (in view, then across the canvas) before being given up on:
// a spot that's merely clear of every obstacle but breaks `accept` is still
// better than nothing, but not better than a farther one that satisfies it.
export function avoidOverlap(
  desired: { x: number; y: number },
  obstacles: Obstacle[],
  bounds: ViewportBounds = FULL_CANVAS_BOUNDS,
  accept?: (p: { x: number; y: number }) => boolean,
): { x: number; y: number } {
  const margin = 40;
  let fallback: { x: number; y: number } | null = null;
  for (const rule of accept ? [accept, undefined] : [undefined]) {
    const inView = nearestClearSpot(desired, obstacles, bounds, margin, rule);
    if (inView.clear) return inView.point;
    fallback ??= inView.point;
    const anywhere = nearestClearSpot(desired, obstacles, FULL_CANVAS_BOUNDS, margin, rule);
    if (anywhere.clear) return anywhere.point;
    // A rule can leave only a thin sliver of acceptable ground, narrower
    // than the coarse rings above step over — look again, much finer, but
    // only near where the node wanted to be (this is the rare case, so the
    // extra cost doesn't matter, and far-off slivers aren't worth chasing).
    if (rule) {
      const fine = nearestClearSpot(desired, obstacles, FULL_CANVAS_BOUNDS, margin, rule, 5, 450);
      if (fine.clear) return fine.point;
    }
  }
  return fallback!;
}

// A circle's parent is drawn at the center of its children (see
// groupCenter/computeNodeGroups), so adding or moving a child moves the
// parent too — and can drag it right on top of a child that was fine a
// moment ago, if the children pile up on one side. Distance from the parent
// to a child has to leave room for both their icons and their titles (a
// title is CAPTION_WIDTH wide, and the parent's own is the same width, so
// the two only clear each other with more than that between them). It was
// exactly CAPTION_WIDTH; that left the parent and its children visibly
// crowded, so it's a comfortable margin past it now.
export const PARENT_CHILD_MIN_DIST = CAPTION_WIDTH + 55;

// True if, with a child at `p` alongside `siblings` (the parent's other
// children), no child would sit within PARENT_CHILD_MIN_DIST of the circle's
// center — i.e. where the parent would be drawn. With fewer than two
// children there's no circle yet, so nothing to keep clear of.
export function siblingsClearOfCenter(
  siblings: { x: number; y: number }[],
  p: { x: number; y: number },
): boolean {
  const pts = [...siblings, p];
  if (pts.length < 2) return true;
  const c = groupCenter(pts);
  return pts.every((q) => Math.hypot(q.x - c.x, q.y - c.y) >= PARENT_CHILD_MIN_DIST);
}

// The default layout for nodes with no stored x/y — every node a template
// map seeds (see Backend's MAP_TEMPLATES), which deliberately leaves
// geometry to the frontend. `placed` holds every node that already has a
// position (stored x/y); the result adds one for each that doesn't.
//
// Roots (no parent among these nodes) go on a spiral from the canvas center.
// Everything else is laid out from its parent outward: a parent's unplaced
// children sit on an evenly spaced ring around it, so a circle comes out
// with its parent at the actual center (the ring's center is where the
// parent is drawn — see groupCenter) and every child the same distance from
// it. The ring is wide enough for both requirements at once: children at
// least PARENT_CHILD_MIN_DIST from the parent (room for both their titles),
// and neighbors on the ring at least getNodeMinDist() from each other. The
// old default was a sunflower spiral over *all* nodes by index, which put a
// parent's two children ~220px apart with the parent halfway between them —
// about 110px from each, well inside each other's titles.
//
// Each spot is still nudged clear of everything already placed (avoidOverlap),
// so a crowded canvas degrades to a slightly irregular ring rather than an
// overlap. Order is breadth-first, so a parent is always placed before its
// children and a ring always knows which way "outward" is.
export function layoutUnpositioned(
  nodes: NodeDoc[],
  placed: Map<string, { x: number; y: number }>,
): Map<string, { x: number; y: number }> {
  const result = new Map(placed);
  const ids = new Set(nodes.map((n) => n.nodeId));
  const parentOf = (n: NodeDoc) => {
    const id = nodeRefId(n.parentId);
    return id && ids.has(id) ? id : undefined;
  };
  const kids = new Map<string, NodeDoc[]>();
  for (const n of nodes) {
    const p = parentOf(n);
    if (!p) continue;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p)!.push(n);
  }
  const minDist = getNodeMinDist();
  const obstacles = () => nodeObstacles(Array.from(result.values()));
  const center = { x: CANVAS_W / 2, y: CANVAS_H / 2 };

  // Roots first, on a sunflower spiral (nearest neighbor ~ minDist apart).
  let rootIndex = 0;
  for (const n of nodes) {
    if (result.has(n.nodeId) || parentOf(n)) continue;
    const angle = rootIndex * 137.508 * (Math.PI / 180);
    const radius = (minDist / 1.9) * Math.sqrt(rootIndex + 0.5);
    rootIndex++;
    result.set(
      n.nodeId,
      avoidOverlap({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }, obstacles()),
    );
  }

  // Then outward from every node that has a position, breadth-first.
  const queue = nodes.filter((n) => result.has(n.nodeId));
  for (let qi = 0; qi < queue.length; qi++) {
    const parent = queue[qi];
    const todo = (kids.get(parent.nodeId) ?? []).filter((c) => !result.has(c.nodeId));
    if (todo.length === 0) continue;
    const base = result.get(parent.nodeId)!;
    const grandId = parentOf(parent);
    const gp = grandId ? result.get(grandId) : undefined;
    // "Outward" = away from the grandparent, so a ring never opens back onto
    // it; a root has no such direction and opens upward.
    const out = gp ? Math.atan2(base.y - gp.y, base.x - gp.x) : -Math.PI / 2;
    const k = todo.length;
    // Even counts are offset half a step so no child points straight back at
    // the grandparent (odd counts already miss it).
    const start = out + (k % 2 === 0 ? Math.PI / k : 0);
    const radius =
      k === 1
        ? minDist * 1.15
        : Math.max(PARENT_CHILD_MIN_DIST * 1.15, minDist / (2 * Math.sin(Math.PI / k)));

    // Prefer a ring that's clean as a whole — rotated and/or widened until
    // *every* child clears everything already placed — over nudging children
    // one at a time. A whole ring keeps its shape, so its center stays exactly
    // on the parent (which is where the parent is drawn); a ring with
    // individually shoved children has a shifted center, which drags the
    // parent's drawn position toward whatever it was crowding.
    const obs = obstacles();
    const usable = (p: { x: number; y: number }) =>
      p.x >= 40 && p.x <= CANVAS_W - 40 && p.y >= 40 && p.y <= CANVAS_H - 40 && isClearOf(p, obs);
    let ring: { x: number; y: number }[] | null = null;
    if (k === 1) {
      const turns = [0, 25, -25, 50, -50, 75, -75, 100, -100].map((d) => (d * Math.PI) / 180);
      search1: for (const m of [1, 1.25, 1.5, 1.85]) {
        for (const t of turns) {
          const p = { x: base.x + radius * m * Math.cos(out + t), y: base.y + radius * m * Math.sin(out + t) };
          if (usable(p)) {
            ring = [p];
            break search1;
          }
        }
      }
    } else {
      const unit = (Math.PI * 2) / k / 12;
      search: for (const m of [1, 1.15, 1.3, 1.5, 1.75, 2]) {
        for (let i = 0; i < 12; i++) {
          const a0 = start + (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * unit;
          const pts = todo.map((_, j) => {
            const a = a0 + (j / k) * Math.PI * 2;
            return { x: base.x + radius * m * Math.cos(a), y: base.y + radius * m * Math.sin(a) };
          });
          if (pts.every(usable)) {
            ring = pts;
            break search;
          }
        }
      }
    }
    // No clean ring anywhere in range (a crowded canvas): fall back to
    // nudging each child clear of what's there, accepting a lopsided ring.
    todo.forEach((child, j) => {
      const a = k === 1 ? out : start + (j / k) * Math.PI * 2;
      result.set(
        child.nodeId,
        ring
          ? ring[j]
          : avoidOverlap({ x: base.x + radius * Math.cos(a), y: base.y + radius * Math.sin(a) }, obstacles()),
      );
      queue.push(child);
    });
  }

  // Anything still unplaced hangs off a parent chain that never resolved (a
  // cycle, say) — treat it as a root rather than leave it without a position.
  for (const n of nodes) {
    if (result.has(n.nodeId)) continue;
    const angle = rootIndex * 137.508 * (Math.PI / 180);
    const radius = (minDist / 1.9) * Math.sqrt(rootIndex + 0.5);
    rootIndex++;
    result.set(
      n.nodeId,
      avoidOverlap({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }, obstacles()),
    );
  }
  return result;
}

// Moves a whole set of points by the same amount (a dragged circle: its
// parent plus the children carried along, or a multi-selection), choosing
// the shift nearest `desired` that neither leaves the canvas nor makes any
// mover overlap an obstacle *more than it already did*. That last part
// matters: a big circle usually has unrelated nodes already sitting inside
// its area, closer than the minimum spacing before the drag even starts —
// demanding full clearance from those would refuse every nearby shift and
// fling the circle far from the pointer. So an obstacle a mover was already
// too close to is only required not to get any closer; one it was clear of
// has to stay clear. `movers` and `obstacles` must be disjoint — the things
// moving aren't in the way of themselves. When the drop can't be honored
// as-is the group stops as close to it as it can get without making
// anything worse — in the limit, it stays where it was.
export function findFreeShift(
  movers: { x: number; y: number }[],
  desired: { dx: number; dy: number },
  obstacles: Obstacle[],
): { dx: number; dy: number } {
  const margin = 40;
  // How deep `p` is into obstacle `o`: positive means overlapping. A node is
  // measured by what it really draws (its footprint box), a zone by its
  // circle — see Obstacle.footprint for why it isn't minDist here.
  const depth = (o: Obstacle, px: number, py: number) =>
    o.footprint
      ? Math.min(o.footprint.w - Math.abs(o.x - px), o.footprint.h - Math.abs(o.y - py))
      : o.minDist - Math.hypot(o.x - px, o.y - py);
  // How deep each mover starts inside each obstacle — what "no worse" is
  // measured against. Computed once, not per candidate shift.
  const startDepth = movers.map((m) => obstacles.map((o) => depth(o, m.x, m.y)));
  const fits = (dx: number, dy: number) =>
    movers.every((m, i) => {
      const px = m.x + dx;
      const py = m.y + dy;
      if (px < margin || px > CANVAS_W - margin || py < margin || py > CANVAS_H - margin) return false;
      // Not overlapping to begin with -> must stay exactly that (touching is
      // fine). Already overlapping -> may not get deeper (0.5px of slack
      // only there, for rounding).
      return obstacles.every((o, j) => depth(o, px, py) <= (startDepth[i][j] > 0 ? startDepth[i][j] + 0.5 : 0));
    });
  if (fits(desired.dx, desired.dy)) return desired;
  // Slide back along the drag toward "didn't move": the farthest point on
  // the way that fits — the group goes as far as the pointer took it and
  // stops before it would run into something. Not moving at all always fits
  // (nothing gets closer to anything), so this always finds an answer.
  const len = Math.hypot(desired.dx, desired.dy);
  let best = { dx: 0, dy: 0, d: len };
  for (let i = 1; i <= 24; i++) {
    const t = 1 - i / 24;
    const dx = desired.dx * t;
    const dy = desired.dy * t;
    if (fits(dx, dy)) {
      best = { dx, dy, d: (1 - t) * len };
      break;
    }
  }
  // A shift *beside* the drag (around an obstacle rather than short of it)
  // can land nearer the pointer than stopping short does — look for one, but
  // only closer to desired than what the slide already found.
  const step = 30;
  for (let r = step; r < Math.min(900, best.d); r += step) {
    const steps = Math.max(16, Math.ceil((2 * Math.PI * r) / step));
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      const dx = desired.dx + r * Math.cos(a);
      const dy = desired.dy + r * Math.sin(a);
      if (fits(dx, dy)) return { dx, dy };
    }
  }
  return { dx: best.dx, dy: best.dy };
}

// sentimentOf (imported from utils/nodeType.ts) — matches ringKindFor's own
// halo/horns split exactly (see OutcomeBadge.tsx's OUTCOME_CONFIG), so
// whatever ring a node's own badge draws is exactly what its vote counts
// as. Option counts as positive (same halo ring Success/Solution draw), not
// neutral — a zone full of halo Option nodes plus one horns Problem/Fail
// would otherwise have nothing on the positive side of the vote despite
// every visible ring in it saying "positive." "unknown" alone stays
// genuinely neutral — it's the one type with no ring to have voted with.
//
// The same majority vote the big backdrop's halo/horns color already uses —
// root counts as a member like any other. A lone non-neutral root already
// leans a side from the start (majority of one); a tie, or an all-neutral
// circle (pos === neg === 0), gets "neutral" instead — every node with 2+
// children reads as *some* circle now, not just the ones that happen to
// lean a side.
export function circleSentiment(members: NodeDoc[]): Sentiment {
  let pos = 0;
  let neg = 0;
  for (const m of members) {
    const s = sentimentOf(m.type);
    if (s === "positive") pos++;
    else if (s === "negative") neg++;
  }
  if (pos === neg) return "neutral";
  return pos > neg ? "positive" : "negative";
}

// How close a drop has to land to an existing node to read as "onto it"
// (join its circle) instead of just "near it" (a normal reposition) — well
// inside getNodeMinDist()'s smallest value, so a deliberate drop-to-join
// never gets confused with two nodes that simply ended up in the same
// neighborhood.
export const CIRCLE_DROP_RADIUS = 70;

// Would setting candidateId's parentId to ancestorId close a loop? Walks up
// from candidateId's *current* parent chain — if ancestorId is already up
// there, candidateId is one of its descendants, and re-parenting it under
// its own descendant would cut it (and everything under it) off from the
// rest of the tree in a cycle. Capped so a corrupt chain can't loop forever.
export function isDescendant(candidateId: string, ancestorId: string, allNodes: NodeDoc[]): boolean {
  let current = allNodes.find((n) => n.nodeId === candidateId);
  let hops = 0;
  while (current && hops < 50) {
    const parentId = nodeRefId(current.parentId);
    if (!parentId) return false;
    if (parentId === ancestorId) return true;
    current = allNodes.find((n) => n.nodeId === parentId);
    hops++;
  }
  return false;
}

export interface NodeGroup {
  rootId: string;
  members: NodeDoc[];
  sentiment: Sentiment;
  cx: number;
  cy: number;
  r: number;
  outline: { x: number; y: number }[];
}

// The smallest a zone is allowed to get, measured from its center. A tight
// cluster (nodes are normally placed >= getNodeMinDist() apart, so this is
// rare) would otherwise make a zone that sits almost entirely under its own
// nodes, leaving nothing to click.
const ZONE_MIN_RADIUS = 120;
// How many segments approximate the circular zone (see computeNodeGroups).
// Enough that the stroke reads as smooth, not as a polygon with corners.
const ZONE_CIRCLE_STEPS = 48;

// Andrew's monotone chain — returns the hull in order around its boundary,
// which is exactly what a polygon's `points` needs (no separate angle sort).
function convexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
  const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length <= 2) return pts;
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: { x: number; y: number }[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: { x: number; y: number }[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

// The point a circle's parent is drawn at: the center of the zone around its
// children, as it *looks* — the area centroid of the polygon they form, not
// the plain average of their positions. The average is pulled toward
// wherever children happen to bunch up (a cluster on one side, or children
// sitting inside the polygon rather than on its border), which left the
// parent visibly off to one side of its own zone; the area centroid only
// depends on the shape, so it lands in the middle of what's drawn. Two
// children (a line), or anything too degenerate to have an area, fall back
// to the average — for two children, their midpoint.
export function groupCenter(points: { x: number; y: number }[]): { x: number; y: number } {
  const mean = () => ({
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  });
  if (points.length < 3) return mean();
  const hull = convexHull(points);
  if (hull.length < 3) return mean();
  let area2 = 0; // twice the signed area
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const cross = a.x * b.y - b.x * a.y;
    area2 += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area2) < 1) return mean();
  return { x: cx / (3 * area2), y: cy / (3 * area2) };
}

// Any node with 2+ direct parentId-children reads as a group ("circle") —
// general on purpose, same as computeLinkCycles below: this fires whether
// the star came from dragging one node onto another or just from branching
// off the same node several times over. Built from visibleNodes (a packed-
// away member shouldn't still read as a circle child on the canvas it no
// longer appears on), but resolves each root against the full `allNodes`
// list — a root can be visible via its children even if something unusual
// hid the root node itself.
//
// The zone is built around the *children*, with the root as its center: cx/
// cy is groupCenter of the children (MapPage's posFor renders the root
// there, regardless of its own stored x/y), and the children are measured
// where they're drawn — a child that's itself a circle's root sits at its
// own zone's center, not its stored x/y. With 3+ children the outline is
// the convex hull of the children themselves — they sit on the zone's
// border, as its corners, and every corner is a node (never a corner with
// nothing at it). Anything that can't be a polygon of nodes — two children
// (or a collinear set) make a line, and a cluster tighter than
// ZONE_MIN_RADIUS would be a sliver under its own nodes — is a circle
// around the center instead: no corners at all, so none can be empty.
// Members still include the root (for the sentiment vote and callers that
// treat it as part of the group), it just doesn't shape the outline.
export function computeNodeGroups(
  visibleNodes: NodeDoc[],
  allNodes: NodeDoc[],
  positions: Map<string, { x: number; y: number }>,
): NodeGroup[] {
  const childrenByParent = new Map<string, NodeDoc[]>();
  for (const n of visibleNodes) {
    const parentId = nodeRefId(n.parentId);
    if (!parentId) continue;
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId)!.push(n);
  }
  // Every circle root, with its children — the nodes whose drawn position is
  // *derived* (the center of their own zone) rather than their stored x/y.
  const circleChildren = new Map<string, NodeDoc[]>();
  for (const [rootId, children] of childrenByParent) {
    if (children.length >= 2 && allNodes.some((n) => n.nodeId === rootId)) circleChildren.set(rootId, children);
  }
  // Where a node is actually drawn. A child can itself be the root of a
  // circle, and then it's drawn at *its* zone's center — so its parent's
  // zone has to run through that point, not the child's stored x/y, or the
  // corner it draws would have no node at it. Resolved from the leaves up
  // (memoized; `resolving` guards the impossible parent cycle).
  const centers = new Map<string, { x: number; y: number }>();
  const resolving = new Set<string>();
  const storedPos = (id: string) => positions.get(id) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 };
  const drawnPos = (id: string): { x: number; y: number } => {
    if (!circleChildren.has(id)) return storedPos(id);
    const known = centers.get(id);
    if (known) return known;
    if (resolving.has(id)) return storedPos(id);
    resolving.add(id);
    const center = groupCenter(circleChildren.get(id)!.map((c) => drawnPos(c.nodeId)));
    resolving.delete(id);
    centers.set(id, center);
    return center;
  };
  const groups: NodeGroup[] = [];
  for (const [rootId, children] of circleChildren) {
    const root = allNodes.find((n) => n.nodeId === rootId)!;
    const members = [root, ...children];
    const sentiment = circleSentiment(members);
    const childPts = children.map((n) => drawnPos(n.nodeId));
    const { x: cx, y: cy } = drawnPos(rootId);
    const reach = Math.max(...childPts.map((p) => Math.hypot(p.x - cx, p.y - cy)));
    const hull = convexHull(childPts);
    let outline: { x: number; y: number }[];
    if (hull.length >= 3 && reach >= ZONE_MIN_RADIUS) {
      outline = hull;
    } else {
      // Radius = how far the children actually reach (so with two children
      // they sit right on the circle), never below the minimum size.
      const radius = Math.max(reach, ZONE_MIN_RADIUS);
      outline = Array.from({ length: ZONE_CIRCLE_STEPS }, (_, k) => {
        const a = (k / ZONE_CIRCLE_STEPS) * Math.PI * 2;
        return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
      });
    }
    // +70: the outline runs through the children's own centers, so this is
    // the clearance past them (a node's own footprint, plus some) that
    // callers — obstacle avoidance, "dragged clear of its circle" — treat
    // as still being part of the zone.
    const r = Math.max(...outline.map((p) => Math.hypot(p.x - cx, p.y - cy))) + 70;
    groups.push({ rootId, members, sentiment, cx, cy, r, outline });
  }
  return groups;
}

// Any closed loop in the Link graph (not branch-arrows, not weapon marks —
// specifically Edge documents "Link nodes" creates) reads as a "figure" and
// gets colored in; a simple two-node link never can, there's nothing to
// close. General on purpose: fires whether the loop was made in one
// multi-select or pieced together one link at a time. DFS over an
// undirected adjacency, capped on both search depth and result count so a
// pathologically dense graph can't make this expensive. Moved out of
// MapPage.tsx unchanged — see MapPage's own `linkCycles` useMemo, which now
// just wraps this.
export function computeLinkCycles(edges: EdgeDoc[]): string[][] {
  if (edges.length > 120) return [];
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    const a = nodeRefId(edge.fromNodeId);
    const b = nodeRefId(edge.toNodeId);
    if (!a || !b || a === b) continue;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  }

  const MAX_CYCLE_LEN = 6;
  const MAX_CYCLES = 24;
  const found: string[][] = [];
  const seenKeys = new Set<string>();

  function dfs(start: string, current: string, path: string[], visiting: Set<string>) {
    if (found.length >= MAX_CYCLES || path.length > MAX_CYCLE_LEN) return;
    for (const next of adjacency.get(current) ?? []) {
      if (found.length >= MAX_CYCLES) return;
      if (next === start && path.length >= 3) {
        const key = [...path].sort().join(",");
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          found.push([...path]);
        }
        continue;
      }
      if (visiting.has(next)) continue;
      visiting.add(next);
      path.push(next);
      dfs(start, next, path, visiting);
      path.pop();
      visiting.delete(next);
    }
  }

  for (const start of adjacency.keys()) {
    if (found.length >= MAX_CYCLES) break;
    dfs(start, start, [start], new Set([start]));
  }
  return found;
}
