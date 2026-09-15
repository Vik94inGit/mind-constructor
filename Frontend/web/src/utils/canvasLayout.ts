// Pure, stateless canvas-geometry helpers previously living at module scope
// inside MapPage.tsx — placement math, obstacle-avoidance, and a couple of
// small pure predicates none of which touch React state/refs/closures at
// all, just plain inputs to plain outputs. Pulled out here so MapPage.tsx
// itself (which was pushing 3,500 lines) is just the component and its own
// state/handlers; nothing here changed behavior, only location.
import { nodeRefId, sentimentOf } from "./nodeType";
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
// sheet worth reading needs more of it, so it gets 2/3 instead, leaving
// exactly the top third clear (still enough room for the chosen node and
// its ghosts to land somewhere reachable above the sheet).
export function panelReserveFrac(isMobile: boolean) {
  return isMobile ? 2 / 3 : 1 / 3;
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

export function hashOffset(seed: string, range: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 10007;
  return (h % (range * 2)) - range;
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

// Node icons are 74px wide (icon + caption — 0.8x the original 92px, per
// the node-size -20% resize) — keep freshly-placed nodes at least that far
// apart (plus a visible margin) so a new node never lands on top of an
// existing one. The margin shrinks on a phone-width viewport: the canvas is
// the same 2400x1600 regardless of screen size, so the same 50px buffer
// that's comfortable on desktop just means more panning/zooming to see
// fewer nodes at once on mobile — the 74px icon footprint itself is the one
// part of this that can't shrink without nodes actually overlapping.
// Read live (not memoized) since it only matters at the moment a node is
// placed/dragged, by which point the real viewport width is already known.
export function getNodeMinDist() {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;
  return 74 + (isMobile ? 20 : 50);
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
  // margin — fall back to the same growing-radius spiral used for nodes
  // with no x/y at all, so placement still terminates instead of
  // overlapping silently, clamped into view rather than the full canvas.
  const angle = existing.length * 137.508 * (Math.PI / 180);
  const radius = 90 + existing.length * 26;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    x: Math.min(maxX, Math.max(minX, cx + radius * Math.cos(angle))),
    y: Math.min(maxY, Math.max(minY, cy + radius * Math.sin(angle))),
  };
}

// One obstacle to stay clear of — a regular node (minDist ~= its icon
// footprint) or a big group backdrop (minDist ~= its own radius plus a
// node's footprint), so the same nudging loop below handles both.
export interface Obstacle {
  x: number;
  y: number;
  minDist: number;
}

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
  return points.map((p) => ({ x: p.x, y: p.y, minDist }));
}

// Nudges a *desired* position away from whatever it's currently on top of,
// instead of picking a fresh spot at random — for placements anchored to
// something specific (a drag's drop point, a quick-add ghost's slot, a
// weapon node's spot near its target) where a random relocation would lose
// the "why is it here" relationship pickNonOverlappingPosition doesn't need
// to preserve. Each retry pushes further along the same line away from
// whatever it's still colliding with, so it converges instead of orbiting.
// Obstacles carry their own required clearance — a big group backdrop
// needs far more room than a regular node does.
export function avoidOverlap(
  desired: { x: number; y: number },
  obstacles: Obstacle[],
  bounds: ViewportBounds = FULL_CANVAS_BOUNDS,
): { x: number; y: number } {
  let { x, y } = desired;
  const margin = 40;
  for (let attempt = 0; attempt < 24; attempt++) {
    const collision = obstacles.find((p) => Math.hypot(p.x - x, p.y - y) < p.minDist);
    if (!collision) break;
    const dist = Math.hypot(x - collision.x, y - collision.y);
    const angle = dist > 0.5 ? Math.atan2(y - collision.y, x - collision.x) : attempt * 0.9;
    const push = collision.minDist - dist + 6;
    x += Math.cos(angle) * push;
    y += Math.sin(angle) * push;
  }
  // Same min/max-pair clamp as pickNonOverlappingPosition: a too-small
  // viewport clamps to its own center line rather than inverting.
  const minX = Math.min(Math.max(margin, bounds.minX), CANVAS_W - margin);
  const minY = Math.min(Math.max(margin, bounds.minY), CANVAS_H - margin);
  const maxX = Math.max(minX, Math.min(CANVAS_W - margin, bounds.maxX));
  const maxY = Math.max(minY, Math.min(CANVAS_H - margin, bounds.maxY));
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
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
// A circle's own filter, and the same majority vote the big backdrop's
// halo/horns color already uses — root counts as a member like any other.
// A lone non-neutral root already leans a side from the start (majority of
// one); a tie, or an all-neutral circle, stays uncommitted (null) and
// filters nothing yet.
export function circleSentiment(members: NodeDoc[]): "positive" | "negative" | null {
  let pos = 0;
  let neg = 0;
  for (const m of members) {
    const s = sentimentOf(m.type);
    if (s === "positive") pos++;
    else if (s === "negative") neg++;
  }
  if (pos === neg) return null;
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
