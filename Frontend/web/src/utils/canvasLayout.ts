// Pure, stateless canvas-geometry helpers: placement math, obstacle-
// avoidance, and a couple of small pure predicates, none of which touch
// React state/refs/closures — just plain inputs to plain outputs. Kept
// separate from MapPage.tsx so that component stays just the component and
// its own state/handlers.
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

// How much of the screen's height NodePanel/PackPickerPanel's bottom sheet
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

// Low-level seeded-hash primitive shared by this file's own hashOffset,
// NodeCard's flightOffset, and NodeCard's seededRandoms — three call sites
// that would otherwise each need their own "hash a string into pseudo-random
// number(s)" formula (slightly different mod bases, one returning a single
// number, one an {x,y} pair, one an array of N fracts) for what's
// conceptually the same trick. This is the one primitive all three derive
// from — count independent pseudo-random values in [0, 1) from one seed,
// matching seededRandoms's own contract exactly (same mod base, same
// per-index sin/fract formula) since that's both the most general of the
// three (the other two each only need a subset of what it already produces)
// and the one on the hottest path (every drifting/chaotic node re-reads it
// on every render via chaosStyle). hashOffset/flightOffset below are thin
// wrappers around this rather than keeping their own separate hash loops;
// their numeric output for a given seed follows this shared mod base rather
// than a formula tuned to each call site individually — same output
// range/shape either way, just not necessarily the identical offset/
// flight-direction a bespoke formula would happen to produce for that seed.
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

// Shared phone-width breakpoint — the one place that decides what "mobile"
// means for canvas layout purposes, rather than this file's own
// getNodeMinDist, MapPage.tsx, NodePanel.tsx, and QuickAddGhosts.tsx each
// duplicating the same check independently. Read live (not memoized) since
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

// One obstacle to stay clear of. Two kinds, told apart by `footprint`:
//
//  - Spacing (no footprint): a circle of radius `minDist` — how far apart
//    things are *placed* on purpose (getNodeMinDist() for a node, or a
//    zone's own radius plus some). Comfortably more than the drawn size, so
//    a new node has breathing room. For placements the app chooses itself.
//  - Footprint: a box (`w` x `h`) centered on x/y — what a node really draws,
//    its icon plus a two-row title. For placements the *user* chose (a drop,
//    a quick-add ghost's slot, a right-click): the node should land where
//    they pointed, and only move if it would visibly cover another node — and
//    then only by the little needed to clear it. Holding those to the wide
//    spacing circle instead sent a drop up to a full node-spacing away from
//    the pointer, which read as "I can't tell where my node will end up".
export interface Obstacle {
  x: number;
  y: number;
  minDist: number;
  footprint?: { w: number; h: number };
}

// Icon (48) + gap + a two-row title, roughly — and CAPTION_WIDTH wide.
const NODE_FOOTPRINT = { w: CAPTION_WIDTH, h: 90 };

// Spacing obstacles, one per point — see Obstacle. Deliberately one flat
// minDist for every point, not per-node-size aware — every call site only
// has bare {x,y} points in hand (stripped of which node each one came from),
// and the caption width, not the icon, is already the limiting footprint.
export function nodeObstacles(points: { x: number; y: number }[], minDist = getNodeMinDist()): Obstacle[] {
  return points.map((p) => ({ x: p.x, y: p.y, minDist }));
}

// Footprint obstacles, one per point — see Obstacle.
export function footprintObstacles(points: { x: number; y: number }[]): Obstacle[] {
  return points.map((p) => ({ x: p.x, y: p.y, minDist: 0, footprint: NODE_FOOTPRINT }));
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

// How deep `p` is into obstacle `o`: positive means overlapping, and it's
// the distance you'd have to move to get out along the shortest way.
function depthInto(o: Obstacle, p: { x: number; y: number }): number {
  return o.footprint
    ? Math.min(o.footprint.w - Math.abs(o.x - p.x), o.footprint.h - Math.abs(o.y - p.y))
    : o.minDist - Math.hypot(o.x - p.x, o.y - p.y);
}

function isClearOf(p: { x: number; y: number }, obstacles: Obstacle[]): boolean {
  return obstacles.every((o) => depthInto(o, p) <= 0);
}

// A zone's corners are its members, so a member placed almost in line with
// two others pinches one of them into a sliver. No corner of a zone may be
// tighter than this.
export const MIN_ZONE_ANGLE = 30;

type Pt = { x: number; y: number };

// Sharpest corner (in degrees) of the zone polygon through `points` — the
// same outline computeNodeGroups draws: members sorted by angle around their
// centroid. Only convex corners can be sharp (a reflex corner's interior
// angle is past 180), so those are the ones measured. Infinity below 3 points.
export function minZoneCorner(points: Pt[]): number {
  if (points.length < 3) return Infinity;
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const ring = points.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  // Shoelace sign = winding direction, to tell convex corners from reflex ones.
  let area2 = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  let min = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const prev = ring[(i + ring.length - 1) % ring.length];
    const v = ring[i];
    const next = ring[(i + 1) % ring.length];
    const ax = prev.x - v.x;
    const ay = prev.y - v.y;
    const bx = next.x - v.x;
    const by = next.y - v.y;
    const lenProduct = Math.hypot(ax, ay) * Math.hypot(bx, by);
    if (lenProduct === 0) continue;
    const turn = (v.x - prev.x) * (next.y - v.y) - (v.y - prev.y) * (next.x - v.x);
    if (turn * area2 < 0) continue; // reflex corner
    const angle = (Math.acos(Math.min(1, Math.max(-1, (ax * bx + ay * by) / lenProduct))) * 180) / Math.PI;
    min = Math.min(min, angle);
  }
  return min;
}

// Would `parentId`'s zone be left with a corner tighter than MIN_ZONE_ANGLE if
// `leavingId` stopped being one of its members? A zone that was already that
// tight is only refused further pinching, so a node can still leave a zone
// that was cramped before it did anything.
export function leavingPinchesZone(
  leavingId: string,
  parentId: string,
  visibleNodes: NodeDoc[],
  positions: Map<string, Pt>,
): boolean {
  const at = (id: string) => positions.get(id) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 };
  const all = visibleNodes.filter((n) => nodeRefId(n.parentId) === parentId);
  const rest = all.filter((n) => n.nodeId !== leavingId);
  if (rest.length < 2) return false; // no zone left to pinch
  const corner = (kids: NodeDoc[]) => minZoneCorner([at(parentId), ...kids.map((n) => at(n.nodeId))]);
  const after = corner(rest);
  return after < MIN_ZONE_ANGLE && after < corner(all);
}

// Does putting node `nodeId` at a candidate spot keep every zone it belongs to
// at MIN_ZONE_ANGLE or wider? `parentId` is the parent it will have after the
// move (null for none) — a zone forms around that parent once the node is its
// second child — and the node is also the root of its own zone if it has 2+
// children. `nodeId` need not exist yet (a node about to be created). Returns
// undefined when no zone is involved, so there is nothing to check.
export function zoneAngleGuard(
  nodeId: string,
  parentId: string | null,
  visibleNodes: NodeDoc[],
  positions: Map<string, Pt>,
): ((p: Pt) => boolean) | undefined {
  const at = (id: string) => positions.get(id) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 };
  const zones: Pt[][] = [];
  if (parentId) {
    const siblings = visibleNodes.filter((n) => n.nodeId !== nodeId && nodeRefId(n.parentId) === parentId);
    if (siblings.length >= 1) zones.push([at(parentId), ...siblings.map((n) => at(n.nodeId))]);
  }
  const kids = visibleNodes.filter((n) => n.nodeId !== nodeId && nodeRefId(n.parentId) === nodeId);
  if (kids.length >= 2) zones.push(kids.map((n) => at(n.nodeId)));
  if (zones.length === 0) return undefined;
  return (p) => zones.every((fixed) => minZoneCorner([p, ...fixed]) >= MIN_ZONE_ANGLE);
}

// Distance to spare past the nearest obstacle — negative while overlapping,
// Infinity with nothing in the way.
function clearanceOf(p: { x: number; y: number }, obstacles: Obstacle[]): number {
  let c = Infinity;
  for (const o of obstacles) c = Math.min(c, -depthInto(o, p));
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
  accept?: (p: Pt) => boolean,
): { point: { x: number; y: number }; clear: boolean } {
  const ok = (p: Pt) => isClearOf(p, obstacles) && (!accept || accept(p));
  const first = clampIntoBounds(desired, bounds, margin);
  if (ok(first)) return { point: first, clear: true };
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
    ) + SEARCH_STEP;
  for (let r = SEARCH_STEP; r <= maxR; r += SEARCH_STEP) {
    const steps = Math.max(16, Math.ceil((2 * Math.PI * r) / SEARCH_STEP));
    let nearest: { p: { x: number; y: number }; d: number } | null = null;
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      const p = clampIntoBounds({ x: desired.x + r * Math.cos(a), y: desired.y + r * Math.sin(a) }, bounds, margin);
      if (ok(p)) {
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
// pickNonOverlappingPosition doesn't need to preserve. Which kind of
// obstacle it's handed (see Obstacle) decides how far that can be: footprint
// obstacles only ever move a spot a little, spacing ones can move it further.
// Prefers a spot inside `bounds` (the visible part of the canvas, so the
// result is somewhere the user can see); only if that's completely full does
// it look across the whole canvas, because landing off-screen is better than
// landing on top of another node.
//
// `accept` adds a condition on the spot itself (see zoneAngleGuard). It is
// held to as long as any spot satisfies it; if none does, it's dropped rather
// than leaving the node with nowhere to go.
export function avoidOverlap(
  desired: { x: number; y: number },
  obstacles: Obstacle[],
  bounds: ViewportBounds = FULL_CANVAS_BOUNDS,
  accept?: (p: Pt) => boolean,
): { x: number; y: number } {
  const margin = 40;
  const inView = nearestClearSpot(desired, obstacles, bounds, margin, accept);
  if (inView.clear) return inView.point;
  const anywhere = nearestClearSpot(desired, obstacles, FULL_CANVAS_BOUNDS, margin, accept);
  if (anywhere.clear) return anywhere.point;
  return accept ? avoidOverlap(desired, obstacles, bounds) : inView.point;
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

// Any node with 2+ direct parentId-children reads as a group ("circle") —
// general on purpose, same as computeLinkCycles below: this fires whether
// the star came from dragging one node onto another or just from branching
// off the same node several times over. Built from visibleNodes (a packed-
// away member shouldn't still read as a circle child on the canvas it no
// longer appears on), but resolves each root against the full `allNodes`
// list — a root can be visible via its children even if something unusual
// hid the root node itself.
//
// The zone is the polygon through every member — the root and each child at
// its own stored position, sorted by angle around their centroid so
// connecting them in order traces a simple (non-self-crossing) outline: a
// triangle at the 3-member minimum, growing to a quad/pentagon/… as the
// group grows. Every corner is a member, and nothing is derived or moved:
// each node is drawn exactly where it is, root included.
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
  const groups: NodeGroup[] = [];
  for (const [rootId, children] of childrenByParent) {
    if (children.length < 2) continue;
    const root = allNodes.find((n) => n.nodeId === rootId);
    if (!root) continue;
    const members = [root, ...children];
    const sentiment = circleSentiment(members);
    const pts = members.map((n) => positions.get(n.nodeId) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 });
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    // +70: the outline runs through the members' own centers, so this is the
    // clearance past them (a node's own footprint, plus some) that callers —
    // obstacle avoidance, "dragged clear of its circle" — treat as still
    // being part of the zone.
    const r = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.y - cy))) + 70;
    const outline = pts
      .slice()
      .sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
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
