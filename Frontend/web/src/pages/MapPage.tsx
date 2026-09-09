import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import * as mapsApi from "../api/maps";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import { ApiRequestError } from "../api/client";
import { getSocket, joinMap, leaveMap } from "../api/socket";
import { useAuth } from "../context/AuthContext";
import { NodeCard } from "../map/NodeCard";
import { NodePanel } from "../map/NodePanel";
import { LinkPickerPanel } from "../map/LinkPickerPanel";
import { PackPickerPanel } from "../map/PackPickerPanel";
import { PendingNodeCard } from "../map/PendingNodeCard";
import { CreateEdgeModal } from "../map/CreateEdgeModal";
import { QuickAddGhosts } from "../map/QuickAddGhosts";
import { NodeContextMenu } from "../map/NodeContextMenu";
import { CanvasContextMenu } from "../map/CanvasContextMenu";
import { AddMenu } from "../map/AddMenu";
import { SelectionMenu } from "../map/SelectionMenu";
import { MiniMap } from "../map/MiniMap";
import { WeaponMark } from "../map/WeaponMark";
import { ShieldMark } from "../map/ShieldMark";
import { ringKindFor } from "../map/OutcomeBadge";
import { InviteMemberModal } from "../components/InviteMemberModal";
import { Modal } from "../components/Modal";
import { idOf, nodeRefId, ZONE_COLORS } from "../utils/nodeType";
import { NodeTypeIcon } from "../map/NodeTypeIcon";
import { NODE_TYPES } from "../types";
import type { AttackIndicator, EdgeDoc, MapDoc, NodeDoc, NodeType, SelectedCircle } from "../types";

const CANVAS_W = 2400;
const CANVAS_H = 1600;

// Canvas zoom bounds/step — see the zoom state and zoomAt() below. 0.5x
// still leaves individual node captions legible; 2.5x is plenty for
// picking out detail in a crowded circle without the canvas's own
// 2400x1600 bound making a fully-zoomed-out view pointless.
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.35;

// How much of the screen's height NodePanel/LinkPickerPanel's bottom sheet
// is allowed to cover, on any device — kept in one place so centerOnNode
// (which reserves this much space when parking the chosen node) and
// viewportBounds (which reserves the same strip when clamping where a new
// node/ghost is allowed to land) can never drift out of sync with each
// other, or with the sheet's own max-height (see NodePanel's PANEL_CLASS).
// A phone's short viewport is what actually makes a mismatch here bite: on
// desktop there's plenty of headroom above even a generous sheet, but on a
// phone the old 75dvh sheet against a 40%-reserve camera left the just-
// selected node (and its quick-add ghosts) parked behind the sheet more
// often than not, and made every *other* node in that bottom third
// physically untappable — the sheet is opaque and sits above every node in
// z-index, so a tap there never reaches the canvas at all. 1/3 leaves two
// full thirds of the screen clear for the canvas.
const PANEL_RESERVE_FRAC = 1 / 3;

// Node copy/paste clipboard (see copySelection/pasteClipboard below) —
// deliberately module-level, not component state/a ref inside MapPage.
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
let nodeClipboard: { sourceMapId: string; nodes: { text: string; type: NodeType; x: number; y: number }[] } | null = null;

function hashOffset(seed: string, range: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 10007;
  return (h % (range * 2)) - range;
}

// Every node "linked" to anchorId, either by branch lineage (its direct
// parentId children, or its own parentId parent) or by an explicit Edge in
// either direction — the shared union both the radial neighbor ring
// (radialPositions below) and pack-eligibility (startPackFrom) are built
// from. Kept as a plain function (not a hook) since both call sites derive
// it from data they already have on hand, not from any state of their own.
function computeLinkedNeighborIds(anchorId: string, nodes: NodeDoc[], edges: EdgeDoc[]): Set<string> {
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
function getNodeMinDist() {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;
  return 74 + (isMobile ? 20 : 50);
}

// The rectangle (in canvas coordinates) a placement is allowed to land in —
// defaults to the whole canvas, but every creation/drag path below is handed
// the currently-scrolled-into-view rectangle instead, so a new or dropped
// node never lands somewhere the user would have to go scroll to find.
interface ViewportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
const FULL_CANVAS_BOUNDS: ViewportBounds = { minX: 0, minY: 0, maxX: CANVAS_W, maxY: CANVAS_H };

function pickNonOverlappingPosition(
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
interface Obstacle {
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
function nodeObstacles(points: { x: number; y: number }[], minDist = getNodeMinDist()): Obstacle[] {
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
function avoidOverlap(
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

// Which node types read as "positive"/"negative" for group-majority
// purposes — matches ringKindFor's own halo/horns split exactly (see
// OutcomeBadge.tsx's OUTCOME_CONFIG), so whatever ring a node's own badge
// draws is exactly what its vote counts as. Option used to be left out of
// this (neutral, like "unknown") even though it draws the same halo ring
// Success/Solution do — a zone full of halo Option nodes plus one horns
// Problem/Fail then had nothing on the positive side of the vote at all,
// so it read as negative-majority despite every visible ring in it saying
// "positive." "unknown" alone stays genuinely neutral — it's the one type
// with no ring to have voted with in the first place.
const POSITIVE_TYPES = new Set<NodeType>(["Success", "Solution", "Option"]);
const NEGATIVE_TYPES = new Set<NodeType>(["Fail", "Problem", "Problematic option"]);

function sentimentOf(type: NodeType): "positive" | "negative" | null {
  if (POSITIVE_TYPES.has(type)) return "positive";
  if (NEGATIVE_TYPES.has(type)) return "negative";
  return null;
}

// A circle's own filter, and the same majority vote the big backdrop's
// halo/horns color already uses — root counts as a member like any other.
// A lone non-neutral root already leans a side from the start (majority of
// one); a tie, or an all-neutral circle, stays uncommitted (null) and
// filters nothing yet.
function circleSentiment(members: NodeDoc[]): "positive" | "negative" | null {
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
const CIRCLE_DROP_RADIUS = 70;
// Root + up to this many children — the cap on how big a circle can grow
// via drag-to-join.
const CIRCLE_MAX_CHILDREN = 6;

// Would setting candidateId's parentId to ancestorId close a loop? Walks up
// from candidateId's *current* parent chain — if ancestorId is already up
// there, candidateId is one of its descendants, and re-parenting it under
// its own descendant would cut it (and everything under it) off from the
// rest of the tree in a cycle. Capped so a corrupt chain can't loop forever.
function isDescendant(candidateId: string, ancestorId: string, allNodes: NodeDoc[]): boolean {
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


export function MapPage() {
  const { mapId } = useParams<{ mapId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [map, setMap] = useState<MapDoc | null>(null);
  const [nodes, setNodes] = useState<NodeDoc[]>([]);
  const [edges, setEdges] = useState<EdgeDoc[]>([]);
  const [indicators, setIndicators] = useState<AttackIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  // Ordered picks for the link-mode multi-select — 2 nodes finishes as a
  // single edge (a line); 3+ finishes as a closed loop (every consecutive
  // pair plus one closing the last node back to the first), which is what
  // the cycle detector below then colors as a figure.
  const [linkSelection, setLinkSelection] = useState<string[]>([]);
  const [pendingLink, setPendingLink] = useState<NodeDoc[] | null>(null);
  // Separate from `error` on purpose — `error` drives the full-page failure
  // view below (map failed to load), so reusing it for "you picked an
  // invalid link target" replaced the whole canvas with an error screen.
  const [linkError, setLinkError] = useState<string | null>(null);
  // Pack mode: same shape as link mode above, just for "which linked/
  // branched nodes should fold into packContainerId" instead of "which
  // nodes should this edge connect." packContainerId is fixed for the
  // whole pick (unlike link mode, which has no anchor), so this doesn't
  // need its own ordered-list-of-endpoints reasoning — just a Set of picks.
  const [packMode, setPackMode] = useState(false);
  const [packContainerId, setPackContainerId] = useState<string | null>(null);
  const [packSelection, setPackSelection] = useState<Set<string>>(new Set());
  const [packError, setPackError] = useState<string | null>(null);
  // Same reasoning, generalized: every other per-action failure (a failed
  // update/delete/create/circle-join) used to call setError too,
  // which meant so much as a rejected drag-to-join-circle nuked the whole
  // canvas behind a "map not found"-style screen. This is the one place
  // those land instead — a dismissible banner over the still-live canvas.
  const [actionError, setActionError] = useState<string | null>(null);

  // A node not yet created — its text is still being typed into the inline
  // input hovering at (x,y), styled with `type`'s icon. Nothing is sent to
  // the backend until that input confirms with real text (see
  // PendingNodeCard/confirmPendingCreate). parentId set only when reached
  // via the right-click menu's "Create branch" or a quick-add ghost; null
  // (the toolbar's own "+ Add node" button) means a regular, parent-less
  // node.
  const [pendingCreate, setPendingCreate] = useState<{
    x: number;
    y: number;
    type: NodeType;
    parentId: string | null;
  } | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  // The old top toolbar (name, member count, Link/Add/Invite/color/
  // discussion-mode…) is gone — replaced by a small floating "+" menu
  // stacked with the minimap/zoom-controls cluster (see the JSX below).
  // showAddMenu/showNodeTypesLegend are that menu's own open/closed state.
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showNodeTypesLegend, setShowNodeTypesLegend] = useState(false);
  // The multi-select pill's own "Actions" dropdown (see SelectionMenu) —
  // Copy/Group into circle/Delete for the current multiSelectIds.
  const [showSelectionMenu, setShowSelectionMenu] = useState(false);
  const [celebrateIds, setCelebrateIds] = useState<Set<string>>(new Set());
  // Which weapon just had its arrows re-fired — set by clicking either end
  // of an attack (see handleNodeClick/triggerWeaponShot below), cleared
  // once the flight's had time to finish. `nonce` is what actually reaches
  // WeaponMark as replayNonce: a plain boolean/id wouldn't force a second
  // flight if you click the same weapon twice in a row, since nothing
  // about the value would have changed the second time.
  const [shotState, setShotState] = useState<{ id: string; nonce: number } | null>(null);
  const shotTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Gates the quick-add ghost ring and the radial neighbor layout (see
  // quickAddActive/radialPositions below) — false for a beat right after
  // centerOnNode starts a pan, true once it's had time to land. Without
  // this, choosing a node fanned its ghosts/neighbors out immediately,
  // which — while the camera was still smoothly panning to center that
  // node — read as the whole ring sliding across the screen mid-pan rather
  // than fanning out around a node that's already settled in the middle.
  // Starts true: nothing's panning before the first selection ever happens.
  const [selectionSettled, setSelectionSettled] = useState(true);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contextMenu, setContextMenu] = useState<{ node: NodeDoc; x: number; y: number } | null>(null);
  // Right-click on *empty* canvas (as opposed to a node — see contextMenu
  // above) — opens a small type-picker for creating a new, parent-less
  // node right where the click landed. Carries both coordinate spaces:
  // screenX/screenY position the fixed-to-viewport menu itself (same as
  // contextMenu's own x/y), canvasX/canvasY (run through screenToCanvas)
  // are where the eventual node actually gets placed.
  const [canvasContextMenu, setCanvasContextMenu] = useState<{
    screenX: number;
    screenY: number;
    canvasX: number;
    canvasY: number;
  } | null>(null);
  // Which node currently has its caption swapped for an inline text input —
  // see startInlineEdit. Null means no node is being edited.
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  // Group (multi-node) selection — see the marquee/shift-click handling
  // below. A node in here shows NodeCard's dashed multiSelected ring
  // instead of (or alongside) the single `selectedId` ring; once this has
  // 2+ members, NodePanel gives way to a small "N selected" pill and
  // connections not touching the selection dim (see the `muted`/edge/
  // branch-arrow computations further down).
  const [multiSelectIds, setMultiSelectIds] = useState<Set<string>>(new Set());

  // Canvas zoom level — applied to canvasRef as a CSS transform: scale(),
  // see the JSX below. 1 = the canvas's own native 2400x1600 pixels.
  // Changed via zoomAt() (double-click, or the zoom control buttons) rather
  // than set directly, so every change stays clamped to [MIN_ZOOM, MAX_ZOOM]
  // in one place.
  const [zoom, setZoom] = useState(1);

  const [dragState, setDragState] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  // Group-drag counterpart to dragState above — set instead of (never
  // alongside) dragState when the pointer-downed node is itself a member
  // of multiSelectIds and there's more than one node selected; every
  // member moves by the same pointer delta at once. posFor consults this
  // before the single-node dragState. null outside of an active group drag.
  const [groupDragState, setGroupDragState] = useState<Map<string, { x: number; y: number }> | null>(null);
  // Live, while dragging: whichever node the pointer is currently hovering
  // close enough to read as "drop here to join its circle" — null once the
  // pointer isn't over anything droppable. Drives NodeCard's highlight ring.
  const [dropTarget, setDropTarget] = useState<{ nodeId: string; valid: boolean } | null>(null);
  // Rubber-band select: a plain left-button drag started on empty canvas
  // (previously unused — panning is native scroll/trackpad, not a click-
  // drag) sweeps this rectangle (canvas coordinates) and, on release,
  // replaces multiSelectIds with every own node whose position falls
  // inside it. null outside of an active marquee drag.
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const dragMoved = useRef(false);
  // onNodePointerDown calls setPointerCapture on the node's own element —
  // per the Pointer Events spec that re-targets every subsequent event for
  // this interaction, *including the browser's own synthesized "click"*, to
  // that same element regardless of where the pointer physically ends up.
  // So after any drag (a reposition, a join, a leave), a native click still
  // lands back on the node once released, hitting NodeCard's onClick and
  // running handleNodeClick a second time — which is what was popping the
  // side panel/quick-add ghosts open right after finishing a drag. onUp
  // below already resolves this same interaction correctly (drag outcome or
  // plain-click selection, whichever it was) before that click ever fires,
  // so this just needs to swallow the one redundant click that follows —
  // set at the top of onUp, consumed (and reset) by the very next click,
  // which — same task, same interaction — is always that trailing one.
  const suppressNextClick = useRef(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  // The scrollable ancestor of canvasRef — canvasRef itself is the full
  // 2400x1600 canvas, this is the clipped, scrolled window onto it a user
  // is actually looking at, which viewportBounds() below reads from.
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // How far (in canvas units) centerOnNode is allowed to scroll past the
  // canvas's own bottom edge — see the bottom-scroll-margin spacer below
  // for why this exists at all. A full clientHeight's worth (divided back
  // out of screen pixels into canvas units, same *zoom reasoning every
  // other screen<->canvas conversion here uses) is generous on purpose:
  // centerOnNode only ever needs up to ~2/3 of that (see its own
  // PANEL_RESERVE_FRAC-derived visibleH/2), so this comfortably covers it
  // with room to spare rather than being tuned to the exact minimum and
  // risking falling short after some future tweak to that fraction.
  // Recomputed on resize (ResizeObserver, same pattern MiniMap's own
  // viewport tracking already uses) and whenever zoom changes, since both
  // change how many canvas units one screen pixel is worth.
  const [bottomScrollMargin, setBottomScrollMargin] = useState(0);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function update() {
      setBottomScrollMargin(Math.ceil(wrap!.clientHeight / zoom));
    }
    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(wrap);
    return () => resizeObserver.disconnect();
    // `loading` (not just `zoom`): this component's hooks all run
    // unconditionally from the very first render, well before the `if
    // (loading) return ...` gate further down ever lets the real canvas
    // (and wrapRef) mount — so the very first time this effect ran,
    // wrapRef.current was always still null, it bailed out immediately
    // above, and with only `zoom` in the dependency list (which doesn't
    // change on its own) it would then never run again once the canvas
    // actually appeared. MiniMap's own near-identical effect doesn't need
    // this — MiniMap itself isn't rendered at all until after that same
    // gate, so its first run only ever happens once wrapRef is already
    // live. Re-running when `loading` flips to false is what actually
    // attaches this the moment wrapRef has something to observe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, loading]);

  // A trackpad's two-finger swipe reaching this canvas's own left/right
  // scroll edge otherwise reads to the browser as "nothing left to scroll,
  // treat this as swipe-to-navigate-back/forward" — unmounting the whole
  // page and discarding whatever was in progress. index.css's own
  // `overscroll-behavior-x: none` (both on <body> and this same wrap
  // element) handles that for Chrome, but Safari's swipe-navigation is a
  // native browser-chrome gesture that CSS overscroll-behavior doesn't
  // suppress at all — the only thing that reliably stops it there is
  // actually calling preventDefault() on the wheel event that would have
  // driven it. React's own onWheel can't do that (it's attached passively
  // by default since React 17, so preventDefault silently no-ops) — hence
  // a real addEventListener with { passive: false } here instead. Only
  // preventDefault right at the boundary (scrolled all the way left/right
  // already, still trying to go further that way) — anywhere else, this
  // lets the browser's own native scroll happen exactly as before, so
  // trackpad-panning the canvas isn't affected.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function onWheel(e: WheelEvent) {
      if (e.deltaX === 0) return;
      const atLeftEdge = e.deltaX < 0 && wrap!.scrollLeft <= 0;
      const atRightEdge = e.deltaX > 0 && wrap!.scrollLeft >= wrap!.scrollWidth - wrap!.clientWidth;
      if (atLeftEdge || atRightEdge) e.preventDefault();
    }
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, []);

  // Every insertion into `nodes`/`edges` goes through these, not a blind
  // [...prev, x] append — the server broadcasts an action's own result
  // back over the socket to its actor too (see the live-sync effect
  // below), and that echo can arrive before this same tab's own HTTP
  // response does. Two blind appends of the same id would render it
  // twice; an upsert keyed by id makes whichever one lands second a
  // harmless no-op instead.
  const upsertNode = useCallback(
    (incoming: NodeDoc) =>
      setNodes((prev) => {
        const idx = prev.findIndex((n) => n.nodeId === incoming.nodeId);
        if (idx === -1) return [...prev, incoming];
        const next = prev.slice();
        next[idx] = incoming;
        return next;
      }),
    [],
  );

  const upsertEdge = useCallback(
    (incoming: EdgeDoc) =>
      setEdges((prev) => {
        const idx = prev.findIndex((e) => e.edgeId === incoming.edgeId);
        if (idx === -1) return [...prev, incoming];
        const next = prev.slice();
        next[idx] = incoming;
        return next;
      }),
    [],
  );

  // Applies a circle choice (or its clearing) to local state — the one
  // place both this tab's own action (from the HTTP response) and the
  // socket echo from circle:selected/deselected land, so the two paths
  // can never disagree about which nodes are locked. Node.locked is
  // recomputed wholesale from the new selection's membership, mirroring
  // exactly what setLockedNodesDao does server-side: every current member
  // locked, everyone else — including previously-locked nodes from a prior
  // selection — unlocked.
  const applyCircleSelection = useCallback((selectedCircle: SelectedCircle | null) => {
    setMap((prev) => (prev ? { ...prev, selectedCircle } : prev));
    const lockedIds = new Set(selectedCircle?.nodeIds ?? []);
    setNodes((prev) => prev.map((n) => ({ ...n, locked: lockedIds.has(n.nodeId) })));
  }, []);

  const loadAll = useCallback(async () => {
    if (!mapId) return;
    setLoading(true);
    setError(null);
    try {
      const [mapDoc, nodeList, edgeList] = await Promise.all([
        mapsApi.getMap(mapId),
        nodesApi.listNodes(mapId),
        edgesApi.listEdges(mapId),
      ]);
      setMap(mapDoc);
      setNodes(nodeList);
      setEdges(edgeList);
      refreshInsights(mapId);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to load map");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  async function refreshInsights(id: string) {
    try {
      setIndicators(await mapsApi.getAttackIndicators(id));
    } catch {
      // insights are best-effort — a stale/missing overlay isn't worth blocking the map on
    }
  }

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Live sync: join this map's room once the initial REST snapshot has
  // landed (guarded on `loading` so an event can't arrive mid-fetch and
  // then get clobbered when loadAll's own, slightly-stale snapshot lands
  // right after it), then keep nodes/edges in step with every other open
  // tab — including the actor's own other tabs, and this same tab's own
  // action echoed back. Every handler below is an upsert/remove keyed by
  // id, specifically so replaying an update this tab already applied
  // optimistically is a harmless no-op instead of a duplicate.
  useEffect(() => {
    if (!mapId || loading) return;

    const socket = getSocket();
    joinMap(mapId);

    const onNodeCreated = (node: NodeDoc) => upsertNode(node);
    const onNodeUpdated = (node: NodeDoc) => upsertNode(node);
    const onNodeDeleted = ({ nodeId: deletedId }: { nodeId: string }) => {
      setNodes((prev) => prev.filter((n) => n.nodeId !== deletedId));
      setEdges((prev) =>
        prev.filter((e) => nodeRefId(e.fromNodeId) !== deletedId && nodeRefId(e.toNodeId) !== deletedId),
      );
    };
    const onNodeAttacked = ({
      node,
      weaponNode,
      healedParent,
    }: {
      node: NodeDoc;
      weaponNode: NodeDoc;
      // Set only when this attack was a retaliation that landed — see
      // attackAbl.ts's own healedParent doc comment. null on an ordinary
      // attack, so every other map member's canvas picks up the heal too,
      // not just the retaliator's own tab.
      healedParent: NodeDoc | null;
    }) => {
      upsertNode(node);
      upsertNode(weaponNode);
      if (healedParent) upsertNode(healedParent);
      setCelebrateIds((prev) => new Set(prev).add(weaponNode.nodeId));
      refreshInsights(mapId);
    };
    const onEdgeCreated = (edge: EdgeDoc) => {
      upsertEdge(edge);
      refreshInsights(mapId);
    };
    const onEdgeDeleted = ({ edgeId: deletedId }: { edgeId: string }) => {
      setEdges((prev) => prev.filter((e) => e.edgeId !== deletedId));
      refreshInsights(mapId);
    };
    const onCircleSelected = ({ selectedCircle }: { selectedCircle: SelectedCircle | null }) =>
      applyCircleSelection(selectedCircle);
    const onCircleDeselected = () => applyCircleSelection(null);
    const onNodeProtected = ({ protectionNode }: { protectionNode: NodeDoc }) => upsertNode(protectionNode);
    const onNodePacked = ({ container, members }: { container: NodeDoc; members: NodeDoc[] }) => {
      upsertNode(container);
      members.forEach(upsertNode);
      // A packed member just vanished from the canvas (see visibleNodes) —
      // its panel can't stay open for a node nobody can see any more, same
      // defensive clear onNodeDeleted already applies for an outright
      // deletion.
      setSelectedId((prev) => (prev && members.some((m) => m.nodeId === prev) ? null : prev));
    };
    const onNodeUnpacked = ({ node }: { node: NodeDoc }) => upsertNode(node);

    socket.on("node:created", onNodeCreated);
    socket.on("node:updated", onNodeUpdated);
    socket.on("node:deleted", onNodeDeleted);
    socket.on("node:attacked", onNodeAttacked);
    socket.on("edge:created", onEdgeCreated);
    socket.on("edge:deleted", onEdgeDeleted);
    socket.on("circle:selected", onCircleSelected);
    socket.on("circle:deselected", onCircleDeselected);
    socket.on("node:protected", onNodeProtected);
    socket.on("node:packed", onNodePacked);
    socket.on("node:unpacked", onNodeUnpacked);

    return () => {
      socket.off("node:created", onNodeCreated);
      socket.off("node:updated", onNodeUpdated);
      socket.off("node:deleted", onNodeDeleted);
      socket.off("node:attacked", onNodeAttacked);
      socket.off("edge:created", onEdgeCreated);
      socket.off("edge:deleted", onEdgeDeleted);
      socket.off("circle:selected", onCircleSelected);
      socket.off("circle:deselected", onCircleDeselected);
      socket.off("node:protected", onNodeProtected);
      socket.off("node:packed", onNodePacked);
      socket.off("node:unpacked", onNodeUnpacked);
      leaveMap(mapId);
    };
  }, [mapId, loading, upsertNode, upsertEdge, applyCircleSelection]);

  const selectedNode = nodes.find((n) => n.nodeId === selectedId) ?? null;
  // Same condition that gates the quick-add ghost ring below — reused here
  // so every other node dims while it's showing, putting the focus on the
  // selected node and its type-to-create options instead of competing with
  // the rest of the canvas. selectionSettled: the ghosts (and the dimming
  // that comes with them) wait until centerOnNode's own pan has landed —
  // see its own doc comment.
  const quickAddActive =
    !!(selectedNode && isOwnNode(selectedNode) && !linkMode && !packMode && !dragState) && selectionSettled;
  // Same "focus on the one thing" treatment as quickAddActive above, keyed
  // off a *chosen circle* instead of a selected node — every node outside
  // the chosen circle (a member of some other circle, or standalone) dims,
  // spotlighting the one the team settled on. Membership comes straight off
  // the snapshot taken at selection time (Map.selectedCircle.nodeIds), not
  // recomputed from current parentId links, so it can't disagree with
  // what's actually locked.
  const spotlightedNodeIds = map?.selectedCircle?.nodeIds;

  // Selecting either end of an attack (clicking the objection node or the
  // node it's aimed at — see handleNodeClick) keeps *that pair* visible
  // even if a chosen circle would otherwise dim one of them: a weapon node
  // never belongs to any circle itself, so with a circle spotlighted every
  // attack elsewhere on the map would otherwise mute into near-invisibility
  // the moment you're actually looking at one of them. Derived from
  // selectedId rather than a one-shot flag set by the click, so it just
  // keeps working for as long as either end stays selected and clears
  // itself the moment selection moves on to something unrelated — no timer
  // to manage.
  const unmutedAttackNodeIds = useMemo(() => {
    if (!selectedId) return null;
    const selected = nodes.find((n) => n.nodeId === selectedId);
    if (!selected) return null;
    if (selected.isWeapon) {
      const targetId = nodeRefId(selected.targetNodeId);
      return targetId ? new Set([selected.nodeId, targetId]) : null;
    }
    const attackers = nodes.filter((n) => n.isWeapon && nodeRefId(n.targetNodeId) === selected.nodeId);
    return attackers.length > 0 ? new Set([selected.nodeId, ...attackers.map((a) => a.nodeId)]) : null;
  }, [selectedId, nodes]);

  // ----- positions -----
  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    // Protection nodes get the exact same "anchored near its own creator,
    // fanned by hash" treatment weapon nodes already do (see the shared
    // placeCompanionNode helper below) — neither one is "regular" for the
    // spiral/index-based fallback placement further down.
    const regular = nodes.filter((n) => !n.isWeapon && !n.isProtection);
    const weapons = nodes.filter((n) => n.isWeapon);
    const protections = nodes.filter((n) => n.isProtection);

    // Shared by both weapons.forEach and protections.forEach below —
    // anchors a companion node (n) near whichever of its own creator's
    // *other* regular nodes sits closest to refPos (the thing it's aimed
    // at/defending), fanned out by a per-node hash angle so several
    // companions anchored at the same spot don't stack. Falls back to
    // refPos itself if the creator has no other node left to anchor near.
    function placeCompanionNode(n: NodeDoc, refPos: { x: number; y: number }) {
      const creatorId = idOf(n.userId as any);
      let base = refPos;
      let closestDist = Infinity;
      for (const own of regular) {
        if (own.nodeId === n.nodeId || idOf(own.userId as any) !== creatorId) continue;
        const p = map.get(own.nodeId);
        if (!p) continue;
        const d = Math.hypot(p.x - refPos.x, p.y - refPos.y);
        if (d < closestDist) {
          closestDist = d;
          base = p;
        }
      }
      const angle = hashOffset(n.nodeId, 180) * (Math.PI / 180);
      const radius = getNodeMinDist();
      const desired = { x: base.x + radius * Math.cos(angle), y: base.y + radius * Math.sin(angle) };
      return avoidOverlap(desired, nodeObstacles(Array.from(map.values())));
    }

    regular.forEach((n, i) => {
      if (typeof n.x === "number" && typeof n.y === "number") {
        map.set(n.nodeId, { x: n.x, y: n.y });
      } else {
        const angle = i * 137.508 * (Math.PI / 180);
        const radius = 70 + i * 22;
        map.set(n.nodeId, { x: CANVAS_W / 2 + radius * Math.cos(angle), y: CANVAS_H / 2 + radius * Math.sin(angle) });
      }
    });
    weapons.forEach((n) => {
      if (typeof n.x === "number" && typeof n.y === "number") {
        map.set(n.nodeId, { x: n.x, y: n.y });
        return;
      }
      // targetNodeId comes back populated as { nodeId, text, type } now, not
      // a bare string — this was still checking the pre-populate shape, so
      // it never matched and every weapon node fell back to canvas-center
      // placement regardless of what it was aimed at.
      const targetId = nodeRefId(n.targetNodeId);
      const target = targetId ? nodes.find((t) => t.nodeId === targetId) : undefined;
      const targetPos = (target && map.get(target.nodeId)) || { x: CANVAS_W / 2, y: CANVAS_H / 2 };
      // Anchored next to the attacker's own closest node to the target, not
      // the target itself — the bow (WeaponMark draws it at this weapon
      // node's own position) then reads as "shot from over there" across
      // the canvas, rather than camping right beside the node it hit. Falls
      // back to the target's own position — the old anchor — if the
      // attacker has no other node left on this map to anchor near (every
      // other one of theirs got deleted since, say); a self-attack in
      // discussion mode lands here too, since the target *is* one of the
      // attacker's own nodes and so is trivially its own closest match.
      // Fanning by angle alone doesn't guarantee two attacks (or an attack
      // and some unrelated node) don't land on each other — placeCompanionNode's
      // own avoidOverlap nudges clear of anything already placed, same
      // spacing rule every other node uses. Big-group backdrops aren't
      // checked here: nodeGroups itself is derived from these positions, so
      // consulting it back inside this same memo would be circular. Weapon
      // nodes fan out from an explicit anchor and land far enough out
      // (getNodeMinDist() radius) that this is a rare miss in practice, not
      // a gap worth breaking the memo for.
      map.set(n.nodeId, placeCompanionNode(n, targetPos));
    });
    protections.forEach((n) => {
      if (typeof n.x === "number" && typeof n.y === "number") {
        map.set(n.nodeId, { x: n.x, y: n.y });
        return;
      }
      // Exact mirror of the weapon-node placement just above — anchored
      // near the protector's own closest node to the node it's guarding,
      // not the guarded node itself, so the shield (ShieldMark, drawn on
      // the *guarded* node oriented toward this position) reads as "coming
      // from over there" the same way a weapon's bow does.
      const protectedId = nodeRefId(n.protectsNodeId);
      const protectedNode = protectedId ? nodes.find((t) => t.nodeId === protectedId) : undefined;
      const protectedPos = (protectedNode && map.get(protectedNode.nodeId)) || { x: CANVAS_W / 2, y: CANVAS_H / 2 };
      map.set(n.nodeId, placeCompanionNode(n, protectedPos));
    });
    return map;
  }, [nodes]);

  // Radial focus layout: while exactly one node is selected (not a group
  // selection — see multiSelectIds), its directly-connected neighbors
  // (parentId children, its own parentId parent, and any Edge-linked nodes
  // either direction) visually arrange in a circle around it, so the
  // selected node's own neighborhood reads as a deliberate ring instead of
  // wherever they happened to be scattered across the canvas. Purely a
  // display override consulted by posFor below (never by the base
  // `positions` memo above, or by anything — like nodeGroups' own zone
  // outlines — that reads `positions` directly instead of going through
  // posFor) — nothing here ever calls nodesApi.updateNode, so it reverts
  // instantly the moment selection changes; every member's real, stored
  // x/y is untouched. Capped at RADIAL_MAX_NEIGHBORS so a heavily-connected
  // hub node doesn't produce an unreadable, overlapping ring — anything
  // past the cap just keeps its stored position. Waits on selectionSettled
  // too, same reasoning as quickAddActive — neighbors shouldn't jump into
  // their ring while the camera's still panning toward the chosen node.
  const RADIAL_NEIGHBOR_RADIUS = 190;
  const RADIAL_MAX_NEIGHBORS = 10;
  const radialPositions = useMemo(() => {
    if (multiSelectIds.size > 1 || !selectedId || !selectionSettled) return null;
    const center = positions.get(selectedId);
    const selected = nodes.find((n) => n.nodeId === selectedId);
    if (!center || !selected) return null;

    const neighborIds = computeLinkedNeighborIds(selectedId, nodes, edges);
    if (neighborIds.size === 0) return null;

    const neighbors = Array.from(neighborIds).slice(0, RADIAL_MAX_NEIGHBORS);
    const map = new Map<string, { x: number; y: number }>();
    neighbors.forEach((id, i) => {
      const angle = (i / neighbors.length) * Math.PI * 2 - Math.PI / 2;
      map.set(id, {
        x: center.x + RADIAL_NEIGHBOR_RADIUS * Math.cos(angle),
        y: center.y + RADIAL_NEIGHBOR_RADIUS * Math.sin(angle),
      });
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, multiSelectIds, nodes, edges, positions, selectionSettled]);

  function posFor(node: NodeDoc) {
    const grouped = groupDragState?.get(node.nodeId);
    if (grouped) return grouped;
    if (dragState && dragState.nodeId === node.nodeId) return { x: dragState.x, y: dragState.y };
    const radial = radialPositions?.get(node.nodeId);
    if (radial) return radial;
    return positions.get(node.nodeId) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 };
  }

  // screenToCanvas: converts a screen point (e.g. clientX/clientY) into
  // canvas-coordinate space (the same 0..CANVAS_W/0..CANVAS_H units every
  // node's x/y, `positions`, and dragState are already in). Needed because
  // canvasRef is now visually zoomed via a CSS transform (see the zoom
  // state below) — its rendered size no longer matches CANVAS_W/CANVAS_H
  // 1:1, so any screen-pixel distance has to be divided by the current
  // zoom before it means anything in canvas coordinates. wrap's own
  // scroll position + bounding rect (not canvasRef's) is the anchor: the
  // canvas's transform-origin is its own (0,0), which sits at wrap's
  // scrolled (0,0) content position.
  function screenToCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const wrap = wrapRef.current;
    if (!wrap) return { x: clientX, y: clientY };
    const rect = wrap.getBoundingClientRect();
    return {
      x: (wrap.scrollLeft + (clientX - rect.left)) / zoom,
      y: (wrap.scrollTop + (clientY - rect.top)) / zoom,
    };
  }

  // Adjusts zoom by `delta` (or snaps straight to `to` if given) while
  // keeping the canvas point under (clientX, clientY) visually stationary —
  // the usual "zoom toward the cursor" behavior in a map/image viewer, so
  // zooming in on a spot doesn't also yank the view away from it.
  function zoomAt(clientX: number, clientY: number, delta: number, to?: number) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const nextZoom = Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, to ?? zoom + delta)) * 100) / 100;
    if (nextZoom === zoom) return;
    const rect = wrap.getBoundingClientRect();
    const canvasX = (wrap.scrollLeft + (clientX - rect.left)) / zoom;
    const canvasY = (wrap.scrollTop + (clientY - rect.top)) / zoom;
    setZoom(nextZoom);
    // Deferred a frame: scrollLeft/scrollTop set synchronously here would
    // still be measured against the *old* scaled scrollWidth/scrollHeight,
    // since canvasRef hasn't actually re-rendered at its new scale yet —
    // the browser would clamp against stale bounds and this would land in
    // the wrong place.
    requestAnimationFrame(() => {
      wrap.scrollLeft = canvasX * nextZoom - (clientX - rect.left);
      wrap.scrollTop = canvasY * nextZoom - (clientY - rect.top);
    });
  }

  // The currently-visible rectangle of the canvas, in canvas coordinates —
  // read live off the scroll container rather than tracked in state, since
  // it's only ever needed at the instant of a create/drop action, not on
  // every render. `pad` keeps a node's full icon+caption footprint inside
  // the edge, not just its center point. Falls back to the whole canvas
  // before the wrap has mounted. Divided by `zoom` throughout — wrap's own
  // scroll metrics are in screen pixels of the *rendered* (scaled) canvas,
  // same reasoning as screenToCanvas above.
  function viewportBounds(): ViewportBounds {
    const wrap = wrapRef.current;
    if (!wrap) return FULL_CANVAS_BOUNDS;
    const pad = 70;
    // NodePanel/LinkPickerPanel's bottom sheet (see PANEL_RESERVE_FRAC's own
    // doc comment) physically covers the bottom third of the screen while
    // it's open — shrink the placeable rectangle by the same amount so a
    // freshly-created node (or a quick-add ghost, which reads this via
    // MapPage's own bounds prop) never lands underneath it. Skipped for the
    // group-selection footer (multiSelectIds), which is a slim bar, not a
    // tall sheet.
    const sheetOpen = linkMode || packMode || (!!selectedNode && multiSelectIds.size === 0);
    const reserve = sheetOpen ? wrap.clientHeight * PANEL_RESERVE_FRAC : 0;
    return {
      minX: wrap.scrollLeft / zoom + pad,
      minY: wrap.scrollTop / zoom + pad,
      maxX: (wrap.scrollLeft + wrap.clientWidth) / zoom - pad,
      maxY: (wrap.scrollTop + wrap.clientHeight - reserve) / zoom - pad,
    };
  }

  // Pans the canvas so the given node's position lands in the middle of the
  // current viewport, unconditionally — the chosen node (whatever was just
  // clicked/selected) always ends up centered, not just nudged into view.
  // Selecting a node always brings up NodePanel too, and that panel is now a
  // bottom sheet *overlaying* the canvas at every screen size (see its own
  // PANEL_CLASS) rather than a sidebar the canvas shrinks to make room for —
  // so wrap.clientHeight's own full height is no longer what's actually
  // visible above it. The module-level PANEL_RESERVE_FRAC (see its own doc
  // comment) is a deliberate approximation (there's no reliable,
  // synchronously-correct measurement of the panel's real height here — it
  // hasn't mounted yet for a first selection, and its content, and so its
  // height, varies by node and tab anyway) — but it's the *same* fraction
  // viewportBounds() reserves and PANEL_CLASS caps the sheet at, so the
  // chosen node (and the quick-add ghosts fanned around it, clamped to that
  // same viewportBounds) land in the space actually left on screen rather
  // than drifting out of sync with how tall the sheet is actually allowed
  // to grow.
  function centerOnNode(nodeId: string) {
    const wrap = wrapRef.current;
    const node = nodes.find((n) => n.nodeId === nodeId);
    if (!wrap || !node) return;
    // positions.get, not posFor(node): this runs inside the same click
    // handler as the setSelectedId call that's choosing this node, so
    // React hasn't re-run radialPositions against the *new* selection yet
    // — posFor would still read last render's radial ring (keyed off the
    // *previous* selectedId), which places every one of that node's own
    // neighbors on a ring around it. Selecting one of those neighbors hit
    // this exactly: the camera panned to wherever that neighbor was
    // sitting in the old node's ring, not to its own resting spot — and
    // the very next render then snaps that neighbor (now the selection)
    // back to its real position, off in whatever direction the ring had
    // placed it, since a selected node is never a ring member of its own
    // view. The node the user just tapped would end up centered on empty
    // canvas while the thing they actually chose jumped off-screen —
    // reads as "picking a different node doesn't work" on a phone, where
    // there's no cursor hovering the real node to notice it moved.
    // positions (unlike posFor) never carries a radial override at all,
    // so it's always that node's own real, settled spot regardless of
    // what was selected a moment ago.
    const pos = positions.get(nodeId) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    const visibleH = Math.max(150, wrap.clientHeight * (1 - PANEL_RESERVE_FRAC));
    // *zoom throughout: pos.x/y are canvas-space, but scrollTo/scrollWidth
    // deal in screen pixels of the rendered (scaled) canvas — same
    // conversion as screenToCanvas/zoomAt above, just the other direction.
    const maxLeft = Math.max(0, CANVAS_W * zoom - wrap.clientWidth);
    // + bottomScrollMargin*zoom: without it this clamp would cap the scroll
    // right back at the canvas's own bottom edge, undoing the extra
    // scrollable room the spacer below was added to provide — a node
    // sitting near that edge would still get pinned near the bottom of the
    // screen (behind the panel) even though wrap itself is now able to
    // scroll further. *zoom to convert bottomScrollMargin (canvas units)
    // back to screen pixels, same as every other term here.
    const maxTop = Math.max(0, CANVAS_H * zoom - wrap.clientHeight) + bottomScrollMargin * zoom;
    wrap.scrollTo({
      left: Math.min(maxLeft, Math.max(0, pos.x * zoom - wrap.clientWidth / 2)),
      top: Math.min(maxTop, Math.max(0, pos.y * zoom - visibleH / 2)),
      behavior: "smooth",
    });
    // See selectionSettled's own doc comment — quick-add ghosts/radial
    // neighbors stay hidden until this pan's had time to land. ~350ms
    // approximates a smooth scroll's own duration for the distances
    // involved here — not exact (a longer pan takes a bit more), same
    // approximation shotTimeoutRef's own 700ms already makes for the
    // weapon-arrow replay just above. Re-triggering (clicking a different
    // node before the previous pan even settled) clears the old timer
    // instead of letting it fire late and flip this back on prematurely.
    setSelectionSettled(false);
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    settleTimeoutRef.current = setTimeout(() => setSelectionSettled(true), 350);
  }

  // Replays a weapon's arrow flight (see WeaponMark) — alongside
  // centerOnNode's camera pan, so clicking either end of an attack reads as
  // "watch it land on that" rather than just an instant jump. The nonce
  // (not just the id) is what actually reaches WeaponMark as replayNonce,
  // so clicking the same weapon twice in a row still fires a second flight.
  function triggerWeaponShot(weaponId: string) {
    if (shotTimeoutRef.current) clearTimeout(shotTimeoutRef.current);
    setShotState({ id: weaponId, nonce: Date.now() });
    shotTimeoutRef.current = setTimeout(() => setShotState(null), 700);
  }

  // Every packed-away node filtered out — this is what every canvas
  // rendering loop (NodeCard itself, branch-arrow lines, circle/zone
  // detection) should iterate instead of raw `nodes`, so a packed member
  // actually disappears from the canvas instead of just growing a
  // packedIntoNodeId nobody reads. Plain `nodes` stays correct (and is
  // still used) for lookups that need to resolve a packed node's own text —
  // e.g. NodePanel's own "Packed (N)" list — since a packed node is still a
  // completely real node server-side, just hidden here.
  const visibleNodes = useMemo(() => nodes.filter((n) => !n.packedIntoNodeId), [nodes]);

  // How many nodes are currently packed into each container — NodeCard's
  // own corner badge reads this by nodeId.
  const packedCountByContainer = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of nodes) {
      const containerId = nodeRefId(n.packedIntoNodeId);
      if (!containerId) continue;
      counts.set(containerId, (counts.get(containerId) ?? 0) + 1);
    }
    return counts;
  }, [nodes]);

  // Any node with 2+ direct parentId-children reads as a group ("circle") —
  // general on purpose, same as linkCycles below: this fires whether the
  // star came from dragging one node onto another or just from branching
  // off the same node several times over. Majority of the group's own node
  // *types* decides halo vs horns; a tie, or a group made entirely of
  // "unknown" nodes (the only type with no ring, so no vote — see
  // sentimentOf), draws nothing — there's no majority to color it by.
  // Built from visibleNodes, not nodes — a packed-away member shouldn't
  // still read as a circle child on the canvas it no longer appears on.
  const nodeGroups = useMemo(() => {
    const childrenByParent = new Map<string, NodeDoc[]>();
    for (const n of visibleNodes) {
      const parentId = nodeRefId(n.parentId);
      if (!parentId) continue;
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
      childrenByParent.get(parentId)!.push(n);
    }
    const groups: {
      rootId: string;
      members: NodeDoc[];
      sentiment: "positive" | "negative";
      cx: number;
      cy: number;
      r: number;
      // The "zone" outline: every member's own current position (root
      // included), sorted by angle around the centroid so connecting them
      // in order traces a simple (non-self-crossing) polygon around the
      // group instead of an old fixed circle — a triangle at the 3-member
      // minimum (2 children + root), growing to a quad/pentagon/hexagon/…
      // as the group grows. Recomputed from `positions` on every render
      // (including mid-drag, via posFor/dragState), so dragging a member
      // live-deforms its own zone the same way it already moves the
      // member itself — nothing is a snapshot here. See MapPage's own
      // "zone" render block and MiniMap's matching one.
      outline: { x: number; y: number }[];
    }[] = [];
    for (const [rootId, children] of childrenByParent) {
      if (children.length < 2) continue;
      const root = nodes.find((n) => n.nodeId === rootId);
      if (!root) continue;
      const members = [root, ...children];
      const sentiment = circleSentiment(members);
      if (!sentiment) continue;
      const pts = members.map((n) => positions.get(n.nodeId) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 });
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const r = Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.y - cy))) + 70;
      const outline = pts
        .slice()
        .sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
      groups.push({ rootId, members, sentiment, cx, cy, r, outline });
    }
    return groups;
  }, [visibleNodes, positions]);

  // Every circle member's sentiment, keyed by node id — what NodeCard reads
  // to decide its dashed outline and whether it's eligible to chaotic-drift
  // at all (see NodeCard's `chaotic`). A node in no circle isn't in this
  // map and never drifts, regardless of node.locked.
  const groupSentimentByNode = useMemo(() => {
    const map = new Map<string, "positive" | "negative">();
    for (const g of nodeGroups) {
      for (const m of g.members) map.set(m.nodeId, g.sentiment);
    }
    return map;
  }, [nodeGroups]);

  // What any node creation/drag has to steer clear of so it never lands
  // inside a big group backdrop — the group's own members are exempt
  // (excludeRootIds), since they belong there and are what the backdrop is
  // even drawn around. Clearance is the backdrop's own radius plus a
  // node's normal footprint, so a placed node's icon+caption clears the
  // backdrop's edge, not just its center.
  function bigNodeObstacles(excludeRootIds: Set<string> = new Set()): Obstacle[] {
    return nodeGroups
      .filter((g) => !excludeRootIds.has(g.rootId))
      .map((g) => ({ x: g.cx, y: g.cy, minDist: g.r + getNodeMinDist() * 0.6 }));
  }

  // Any closed loop in the Link graph (not branch-arrows, not weapon marks
  // — specifically the edges "Link nodes" draws) reads as a figure and gets
  // colored in; a simple two-node link never can, there's nothing to close.
  // General on purpose: this fires whether the loop was made in one
  // multi-select or pieced together one link at a time. DFS over an
  // undirected adjacency, capped on both search depth and result count so
  // a pathologically dense graph can't make this expensive.
  const linkCycles = useMemo(() => {
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
  }, [edges]);

  const indicatorByNode = useMemo(() => {
    const map = new Map<string, AttackIndicator>();
    for (const i of indicators) map.set(i.nodeId, i);
    return map;
  }, [indicators]);

  // ----- dragging -----

  // What dragging `dragged` to (x,y) would land it on, if anything — the
  // nearest other node within CIRCLE_DROP_RADIUS, plus whether dropping
  // there is actually allowed to become/join a circle (own node, no
  // cycle, room under the 7-node cap, and a sentiment that doesn't
  // conflict with the target's own). null means the pointer isn't over
  // anything droppable, so the drag ends as a plain reposition instead.
  function findDropTarget(
    dragged: NodeDoc,
    x: number,
    y: number,
  ): { target: NodeDoc; valid: boolean; reason?: string } | null {
    let closest: NodeDoc | null = null;
    let closestDist = CIRCLE_DROP_RADIUS;
    for (const n of nodes) {
      if (n.nodeId === dragged.nodeId || n.isWeapon) continue;
      const p = positions.get(n.nodeId);
      if (!p) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < closestDist) {
        closest = n;
        closestDist = d;
      }
    }
    if (!closest) return null;
    const target = closest;
    if (!isOwnNode(target)) {
      return { target, valid: false, reason: "Only your own nodes can anchor a circle." };
    }
    if (isDescendant(target.nodeId, dragged.nodeId, nodes)) {
      return { target, valid: false, reason: "Can't drop a node onto its own branch." };
    }
    // Exclude the dragged node itself from the target's current children —
    // otherwise re-dropping it back onto its existing parent would double-
    // count it against both the cap and the sentiment vote.
    const currentChildren = nodes.filter(
      (n) => n.nodeId !== dragged.nodeId && nodeRefId(n.parentId) === target.nodeId,
    );
    if (currentChildren.length >= CIRCLE_MAX_CHILDREN) {
      return { target, valid: false, reason: "That circle already has the maximum of 7 nodes." };
    }
    const targetSentiment = circleSentiment([target, ...currentChildren]);
    const draggedSentiment = sentimentOf(dragged.type);
    if (targetSentiment && draggedSentiment && targetSentiment !== draggedSentiment) {
      return {
        target,
        valid: false,
        reason: `That circle is ${targetSentiment} — only ${targetSentiment} nodes can join it.`,
      };
    }
    return { target, valid: true };
  }

  function onNodePointerDown(node: NodeDoc, e: ReactPointerEvent) {
    if (linkMode || packMode) return;
    if (!isOwnNode(node)) return;

    // Group drag: the pointer-downed node is itself a member of a 2+-node
    // multi-selection — move every selected (own) node by the same pointer
    // delta at once instead of the single-node path below. No circle-join
    // drop-target check here at all (see the plan's own scope note) — a
    // group drop is always a plain bulk reposition; each member persists
    // with its own PATCH /api/nodes/:nodeId (no bulk endpoint exists), all
    // in parallel.
    if (multiSelectIds.size > 1 && multiSelectIds.has(node.nodeId)) {
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      dragMoved.current = false;
      const memberIds = Array.from(multiSelectIds).filter((id) => {
        const n = nodes.find((nn) => nn.nodeId === id);
        return !!n && isOwnNode(n) && !n.isWeapon;
      });
      const startPositions = new Map(
        memberIds.map((id) => [id, posFor(nodes.find((n) => n.nodeId === id)!)]),
      );
      setGroupDragState(startPositions);
      const startPt = screenToCanvas(e.clientX, e.clientY);

      function onGroupMove(ev: PointerEvent) {
        const p = screenToCanvas(ev.clientX, ev.clientY);
        const dx = p.x - startPt.x;
        const dy = p.y - startPt.y;
        dragMoved.current = true;
        const next = new Map<string, { x: number; y: number }>();
        for (const [id, pos] of startPositions) next.set(id, { x: pos.x + dx, y: pos.y + dy });
        setGroupDragState(next);
      }

      async function onGroupUp(ev: PointerEvent) {
        window.removeEventListener("pointermove", onGroupMove);
        window.removeEventListener("pointerup", onGroupUp);
        suppressNextClick.current = true;
        setGroupDragState(null);
        if (!dragMoved.current) {
          handleNodeClick(node, false);
          return;
        }
        const p = screenToCanvas(ev.clientX, ev.clientY);
        const dx = p.x - startPt.x;
        const dy = p.y - startPt.y;
        const margin = 60;
        setActionError(null);
        try {
          await Promise.all(
            memberIds.map(async (id) => {
              const startPos = startPositions.get(id)!;
              const nx = Math.min(CANVAS_W - margin, Math.max(margin, startPos.x + dx));
              const ny = Math.min(CANVAS_H - margin, Math.max(margin, startPos.y + dy));
              const updated = await nodesApi.updateNode(id, { x: nx, y: ny });
              upsertNode(updated);
            }),
          );
        } catch (err) {
          setActionError(err instanceof ApiRequestError ? err.message : "Failed to move the selected nodes");
        }
      }

      window.addEventListener("pointermove", onGroupMove);
      window.addEventListener("pointerup", onGroupUp);
      return;
    }

    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragMoved.current = false;
    const start = posFor(node);
    setDragState({ nodeId: node.nodeId, x: start.x, y: start.y });

    // screenToCanvas divides by `zoom` — canvasRef is visually scaled via a
    // CSS transform now (see the zoom controls below), so its own
    // getBoundingClientRect() reports a *rendered* size (CANVAS_W*zoom
    // pixels wide), not the CANVAS_W-unit coordinate space every position
    // in this file (node.x/y, positions, dragState, viewportBounds) is
    // expressed in. Every screen-pixel reading in this drag has to go
    // through this same conversion, or a drag started at any zoom level
    // other than 100% tracks the pointer at the wrong speed/direction.
    const startPt = screenToCanvas(e.clientX, e.clientY);
    const offsetX = startPt.x - start.x;
    const offsetY = startPt.y - start.y;

    function onMove(ev: PointerEvent) {
      const p = screenToCanvas(ev.clientX, ev.clientY);
      const x = p.x - offsetX;
      const y = p.y - offsetY;
      dragMoved.current = true;
      setDragState({ nodeId: node.nodeId, x, y });
      const found = findDropTarget(node, x, y);
      setDropTarget(found ? { nodeId: found.target.nodeId, valid: found.valid } : null);
    }

    async function onUp(ev: PointerEvent) {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      // See suppressNextClick's own comment — this interaction's outcome
      // (below) is the real one; the click still about to fire on this same
      // node is the captured-pointer artifact, not a second user action.
      suppressNextClick.current = true;
      const p = screenToCanvas(ev.clientX, ev.clientY);
      const x = p.x - offsetX;
      const y = p.y - offsetY;
      const found = dragMoved.current ? findDropTarget(node, x, y) : null;
      setDragState(null);
      setDropTarget(null);
      if (dragMoved.current) {
        if (found && !found.valid) {
          setActionError(found.reason ?? "Can't join that circle.");
        }
        if (found && found.valid) {
          // Dropped onto an eligible node — join its circle instead of a
          // plain reposition. Land just next to the target rather than
          // exactly on top of it, same nudge-from-collision every other
          // placement uses.
          const target = found.target;
          const others = Array.from(positions.entries())
            .filter(([id]) => id !== node.nodeId)
            .map(([, p]) => p);
          const placed = avoidOverlap({ x, y }, nodeObstacles(others), viewportBounds());
          setActionError(null);
          try {
            const updated = await nodesApi.updateNode(node.nodeId, {
              x: placed.x,
              y: placed.y,
              parentId: target.nodeId,
            });
            upsertNode(updated);
          } catch (err) {
            setActionError(err instanceof ApiRequestError ? err.message : "Failed to join circle");
          }
          return;
        }
        // Dragging had no collision check at all — you could drop a node
        // directly on top of another one, or inside a big group backdrop.
        // Nudge clear of everything else — except the node's own group, if
        // it belongs to one, since that backdrop is drawn around it and
        // repositioning within it is expected.
        const others = Array.from(positions.entries())
          .filter(([id]) => id !== node.nodeId)
          .map(([, p]) => p);
        const ownGroups = new Set(
          nodeGroups
            .filter((g) => g.rootId === node.nodeId || g.members.some((m) => m.nodeId === node.nodeId))
            .map((g) => g.rootId),
        );
        const dropped = avoidOverlap(
          { x, y },
          [...nodeObstacles(others), ...bigNodeObstacles(ownGroups)],
          viewportBounds(),
        );

        // Dragged clear of its own circle's backdrop (not just repositioned
        // within it) — read as "pull this node out", clearing parentId so it
        // stops being a member. Only applies to an actual *member* (its own
        // parentId points at the circle's root); dragging the root itself
        // just moves the whole group, same as before. A circle with only
        // one member left after this simply stops being one — nodeGroups
        // requires 2+ children, so its backdrop disappears on its own, no
        // separate cleanup needed here.
        const parentId = nodeRefId(node.parentId);
        const ownCircle = parentId ? nodeGroups.find((g) => g.rootId === parentId) : undefined;
        const leftCircle = !!ownCircle && Math.hypot(dropped.x - ownCircle.cx, dropped.y - ownCircle.cy) > ownCircle.r;

        setNodes((prev) =>
          prev.map((n) =>
            n.nodeId === node.nodeId ? { ...n, x: dropped.x, y: dropped.y, ...(leftCircle ? { parentId: null } : {}) } : n,
          ),
        );
        try {
          if (leftCircle) {
            // A structural change, not just a courtesy position update — a
            // failed persist here would leave the UI showing the node as
            // detached when the server still has it in the circle, so this
            // one gets surfaced and reconciled from the real response
            // instead of silently trusted like the position-only case below.
            const updated = await nodesApi.updateNode(node.nodeId, { x: dropped.x, y: dropped.y, parentId: null });
            upsertNode(updated);
          } else {
            await nodesApi.updateNode(node.nodeId, { x: dropped.x, y: dropped.y });
          }
        } catch (err) {
          if (leftCircle) setActionError(err instanceof ApiRequestError ? err.message : "Failed to leave circle");
          // otherwise: position is a courtesy update — a failed persist just means it snaps back on next reload
        }
      } else {
        handleNodeClick(node);
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // "Mine" gates dragging, linking, quick-add branching, and editing alike —
  // a weapon node counts here too now: it's a real node its own attacker
  // owns like any other, just one that happened to spawn from an attack
  // rather than the toolbar. Client-side only: this can't stop a crafted
  // request straight to the API, just the UI paths.
  function isOwnNode(node: NodeDoc) {
    return idOf(node.userId as any) === user?._id;
  }

  // Owner-only — text/type editing isn't otherwise restricted (an earlier
  // version locked it once a node had taken any damage, but that blocked
  // ordinary corrections too aggressively; see NodePanel.tsx's own canEdit).
  function canEditNode(node: NodeDoc) {
    return isOwnNode(node);
  }

  // Mirrors attackAbl.ts exactly: combat is fully open now — no own-node
  // rule, no weapon-node exclusion, no already-defeated block. Any node
  // (yours, someone else's, a weapon node, already at 0 health) is a valid
  // attack target for any map member. Kept as its own function (rather than
  // inlining `true` at each call site) purely so every place that used to
  // ask "can this be attacked" still reads the same way and stays easy to
  // re-tighten later if these rules ever come back.
  function canAttackNode(_node: NodeDoc) {
    return true;
  }

  // Single entry point for "start editing this node's text/type inline, on
  // its own icon" — always selects (so the side panel shows something,
  // including the locked message when editing isn't allowed), but only
  // actually turns the inline input on when canEditNode agrees. Reached
  // from the context menu's "Update" and the side panel's own Edit button —
  // deliberately not a node double-click any more (see zoom controls below,
  // which claim that gesture instead), so editing only ever starts from an
  // explicit, hard-to-fat-finger control.
  function startInlineEdit(node: NodeDoc) {
    setContextMenu(null);
    setPendingCreate(null);
    setSelectedId(node.nodeId);
    if (canEditNode(node)) setInlineEditId(node.nodeId);
  }

  function handleNodeClick(node: NodeDoc, shiftKey = false) {
    setContextMenu(null);
    if (packMode) {
      // Same toggle-in/out-freely behavior link mode's own picking uses —
      // clicking an already-picked node just removes that one pick.
      if (packSelection.has(node.nodeId)) {
        setPackSelection((prev) => {
          const next = new Set(prev);
          next.delete(node.nodeId);
          return next;
        });
        return;
      }
      if (node.nodeId === packContainerId) return; // the anchor can't pack itself
      const eligible = packContainerId ? computeLinkedNeighborIds(packContainerId, nodes, edges) : new Set<string>();
      if (!eligible.has(node.nodeId)) {
        setPackError("Only nodes linked or branched to the container can be packed.");
        return;
      }
      setPackError(null);
      setPackSelection((prev) => new Set(prev).add(node.nodeId));
      return;
    }
    if (linkMode) {
      // Clicking an already-picked node deselects just that one — free to
      // toggle any pick in or out rather than only ever undoing the last one.
      if (linkSelection.includes(node.nodeId)) {
        setLinkSelection((prev) => prev.filter((id) => id !== node.nodeId));
        return;
      }
      if (!isOwnNode(node)) {
        setLinkError("You can only link nodes you created.");
        return;
      }
      setLinkError(null);
      setLinkSelection((prev) => [...prev, node.nodeId]);
      return;
    }
    // Shift+click toggles group (multi-)selection instead of the normal
    // single-select/center flow below — only own nodes can join it, same
    // gate as dragging a node at all (see onNodePointerDown/isOwnNode).
    // Doesn't touch `selectedId`/centering/weapon-replay at all; a group
    // selection has its own small "N selected" pill instead of NodePanel
    // (see the JSX below).
    if (shiftKey) {
      if (!isOwnNode(node)) return;
      setMultiSelectIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.nodeId)) next.delete(node.nodeId);
        else next.add(node.nodeId);
        return next;
      });
      return;
    }
    if (multiSelectIds.size > 0) setMultiSelectIds(new Set());
    setSelectedId(node.nodeId);
    releaseChosenCircleIfOutside(node.nodeId);
    // Whatever was just clicked is "chosen" now — always center the camera
    // on it, not just nudge it into view. Takes priority over panning to a
    // *different* node (an attack's other end, below): with bows now
    // anchored near the attacker rather than the target (see getNodeMinDist
    // usage in the positions memo), that other end can be far enough away
    // that panning to it would immediately un-center the node someone just
    // chose.
    centerOnNode(node.nodeId);
    // Clicking either end of an attack still replays its arrow flight (see
    // WeaponMark) — that's independent of where the camera ends up, so it
    // stays regardless of who's centered. A weapon node has exactly one
    // target; an attacked node can carry several landed attacks, so this
    // replays whichever landed most recently (nodes come back in creation
    // order, so the last match is that one).
    if (node.isWeapon) {
      triggerWeaponShot(node.nodeId);
    } else {
      const attackers = nodes.filter((n) => n.isWeapon && nodeRefId(n.targetNodeId) === node.nodeId);
      const latestAttacker = attackers[attackers.length - 1];
      if (latestAttacker) triggerWeaponShot(latestAttacker.nodeId);
    }
  }

  // Confirmed from NodeCard's inline input (see startInlineEdit) — resolves
  // straight to the API, no intermediate form.
  async function confirmInlineEdit(node: NodeDoc, text: string, type: NodeType) {
    setActionError(null);
    try {
      const updated = await nodesApi.updateNode(node.nodeId, { text, type });
      upsertNode(updated);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Update failed");
    } finally {
      setInlineEditId(null);
    }
  }

  function startLinkFrom(nodeId: string) {
    setPackMode(false);
    setPackContainerId(null);
    setPackSelection(new Set());
    setLinkMode(true);
    setLinkSelection([nodeId]);
  }

  // Backs out of link mode entirely without linking anything — shared by
  // the toolbar's own toggle-off, LinkPickerPanel's ✕/Cancel, and anything
  // else that needs to abandon a pick in progress, so they can't drift out
  // of sync on which three pieces of state "not linking" actually means.
  function exitLinkMode() {
    setLinkMode(false);
    setLinkSelection([]);
    setLinkError(null);
  }

  // The current pick list resolved to real nodes (a node deleted mid-pick
  // by someone else just quietly drops out) — read by LinkPickerPanel to
  // render each pick's own text, and by confirmLinkSelection below to
  // actually finish the link.
  const linkPicks = linkSelection
    .map((id) => nodes.find((n) => n.nodeId === id))
    .filter((n): n is NodeDoc => !!n);

  // Turns the current pick list into the pending confirmation — the actual
  // edges (chain, +closing edge for 3+) get created once the sentiment
  // modal this opens is submitted.
  function confirmLinkSelection() {
    if (linkPicks.length < 2) return;
    setPendingLink(linkPicks);
    setLinkMode(false);
    setLinkSelection([]);
  }

  // Opens the pack picker for containerNode — mirrors startLinkFrom, just
  // keyed by one fixed anchor (packContainerId) instead of a growing
  // ordered list. Exits link mode first if it was somehow active (the two
  // share the same bottom-sheet slot — see the JSX below — so only one can
  // really be "active" at once, same mutual exclusivity link mode already
  // gets from NodePanel's own selectedId requirement).
  function startPackFrom(containerNodeId: string) {
    setLinkMode(false);
    setLinkSelection([]);
    setPackMode(true);
    setPackContainerId(containerNodeId);
    setPackSelection(new Set());
    setPackError(null);
  }

  // Backs out of pack mode without packing anything — same "shared by the
  // picker's own ✕/Cancel and anything else abandoning a pick in progress"
  // reasoning exitLinkMode already documents.
  function exitPackMode() {
    setPackMode(false);
    setPackContainerId(null);
    setPackSelection(new Set());
    setPackError(null);
  }

  const packContainer = packContainerId ? nodes.find((n) => n.nodeId === packContainerId) : undefined;
  // Same "resolve picks to real nodes, a mid-pick deletion just drops out"
  // reasoning linkPicks already documents.
  const packPicks = Array.from(packSelection)
    .map((id) => nodes.find((n) => n.nodeId === id))
    .filter((n): n is NodeDoc => !!n);

  // Confirms the current pack selection — packAbl.ts re-validates
  // eligibility/ownership server-side regardless of what got picked here,
  // same "don't trust the client" principle every other confirm-style
  // action in this app already follows.
  async function confirmPackSelection() {
    if (!packContainerId || packPicks.length < 1) return;
    setActionError(null);
    try {
      const res = await nodesApi.packNodes(packContainerId, packPicks.map((n) => n.nodeId));
      upsertNode(res.container);
      res.members.forEach(upsertNode);
      // A packed member can't stay "selected" — it just vanished from the
      // canvas (see visibleNodes below), so NodePanel would be showing a
      // node nobody can see any more.
      if (selectedId && res.members.some((m) => m.nodeId === selectedId)) setSelectedId(null);
      exitPackMode();
    } catch (err) {
      setPackError(err instanceof ApiRequestError ? err.message : "Pack failed");
    }
  }

  // Right-click on empty canvas opens a small type-picker for creating a
  // new, parent-less node right where the click landed (see
  // CanvasContextMenu/confirmPendingCreate) — also dismisses the side panel
  // (which tears down its own quick-add ghost ring, derived from
  // selectedId) and any node context menu, same "close whatever's open
  // first" as before. Right-click *on* a node instead opens that node's own
  // menu — see handleNodeContextMenu, which stops the event before it ever
  // reaches this handler.
  function onCanvasContextMenu(e: ReactMouseEvent<HTMLDivElement>) {
    e.preventDefault();
    setSelectedId(null);
    setContextMenu(null);
    setMultiSelectIds(new Set());
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    setCanvasContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: canvasPos.x, canvasY: canvasPos.y });
  }

  // Rubber-band (marquee) select: a plain left-button drag started on empty
  // canvas — previously unused (panning is native scroll/trackpad, not a
  // click-drag) — sweeps a rectangle and, on release, replaces
  // multiSelectIds with every own, non-weapon node whose position falls
  // inside it. Mirrors onNodePointerDown's own screenToCanvas-based
  // tracking, just for a rectangle instead of a single point.
  function onCanvasPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    // pointerType "touch": a finger-drag on empty canvas is how mobile pans
    // the map at all (the wrap div's own native touch-scroll — there's no
    // trackpad/scrollbar to do it otherwise) — bail out before capturing
    // the pointer so that native scroll can happen, same as this handler
    // simply not existing. Marquee-select is a mouse-drag idea (a
    // rubber-band rectangle) that was only ever "free" to claim on desktop
    // because click-drag on empty canvas did nothing there before (real
    // panning is trackpad/scrollbar-driven); on mobile that same gesture
    // is already spoken for. Tap-to-select/center/ghosts and double-tap-
    // to-edit are unaffected either way — those go through NodeCard's own
    // onClick/onDoubleClick, not this handler, which only ever fires for
    // empty canvas.
    if (linkMode || packMode || e.button !== 0 || e.pointerType === "touch") return;
    const start = screenToCanvas(e.clientX, e.clientY);
    let moved = false;
    // Read directly off the raw pointer event in onUp, same as
    // onNodePointerDown's own onMove/onUp — React state from onMove's
    // setMarquee calls isn't guaranteed to have flushed by the time onUp
    // runs, so onUp recomputes the final point itself rather than trusting
    // `marquee` state.
    let last = start;
    (e.target as Element).setPointerCapture(e.pointerId);
    setMarquee({ x0: start.x, y0: start.y, x1: start.x, y1: start.y });

    function onMove(ev: PointerEvent) {
      const p = screenToCanvas(ev.clientX, ev.clientY);
      last = p;
      if (Math.hypot(p.x - start.x, p.y - start.y) > 4) moved = true;
      setMarquee({ x0: start.x, y0: start.y, x1: p.x, y1: p.y });
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setMarquee(null);
      if (!moved) return;
      // Same captured-pointer artifact onNodePointerDown's own onUp already
      // documents: a pointerdown+pointerup on the same element (this canvas
      // div, via setPointerCapture above) still synthesizes a trailing
      // native `click` on it once released. Without suppressing that here
      // too, the canvas's own onClick (a plain click always deselects/
      // clears multiSelectIds — see its JSX below) fired immediately after
      // this and wiped out the selection this same drag had just computed,
      // so a marquee looked like it "began" (the rectangle drew) but never
      // actually selected anything.
      suppressNextClick.current = true;
      const minX = Math.min(start.x, last.x);
      const maxX = Math.max(start.x, last.x);
      const minY = Math.min(start.y, last.y);
      const maxY = Math.max(start.y, last.y);
      const picked = nodes.filter((n) => {
        if (n.isWeapon || !isOwnNode(n)) return false;
        const p = positions.get(n.nodeId);
        return !!p && p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
      });
      setMultiSelectIds(new Set(picked.map((n) => n.nodeId)));
      setSelectedId(null);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Right-click on a node: CUD + Link for your own nodes (a weapon node
  // included — it's usual for this purpose now, same as everywhere else
  // isOwnNode gates), plus Attack — always, now that canAttackNode is
  // unconditionally true (combat is fully open, see its own comment). So
  // this menu now always has at least Attack to show, own node or not;
  // the `!own && !canAttackNode(node)` guard below is effectively dead
  // (kept rather than special-cased away, in case attack ever gets
  // restricted again).
  function handleNodeContextMenu(node: NodeDoc, e: ReactMouseEvent) {
    const own = isOwnNode(node);
    if (!own && !canAttackNode(node)) {
      setContextMenu(null);
      setSelectedId(node.nodeId);
      return;
    }
    setSelectedId(node.nodeId);
    setContextMenu({ node, x: e.clientX, y: e.clientY });
  }

  async function handleDeleteNode(node: NodeDoc) {
    if (!confirm("Delete this node?")) return;
    try {
      await nodesApi.deleteNode(node.nodeId);
      applyNodeDeleted(node.nodeId);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Delete failed");
    }
  }

  // Shared by the side panel's own Delete button and the context menu's —
  // whichever surface the delete was actually requested from, the local
  // state cleanup (and the resulting deselect) is identical.
  function applyNodeDeleted(id: string) {
    setNodes((prev) => prev.filter((n) => n.nodeId !== id));
    setEdges((prev) => prev.filter((e) => nodeRefId(e.fromNodeId) !== id && nodeRefId(e.toNodeId) !== id));
    setSelectedId(null);
    if (mapId) refreshInsights(mapId);
  }

  // Shared by the backdrop's own toggle-off click and every "clicked
  // outside the chosen cluster" path below — one place actually talking to
  // the API, so both can't ever disagree about what releasing means.
  async function releaseChosenCircle() {
    if (!mapId) return;
    setActionError(null);
    try {
      await mapsApi.deselectCircle(mapId);
      applyCircleSelection(null);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Failed to release the stabilized circle");
    }
  }

  // A click anywhere that isn't the chosen circle itself reads as "done
  // with it" — empty canvas, or any node that isn't one of its own members
  // (own members included on purpose: interacting with the cluster you
  // just chose shouldn't un-choose it). No-ops instantly if nothing's
  // chosen, so callers don't have to guard that themselves.
  function releaseChosenCircleIfOutside(clickedNodeId?: string) {
    const selected = map?.selectedCircle;
    if (!selected) return;
    if (clickedNodeId && selected.nodeIds.includes(clickedNodeId)) return;
    releaseChosenCircle();
  }

  // Stabilize/Release: clicking a circle's own backdrop on the canvas
  // chooses it as the one "held still" — every other circle stays free to
  // drift (see NodeCard's chaotic-drift rendering, keyed off Node.locked).
  // Clicking the *already-chosen* circle's backdrop again releases it
  // (toggle), rather than needing a separate control — same as clicking
  // anywhere outside it now does (see releaseChosenCircleIfOutside).
  async function handleCircleBackdropClick(rootId: string) {
    if (!mapId) return;
    if (map?.selectedCircle?.rootId === rootId) {
      await releaseChosenCircle();
      return;
    }
    setActionError(null);
    try {
      const selected = await mapsApi.selectCircle(mapId, rootId);
      applyCircleSelection(selected);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Failed to update the stabilized circle");
    }
  }

  // Quick-add: clicking one of the half-visible type ghosts fanned around
  // the selected node opens the inline pending-node input at the ghost's
  // spot, pre-set to that type and already branching off the anchor via
  // parentId (a tree-lineage arrow, not a sentiment Edge/"link" — those
  // stay reserved for the explicit "Link nodes" flow). Nothing is created
  // until confirmPendingCreate actually fires.
  function startQuickAdd(type: NodeType, pos: { x: number; y: number }, parent: NodeDoc) {
    setActionError(null);
    // The ghost's slot is a fixed angle around the anchor — it doesn't know
    // about anything else on the canvas, so a crowded area can still land
    // it on top of an unrelated node, or inside some other group's
    // backdrop. Nudge clear before opening the input. The anchor's own
    // group (this new node becomes a member of it too, via parentId) is
    // exempt.
    const ownGroups = new Set(
      nodeGroups
        .filter((g) => g.rootId === parent.nodeId || g.members.some((m) => m.nodeId === parent.nodeId))
        .map((g) => g.rootId),
    );
    const placed = avoidOverlap(
      pos,
      [...nodeObstacles(Array.from(positions.values())), ...bigNodeObstacles(ownGroups)],
      viewportBounds(),
    );
    setInlineEditId(null);
    setPendingCreate({ x: placed.x, y: placed.y, type, parentId: parent.nodeId });
  }

  // Fires once the inline pending-node input (see PendingNodeCard) actually
  // confirms with non-empty text — the one place any node-creation path
  // (toolbar, double-click, "Create branch", quick-add) ends up.
  async function confirmPendingCreate(text: string, type: NodeType) {
    if (!pendingCreate || !mapId) return;
    const { x, y, parentId } = pendingCreate;
    setActionError(null);
    try {
      const node = await nodesApi.createNode(mapId, { text, type, x, y, parentId });
      upsertNode(node);
      setCelebrateIds((prev) => new Set(prev).add(node.nodeId));
      setSelectedId(node.nodeId);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Failed to create node");
    } finally {
      setPendingCreate(null);
    }
  }

  // Ctrl/Cmd+C / Ctrl/Cmd+V — see the keydown effect below and
  // nodeClipboard's own module-level doc comment. Copies the currently
  // selected node(s) (multiSelectIds if any are picked, else the single
  // selectedId) as plain text+type+position snapshots — nothing structural
  // (parentId, Edges, health, attacks) carries over, so a paste is always a
  // set of brand-new, unlinked nodes, never a re-parented copy of the
  // originals.
  //
  // Fixed offset (not random/growing) so a repeated copy-paste-paste-paste
  // on the *same* map fans pasted copies out along one consistent diagonal
  // instead of clustering — avoidOverlap (used when actually placing each
  // one, below) still nudges clear of whatever's already there regardless.
  const PASTE_OFFSET = 40;

  function copySelection() {
    if (!mapId) return;
    const ids = multiSelectIds.size > 0 ? Array.from(multiSelectIds) : selectedId ? [selectedId] : [];
    if (ids.length === 0) return;
    const copied = ids
      .map((id) => nodes.find((n) => n.nodeId === id))
      .filter((n): n is NodeDoc => !!n && !n.isWeapon)
      .map((n) => {
        const pos = positions.get(n.nodeId) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 };
        return { text: n.text, type: n.type, x: pos.x, y: pos.y };
      });
    if (copied.length > 0) nodeClipboard = { sourceMapId: mapId, nodes: copied };
  }

  async function pasteClipboard() {
    const clipboard = nodeClipboard;
    if (!clipboard || !mapId) return;
    setActionError(null);
    // Pasting back into the map it was copied from: keep the originals'
    // own positions as the anchor (PASTE_OFFSET nudges just clear of them).
    // Pasting into a *different* map: those raw x/y are meaningless here —
    // that map's own layout has nothing to do with this one's — so anchor
    // the whole copied group at a fresh spot inside the *current* viewport
    // instead (same call "+ Add node" already uses), preserving the
    // copied nodes' own relative arrangement around that new anchor rather
    // than each one's original absolute position.
    const sameMap = clipboard.sourceMapId === mapId;
    let anchorDx = 0;
    let anchorDy = 0;
    if (!sameMap) {
      const cx = clipboard.nodes.reduce((s, n) => s + n.x, 0) / clipboard.nodes.length;
      const cy = clipboard.nodes.reduce((s, n) => s + n.y, 0) / clipboard.nodes.length;
      const anchor = pickNonOverlappingPosition(Array.from(positions.values()), bigNodeObstacles(), viewportBounds());
      anchorDx = anchor.x - cx;
      anchorDy = anchor.y - cy;
    }
    try {
      const created = await Promise.all(
        clipboard.nodes.map(async ({ text, type, x, y }) => {
          const desired = sameMap
            ? { x: x + PASTE_OFFSET, y: y + PASTE_OFFSET }
            : { x: x + anchorDx, y: y + anchorDy };
          const placed = avoidOverlap(
            desired,
            [...nodeObstacles(Array.from(positions.values())), ...bigNodeObstacles()],
            viewportBounds(),
          );
          return nodesApi.createNode(mapId, { text, type, x: placed.x, y: placed.y, parentId: null });
        }),
      );
      created.forEach((n) => {
        upsertNode(n);
        setCelebrateIds((prev) => new Set(prev).add(n.nodeId));
      });
      // The pasted copies become the new selection — same "what you just
      // did is now selected" convention confirmPendingCreate/group-drag
      // already follow, so it's immediately obvious what paste produced
      // and a follow-up paste (offset again from *these*, not the
      // originals) reads as "keep fanning out from here."
      if (created.length > 1) {
        setSelectedId(null);
        setMultiSelectIds(new Set(created.map((n) => n.nodeId)));
      } else if (created.length === 1) {
        setMultiSelectIds(new Set());
        setSelectedId(created[0].nodeId);
      }
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Failed to paste");
    }
  }

  // SelectionMenu's "Delete N nodes" — one DELETE per selected node, in
  // parallel, same shape as pasteClipboard's own Promise.all(createNode).
  // Confirms once for the whole batch rather than once per node (the
  // single-node handleDeleteNode's own confirm() would be absurd N times
  // in a row here).
  async function deleteSelection() {
    const ids = Array.from(multiSelectIds);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} node${ids.length === 1 ? "" : "s"}?`)) return;
    setActionError(null);
    try {
      await Promise.all(ids.map((id) => nodesApi.deleteNode(id)));
      setNodes((prev) => prev.filter((n) => !ids.includes(n.nodeId)));
      setEdges((prev) =>
        prev.filter((e) => !ids.includes(nodeRefId(e.fromNodeId) ?? "") && !ids.includes(nodeRefId(e.toNodeId) ?? "")),
      );
      setMultiSelectIds(new Set());
      if (mapId) refreshInsights(mapId);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Failed to delete the selected nodes");
    }
  }

  // SelectionMenu's "Group into circle" — turns the current multi-selection
  // into a circle (see circleAbl.ts / the app's own parentId-star mechanism,
  // same as dragging one node onto another to join its circle): every
  // selected node except one gets its parentId set to that one, so with
  // 3+ selected the result is immediately a real circle (nodeGroups needs
  // 2+ direct children); with exactly 2, it's just a plain branch link
  // until a third node joins later. The root is picked automatically —
  // whichever selected node sits closest to the group's own centroid —
  // since there's no per-node "make this the root" control on this pill.
  // isDescendant guards each reparent the same way findDropTarget's own
  // drag-to-join path already does: skip (don't create) a link that would
  // close the parentId chain into a loop, rather than silently corrupting
  // the tree.
  async function groupSelectionIntoCircle() {
    const selectedNodes = Array.from(multiSelectIds)
      .map((id) => nodes.find((n) => n.nodeId === id))
      .filter((n): n is NodeDoc => !!n);
    if (selectedNodes.length < 2) return;
    const pts = selectedNodes.map((n) => positions.get(n.nodeId) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 });
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    let rootIndex = 0;
    let bestDist = Infinity;
    pts.forEach((p, i) => {
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < bestDist) {
        bestDist = d;
        rootIndex = i;
      }
    });
    const root = selectedNodes[rootIndex];
    const others = selectedNodes.filter((n) => n.nodeId !== root.nodeId);
    setActionError(null);
    try {
      const results = await Promise.all(
        others.map(async (n) => {
          if (isDescendant(root.nodeId, n.nodeId, nodes)) return null;
          return nodesApi.updateNode(n.nodeId, { parentId: root.nodeId });
        }),
      );
      results.forEach((n) => {
        if (n) upsertNode(n);
      });
      const skipped = results.filter((r) => r === null).length;
      if (skipped > 0) {
        setActionError(
          `Grouped ${results.length - skipped} of ${others.length} node${others.length === 1 ? "" : "s"} — ${skipped} would have closed a loop and ${skipped === 1 ? "was" : "were"} left alone.`,
        );
      }
      setMultiSelectIds(new Set());
      setSelectedId(root.nodeId);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Failed to group into a circle");
    }
  }

  // AddMenu's "Create circle" — a root plus 2 children, parented to it, so
  // the result is an instant, already-formed circle (nodeGroups needs 2+
  // direct children) rather than needing to branch twice by hand.
  // Sequential, not Promise.all: the children's own create calls need the
  // root's real (server-assigned) nodeId as their parentId, so the root
  // has to actually finish first.
  async function createCircle() {
    if (!mapId) return;
    setActionError(null);
    try {
      const rootPos = pickNonOverlappingPosition(Array.from(positions.values()), bigNodeObstacles(), viewportBounds());
      const root = await nodesApi.createNode(mapId, {
        text: "New circle",
        type: "unknown",
        x: rootPos.x,
        y: rootPos.y,
        parentId: null,
      });
      upsertNode(root);
      setCelebrateIds((prev) => new Set(prev).add(root.nodeId));

      // Two children fanned either side of straight up from the root —
      // same angle-from-vertical idea QuickAddGhosts' own ring uses, just
      // two fixed slots instead of one per node type.
      const radius = getNodeMinDist() + 40;
      const children = await Promise.all(
        [-50, 50].map(async (deg) => {
          const angle = (-90 + deg) * (Math.PI / 180);
          const desired = { x: rootPos.x + radius * Math.cos(angle), y: rootPos.y + radius * Math.sin(angle) };
          const placed = avoidOverlap(
            desired,
            [...nodeObstacles([...Array.from(positions.values()), rootPos]), ...bigNodeObstacles()],
            viewportBounds(),
          );
          return nodesApi.createNode(mapId, {
            // "Option" (not "unknown", like the root) — circleSentiment
            // needs at least one non-"unknown" member to draw a backdrop
            // at all (a majority-vote of ties/no-votes draws nothing —
            // see nodeGroups' own doc comment), so an all-"unknown" trio
            // would create a real parentId circle that never actually
            // *looks* like one until someone manually retypes a member.
            // Giving both children a real (positive) type up front means
            // "Create circle" shows an actual circle immediately.
            text: "New node",
            type: "Option",
            x: placed.x,
            y: placed.y,
            parentId: root.nodeId,
          });
        }),
      );
      children.forEach((c) => {
        upsertNode(c);
        setCelebrateIds((prev) => new Set(prev).add(c.nodeId));
      });

      setMultiSelectIds(new Set());
      setSelectedId(root.nodeId);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Failed to create a circle");
    }
  }

  // Global Ctrl/Cmd+C / Ctrl/Cmd+V for the current node selection — ignored
  // whenever focus is inside a real text field (NodePanel's textarea, the
  // inline node-caption editor, PendingNodeCard's input, an attack
  // objection box, …), so normal copy/paste of *text* inside those keeps
  // working exactly as the browser already handles it; this only ever
  // fires for the "nothing text-editable is focused" case, i.e. the
  // canvas/selection itself has the user's attention.
  useEffect(() => {
    function isEditableTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || isEditableTarget(e.target)) return;
      if (e.key === "c" || e.key === "C") {
        copySelection();
      } else if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        pasteClipboard();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  if (loading) return <div className="p-12 text-center text-ink-soft">Loading map…</div>;
  if (error || !map) {
    return (
      <div className="mx-auto w-full max-w-[1080px] px-6 pt-8 pb-16">
        <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">
          {error || "Map not found"}
        </div>
        <Link to="/">&larr; Back to maps</Link>
      </div>
    );
  }

  const isOwner = map.ownerId === user?._id;

  // Reused across this toolbar's several same-styled buttons — kept local
  // (not shared across files) so every className stays one look-here-and-
  // you-see-it string, same as everywhere else in this migration.
  const btnSm =
    "inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50";
  const btnSmPrimary =
    "inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-white transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
  const btnSmGhost =
    "inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-transparent bg-transparent px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {actionError && (
        <div className="mx-4 mt-[0.6rem] flex items-center justify-between gap-3 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">
          {actionError}
          <button className={btnSmGhost} onClick={() => setActionError(null)}>
            ✕
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* This extra wrapper exists purely so MiniMap has somewhere to sit
            that's positioned relative to the *viewport* (this flex cell)
            rather than the scrolling canvas itself — an absolutely
            positioned child of wrapRef would scroll away with the canvas
            content, same as everything else inside it. */}
        <div className="relative min-w-0 flex-1">
          {/* [overscroll-behavior-x:none]: index.css already sets this on
              <body>, but that only stops the *document's* own overscroll
              from chaining into a browser back-navigation — this canvas is
              its own independently-scrolling element (overflow-auto), so
              a trackpad swipe that runs it into its own left scroll edge
              (scrollLeft 0) was still handing the overscroll off to the
              page above it, which is what a laptop's two-finger swipe
              reads as "go back." Setting it here too stops the chain at
              the canvas itself, before it ever reaches the document. */}
          <div
            className="h-full w-full overflow-auto [overscroll-behavior-x:none] bg-[radial-gradient(circle,var(--line)_1px,transparent_1px)] [background-size:22px_22px]"
            ref={wrapRef}
          >
          <div
            ref={canvasRef}
            // select-none: without it, a left-drag on empty canvas (the
            // marquee/rubber-band gesture — see onCanvasPointerDown) also
            // triggers the browser's own native text-selection drag (there's
            // plenty of selectable text — every node caption — sitting right
            // there), painting its own blue highlight over whatever the drag
            // passed across. The two aren't mutually exclusive — pointer
            // events still fire either way — but the native highlight reads
            // as "nothing is happening" (or actively wrong) over the actual
            // accent-colored marquee rectangle, and in some browsers a
            // native selection drag can itself swallow/alter the pointer
            // event stream. NodeCard's own outer div already opts out the
            // same way for the same reason (see its own select-none).
            className={`relative select-none${linkMode || packMode ? " cursor-crosshair" : ""}`}
            // width/height stay the canvas's own native 2400x1600 — zoom is
            // purely a paint-time transform, so every node/ghost/SVG
            // position below (all still expressed in that native 0..2400
            // coordinate space) scales along with it automatically, no
            // separate math needed anywhere else in this JSX. transformOrigin
            // "0 0" keeps that scaling anchored at the canvas's own top-left,
            // matching what screenToCanvas/zoomAt/viewportBounds/
            // centerOnNode above already assume when they read wrap's own
            // scroll position directly.
            style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${zoom})`, transformOrigin: "0 0" }}
            onClick={() => {
              // See onCanvasPointerDown's own onUp comment — the trailing
              // native click a completed marquee drag leaves behind on this
              // same element would otherwise immediately clear the
              // selection that drag just computed.
              if (suppressNextClick.current) {
                suppressNextClick.current = false;
                return;
              }
              if (linkMode || packMode) return;
              setSelectedId(null);
              setMultiSelectIds(new Set());
              releaseChosenCircleIfOutside();
            }}
            onPointerDown={onCanvasPointerDown}
            onContextMenu={onCanvasContextMenu}
          >
            {/* Invisible spacer, not real canvas content — extends wrap's
                own scrollable range past the canvas's actual bottom edge by
                bottomScrollMargin canvas units (see its own doc comment).
                Without this, wrap can never scroll further down than
                "the canvas's last pixel is at the bottom of the viewport" —
                fine for a node in the middle of the map, but a node sitting
                right at/near that bottom edge has nowhere left to scroll
                to: centerOnNode's target scroll position gets clamped back
                to that same maxTop, landing the node near the bottom of the
                screen — right where NodePanel's sheet lives — instead of
                actually centered above it. 1px wide (not 0 — some browsers
                don't count a zero-size box toward scrollable overflow at
                all) and otherwise invisible: no fill, no border, and
                pointer-events none so it can never intercept a click meant
                for the canvas beneath it. Doesn't need to *look* like
                anything either way — scrolling into it just reveals more of
                wrap's own dot-grid background (see wrap's className above),
                which already tiles seamlessly across this space exactly
                like the rest of the canvas. */}
            <div
              aria-hidden
              className="pointer-events-none absolute"
              style={{ left: 0, top: CANVAS_H, width: 1, height: bottomScrollMargin }}
            />
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            >
              {/*
                Zones: the outline polygon traced through every member of a group (root + its 2+
                direct parentId-children — see nodeGroups) — a triangle at the 3-member minimum,
                growing to a quad/pentagon/hexagon/… as the group grows, colored by the group's
                own majority sentiment (positive-majority halo-gold, negative-majority horns-red).
                Deepest layer on the canvas, under even the link figures below — every member
                stays a real, individually clickable node; this is purely a backdrop. Shape
                actually reflects the tree's own spread now instead of one fixed bounding circle
                either overlapping unrelated nodes or leaving a lot of empty space, and it visibly
                deforms live as members get dragged around — nodeGroups recomputes `outline` from
                current positions (including mid-drag) on every render, nothing here is a
                snapshot. Same "click to stabilize" control the old plain-circle backdrop had.
              */}
              {nodeGroups.map((g) => {
                const color = g.sentiment === "positive" ? ZONE_COLORS.positive : ZONE_COLORS.negative;
                // Same "chosen one stays fuller-opacity, every other zone
                // dims" spotlight the branch-arrow lines below (and the
                // minimap's own zones) use — one shared signal for which
                // group, if any, is currently stabilized.
                const isStabilized = map?.selectedCircle?.rootId === g.rootId;
                const dimmed = !!map?.selectedCircle && !isStabilized;
                return (
                  <polygon
                    key={`zone-${g.rootId}`}
                    points={g.outline.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill={color}
                    fillOpacity={dimmed ? 0.06 : 0.14}
                    stroke={color}
                    strokeOpacity={dimmed ? 0.25 : 0.5}
                    strokeWidth={2.5}
                    // The whole overlay SVG is pointer-events-none (so its
                    // decorative shapes never steal a drag/click from a
                    // NodeCard div sitting underneath) — a zone is one of
                    // the few things in it that's actually meant to be
                    // clicked, so it has to explicitly opt back in.
                    style={{ cursor: "pointer", pointerEvents: "auto" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCircleBackdropClick(g.rootId);
                    }}
                  >
                    <title>
                      {isStabilized
                        ? "Stabilized — click it, or click anywhere outside it, to let it drift with the others"
                        : "Click to stabilize this zone and let every other zone drift"}
                    </title>
                  </polygon>
                );
              })}
              {/*
                Figures: any closed loop in the Link graph — colored fill as a backdrop, under
                everything else. A plain two-node link is a line and can never close, so it never
                shows up here; this is what "except line" means in practice, not a special case.
              */}
              {linkCycles.map((cycle) => {
                const pts = cycle
                  .map((id) => nodes.find((n) => n.nodeId === id))
                  .filter((n): n is NodeDoc => !!n)
                  .map((n) => posFor(n));
                if (pts.length < 3) return null;
                return (
                  <polygon
                    key={`figure-${cycle.slice().sort().join("-")}`}
                    points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="var(--accent)"
                    fillOpacity={0.1}
                    stroke="var(--accent)"
                    strokeOpacity={0.4}
                    strokeWidth={1.5}
                  />
                );
              })}
              {/*
                Branch arrows: tree lineage (node.parentId), set when a node is created via
                the quick-add ghosts off an existing node — drawn over the zone polygon above, so
                the direction/depth of who-branched-off-whom stays visible inside its own zone. A
                branch that's part of a "circle" (its parent has 2+ such children — see
                nodeGroups) is colored by the group's own majority sentiment (positive-majority
                halo-gold, negative-majority horns-red), same as the zone it's inside, and doubles
                as that circle's stabilize/release control too — one more place to click it,
                alongside the zone shape itself. A lone branch (its parent has just this one
                child, no group at all — nothing for a zone to enclose) keeps the plain,
                unclickable accent dash.
              */}
              {visibleNodes.map((node) => {
                const parentId = nodeRefId(node.parentId);
                if (!parentId) return null;
                const parentNode = visibleNodes.find((n) => n.nodeId === parentId);
                if (!parentNode) return null;
                const a = posFor(parentNode);
                const b = posFor(node);
                const group = nodeGroups.find((g) => g.rootId === parentId);
                const color = group ? (group.sentiment === "positive" ? ZONE_COLORS.positive : ZONE_COLORS.negative) : "var(--accent)";
                // Same "chosen one stays full-opacity, every other circle
                // dims" spotlight the old backdrop drew — see its own
                // removed comment for why. Ungrouped branches never dim for
                // *that* reason; they were never part of the spotlight to
                // begin with. A 2+-node group selection dims independently
                // of all that — any branch with neither end selected fades,
                // grouped or not, so the selection's own neighborhood reads
                // clearly against everything else (see NodeCard's matching
                // `muted` computation and the plain-Edge dimming just below).
                const isStabilized = !!group && map?.selectedCircle?.rootId === group.rootId;
                const circleDimmed = !!group && !!map?.selectedCircle && !isStabilized;
                const multiSelectDimmed =
                  multiSelectIds.size > 0 && !multiSelectIds.has(parentId) && !multiSelectIds.has(node.nodeId);
                const dimmed = circleDimmed || multiSelectDimmed;
                return (
                  <line
                    key={`branch-${node.nodeId}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={color}
                    strokeOpacity={dimmed ? 0.2 : group ? 0.85 : 0.45}
                    strokeWidth={group ? 1.75 : 1.5}
                    strokeDasharray={group ? undefined : "5 4"}
                    markerEnd="url(#branch-arrow)"
                    // The whole overlay SVG is pointer-events-none (so its
                    // decorative edges/arrows never steal a drag/click from
                    // a NodeCard div sitting underneath) — a grouped branch
                    // is the one case here that's actually meant to be
                    // clicked (see handleCircleBackdropClick, same handler
                    // the old backdrop circle used), so it has to explicitly
                    // opt back in; an ungrouped one stays inert.
                    style={group ? { cursor: "pointer", pointerEvents: "auto" } : undefined}
                    onClick={
                      group
                        ? (e) => {
                            e.stopPropagation();
                            handleCircleBackdropClick(group.rootId);
                          }
                        : undefined
                    }
                  >
                    {group && (
                      <title>
                        {isStabilized
                          ? "Stabilized — click it, or click anywhere outside it, to let it drift with the others"
                          : "Click to stabilize this circle and let every other circle drift"}
                      </title>
                    )}
                  </line>
                );
              })}
              {/* Plain lines, no arrowhead — Edges are an undirected "these
                  two are linked, and here's how they feel about each
                  other" relationship (the sentiment color is the actual
                  payload), not a directed one the way a branch arrow or a
                  weapon's bow is, so an arrowhead here was implying a
                  direction this doesn't actually have. */}
              {edges.map((edge) => {
                // fromNodeId/toNodeId come back null (not a string, not a
                // populated ref) when the node they pointed at was deleted
                // out from under the edge — skip rendering rather than
                // crash on `.nodeId` of null.
                const fromId = nodeRefId(edge.fromNodeId);
                const toId = nodeRefId(edge.toNodeId);
                if (!fromId || !toId) return null;
                const fromNode = nodes.find((n) => n.nodeId === fromId);
                const toNode = nodes.find((n) => n.nodeId === toId);
                if (!fromNode || !toNode) return null;
                const a = posFor(fromNode);
                const b = posFor(toNode);
                const color =
                  edge.sentiment === "negative"
                    ? "var(--danger)"
                    : edge.sentiment === "positive"
                      ? "var(--success)"
                      : "var(--ink-soft)";
                // Same multi-select dimming the branch arrows above and
                // NodeCard's own `muted` prop apply — an edge with neither
                // end in the group selection fades, so the selected nodes'
                // own connections read clearly against the rest.
                const dimmed = multiSelectIds.size > 0 && !multiSelectIds.has(fromId) && !multiSelectIds.has(toId);
                return (
                  <line
                    key={edge.edgeId}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={color}
                    strokeWidth={2}
                    strokeOpacity={dimmed ? 0.15 : 1}
                  />
                );
              })}
              {/* Picking phase: every node picked so far stays lit while more get added. */}
              {linkSelection.map((id) => {
                const picked = nodes.find((n) => n.nodeId === id);
                if (!picked) return null;
                const p = posFor(picked);
                return (
                  <circle key={`pick-${id}`} cx={p.x} cy={p.y} r={18} fill="none" stroke="var(--accent)" strokeWidth={3} />
                );
              })}
              {/* Confirming phase: the whole picked set stays lit while the sentiment modal is open. */}
              {pendingLink?.map((n) => {
                const p = posFor(n);
                return (
                  <circle
                    key={`pending-${n.nodeId}`}
                    cx={p.x}
                    cy={p.y}
                    r={18}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={3}
                  />
                );
              })}
              <defs>
                {/* fill="context-stroke": picks up whichever line is
                    actually using this marker's own `stroke` (plain accent
                    for an ungrouped branch, the group's gold/red sentiment
                    color for a grouped one — see the branch-arrows map
                    above) instead of one fixed color for every branch. */}
                <marker id="branch-arrow" markerWidth="4.5" markerHeight="4.5" refX="4" refY="2.25" orient="auto">
                  <path d="M0,0 L4.5,2.25 L0,4.5 Z" fill="context-stroke" opacity="0.75" />
                </marker>
              </defs>
            </svg>

            {visibleNodes.map((node) => {
              const pos = posFor(node);
              const editingThis = inlineEditId === node.nodeId;
              // Weapon nodes only: fly in from the direction away from their
              // target (fixed 150px so a distant attack doesn't launch it
              // from absurdly far away), so the entrance animation reads as
              // "just landed from what it hit" instead of an arbitrary
              // random direction. See NodeCard's flightVector doc comment.
              let flightVector: { x: number; y: number } | undefined;
              if (node.isWeapon) {
                const targetId = nodeRefId(node.targetNodeId);
                const target = targetId ? nodes.find((t) => t.nodeId === targetId) : undefined;
                if (target) {
                  const targetPos = posFor(target);
                  const dx = pos.x - targetPos.x;
                  const dy = pos.y - targetPos.y;
                  const dist = Math.hypot(dx, dy) || 1;
                  const scale = 150 / dist;
                  flightVector = { x: dx * scale, y: dy * scale };
                }
              }
              return (
                <NodeCard
                  key={node.nodeId}
                  node={node}
                  x={pos.x}
                  y={pos.y}
                  zoom={zoom}
                  selected={selectedId === node.nodeId}
                  multiSelected={multiSelectIds.has(node.nodeId)}
                  dragging={dragState?.nodeId === node.nodeId || groupDragState?.has(node.nodeId) === true}
                  canDrag={isOwnNode(node)}
                  groupSentiment={groupSentimentByNode.get(node.nodeId)}
                  indicator={indicatorByNode.get(node.nodeId)}
                  packedCount={packedCountByContainer.get(node.nodeId)}
                  linkModeActive={linkMode}
                  discussionMode={!!map.discussionMode}
                  celebrate={celebrateIds.has(node.nodeId)}
                  flightVector={flightVector}
                  muted={
                    ((quickAddActive && node.nodeId !== selectedId) ||
                      (!!spotlightedNodeIds && !spotlightedNodeIds.includes(node.nodeId)) ||
                      (multiSelectIds.size > 0 && !multiSelectIds.has(node.nodeId))) &&
                    !unmutedAttackNodeIds?.has(node.nodeId)
                  }
                  dropHighlight={dropTarget?.nodeId === node.nodeId ? (dropTarget.valid ? "valid" : "invalid") : undefined}
                  inlineEditing={editingThis}
                  onInlineConfirm={(text, type) => confirmInlineEdit(node, text, type)}
                  onInlineCancel={() => setInlineEditId(null)}
                  onPointerDown={editingThis ? undefined : (e) => onNodePointerDown(node, e)}
                  onClick={(e) => {
                    if (suppressNextClick.current) {
                      suppressNextClick.current = false;
                      return;
                    }
                    handleNodeClick(node, e.shiftKey);
                  }}
                  onDoubleClick={() => startInlineEdit(node)}
                  onContextMenu={(e) => handleNodeContextMenu(node, e)}
                />
              );
            })}

            {/*
              Weapon marks get their own SVG layer, painted after every NodeCard above rather
              than inside the first (backdrop) SVG — that one sits *behind* the node icons the
              same way the group backdrops and branch arrows need to, but a bow drawn at that
              layer landed centered right under its own attack node's opaque circular icon.
              z-[34] (not just "a later DOM sibling"): NodeCard itself carries an explicit
              z-31/z-32 now (see its own zIndexClass, added so nodes/ghosts/the pending-create
              input stay above MapPage's NodePanel backdrop) — a sibling with an explicit
              positive z-index always paints over a z-index:auto one regardless of DOM order, so
              once NodeCard stopped being auto-stacked, being "merely later in the DOM" here
              stopped being enough to draw on top of it; this SVG rendered its bow/arrows
              completely hidden behind every node from that point on. The explicit z-[34] is
              what actually keeps this on top now, DOM order is incidental. Every attack now
              spawns a real node carrying the attacker's objection (see attackAbl.ts) — this is
              the permanent bow facing whatever it targeted, plus the volley of transient arrows
              (see WeaponMark) that fires once when the attack lands and again on demand when
              either end gets clicked.
            */}
            <svg
              className="pointer-events-none absolute inset-0 z-[34] h-full w-full"
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            >
              {visibleNodes
                .filter((n) => n.isWeapon)
                .map((weaponNode) => {
                  const targetId = nodeRefId(weaponNode.targetNodeId);
                  if (!targetId) return null;
                  const targetNode = visibleNodes.find((n) => n.nodeId === targetId);
                  if (!targetNode) return null;
                  const a = posFor(weaponNode);
                  const b = posFor(targetNode);
                  // A weapon node can carry any outcome type now, not just
                  // the negative-framed ones (see Backend's attackAbl.ts —
                  // retaliation especially is naturally a positive claim,
                  // "my defense holds") — var(--danger) red for every bow
                  // read oddly on one of those, so a halo-classified
                  // weapon (ringKindFor, same classification the badge's
                  // own halo/horns crown uses) draws its bow in
                  // var(--n-option) blue instead.
                  const bowColor = ringKindFor(weaponNode.type) === "halo" ? "var(--n-option)" : "var(--danger)";
                  return (
                    <WeaponMark
                      key={`weapon-${weaponNode.nodeId}`}
                      x={a.x}
                      y={a.y}
                      targetX={b.x}
                      targetY={b.y}
                      weaponIcon={weaponNode.weaponIcon}
                      color={bowColor}
                      celebrate={celebrateIds.has(weaponNode.nodeId)}
                      replayNonce={shotState?.id === weaponNode.nodeId ? shotState.nonce : 0}
                    />
                  );
                })}
            </svg>

            {/* Shields — one per active protection node, drawn on the node
                it protects (not the protection node's own spot), oriented
                toward whichever protector it came from. Same dedicated
                overlay-layer treatment as the weapon marks above, for the
                same reason (has to paint above every NodeCard, z-31/32). */}
            <svg
              className="pointer-events-none absolute inset-0 z-[34] h-full w-full"
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            >
              {visibleNodes
                .filter((n) => n.isProtection && !n.defeated)
                .map((protectionNode) => {
                  const protectedId = nodeRefId(protectionNode.protectsNodeId);
                  if (!protectedId) return null;
                  const protectedNode = visibleNodes.find((n) => n.nodeId === protectedId);
                  if (!protectedNode) return null;
                  const a = posFor(protectedNode);
                  const b = posFor(protectionNode);
                  return (
                    <ShieldMark
                      key={`shield-${protectionNode.nodeId}`}
                      x={a.x}
                      y={a.y}
                      protectorX={b.x}
                      protectorY={b.y}
                    />
                  );
                })}
            </svg>

            {quickAddActive && selectedNode && !pendingCreate && !inlineEditId && (
              <QuickAddGhosts
                anchorPos={posFor(selectedNode)}
                bounds={viewportBounds()}
                onPick={(type, pos) => startQuickAdd(type, pos, selectedNode)}
              />
            )}

            {pendingCreate && (
              <PendingNodeCard
                x={pendingCreate.x}
                y={pendingCreate.y}
                type={pendingCreate.type}
                onConfirm={confirmPendingCreate}
                onCancel={() => setPendingCreate(null)}
              />
            )}

            {/* Rubber-band select rectangle — see onCanvasPointerDown. A
                plain absolutely-positioned div (not another SVG layer) in
                the same raw canvas coordinates every NodeCard already uses,
                so it scales/pans along with the rest of the canvas via the
                canvas div's own transform, no separate math needed. */}
            {marquee && (
              <div
                className="pointer-events-none absolute z-[20]"
                style={{
                  left: Math.min(marquee.x0, marquee.x1),
                  top: Math.min(marquee.y0, marquee.y1),
                  width: Math.abs(marquee.x1 - marquee.x0),
                  height: Math.abs(marquee.y1 - marquee.y0),
                  border: "1.5px solid var(--accent)",
                  background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                }}
              />
            )}
          </div>
          </div>
          <MiniMap
            wrapRef={wrapRef}
            groups={nodeGroups}
            canvasW={CANVAS_W}
            canvasH={CANVAS_H}
            zoom={zoom}
          />

          {/* The whole top toolbar collapses to this one compact floating
              cluster — Back + a single "+" menu (Invite/Create/Node types)
              — pinned top-left instead of a separate full-width bar. Same
              z-[45] reasoning as the minimap/zoom-controls cluster below
              (which stays put, bottom-right, on its own): above
              canvas/panel, below a real modal. */}
          <div className="absolute top-3 left-3 z-[45] flex items-center gap-1 rounded-card border border-line bg-surface p-1 shadow-card">
            <Link
              to="/"
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-[0.95rem] font-semibold text-ink hover:bg-surface-2"
              title="Back to maps"
            >
              &larr;
            </Link>
            <div className="relative">
              <button
                type="button"
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-[1.05rem] font-semibold text-ink hover:bg-surface-2"
                title="Add"
                onClick={() => setShowAddMenu((v) => !v)}
              >
                +
              </button>
              {showAddMenu && (
                <AddMenu
                  isOwner={isOwner}
                  onClose={() => setShowAddMenu(false)}
                  onInvite={() => {
                    setShowAddMenu(false);
                    setShowInvite(true);
                  }}
                  onCreateNode={() => {
                    setShowAddMenu(false);
                    const pos = pickNonOverlappingPosition(
                      Array.from(positions.values()),
                      bigNodeObstacles(),
                      viewportBounds(),
                    );
                    setInlineEditId(null);
                    setPendingCreate({ x: pos.x, y: pos.y, type: "unknown", parentId: null });
                  }}
                  onCreateCircle={() => {
                    setShowAddMenu(false);
                    createCircle();
                  }}
                  onNodeTypes={() => {
                    setShowAddMenu(false);
                    setShowNodeTypesLegend(true);
                  }}
                />
              )}
            </div>
          </div>

          {/* Zoom controls — stacked directly above the minimap in the same
              bottom-right corner (used to sit bottom-left; moved to keep
              both of the canvas's floating controls in one place instead
              of split across the screen). bottom-[150px]: minimap's own
              bottom-3 (12px) plus its ~122px rendered height (120px
              MINIMAP_H + its 1px border each side) plus a small gap, so
              this sits just above it rather than touching. Same z-[45]
              reasoning as the minimap: above the canvas/panel, below a
              real modal. */}
          <div className="absolute bottom-[150px] right-3 z-[45] flex items-center gap-1 rounded-card border border-line bg-surface p-1 shadow-card">
            <button
              type="button"
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-[0.95rem] font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={zoom <= MIN_ZOOM}
              title="Zoom out"
              onClick={() => {
                const r = wrapRef.current?.getBoundingClientRect();
                if (!r) return;
                zoomAt(r.left + r.width / 2, r.top + r.height / 2, -ZOOM_STEP);
              }}
            >
              −
            </button>
            <button
              type="button"
              className="inline-flex h-7 min-w-[3.2rem] cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent px-1 text-[0.72rem] font-semibold text-ink-soft hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={zoom === 1}
              title="Reset zoom"
              onClick={() => {
                const r = wrapRef.current?.getBoundingClientRect();
                if (!r) return;
                zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0, 1);
              }}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-[0.95rem] font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={zoom >= MAX_ZOOM}
              title="Zoom in"
              onClick={() => {
                const r = wrapRef.current?.getBoundingClientRect();
                if (!r) return;
                zoomAt(r.left + r.width / 2, r.top + r.height / 2, ZOOM_STEP);
              }}
            >
              +
            </button>
          </div>
        </div>

        {/* LinkPickerPanel takes over this same bottom-sheet slot while
            link mode is active, NodePanel included — starting a link from
            a node's own "Link from this node" button leaves that node
            selected (startLinkFrom doesn't clear selectedId), so without
            this the two would try to render at once. It also means the
            dimming backdrop below never has to coexist with active
            picking — that backdrop's job is "tap outside NodePanel closes
            it," which isn't what a tap on empty canvas should do while
            you're mid-pick. */}
        {packMode && packContainer ? (
          <PackPickerPanel
            containerText={packContainer.text}
            picks={packPicks}
            error={packError}
            onRemove={(id) =>
              setPackSelection((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              })
            }
            onConfirm={confirmPackSelection}
            onCancel={exitPackMode}
          />
        ) : linkMode ? (
          <LinkPickerPanel
            picks={linkPicks}
            error={linkError}
            onRemove={(id) => setLinkSelection((prev) => prev.filter((x) => x !== id))}
            onConfirm={confirmLinkSelection}
            onCancel={exitLinkMode}
          />
        ) : multiSelectIds.size > 0 ? (
          // Group selection takes over this same bottom-sheet slot instead
          // of NodePanel — a single node's panel doesn't make sense once
          // this mode is active (even with just one node caught by a small
          // marquee — see onCanvasPointerDown's onUp, which always clears
          // `selectedId` once a marquee resolves, size 1 or more, so
          // NodePanel would never mount for it either way). Move (drag any
          // selected node) plus the Actions dropdown (Copy/Group into
          // circle/Delete — see SelectionMenu) and Deselect; per-node
          // editing/attacking still needs dropping back to a single
          // selection first.
          <div className="fixed inset-x-0 bottom-0 z-[46] flex items-center justify-between gap-3 border-t border-line bg-surface px-5 py-3 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3">
              <span className="text-[0.88rem] font-semibold text-ink">
                {multiSelectIds.size} node{multiSelectIds.size === 1 ? "" : "s"} selected
              </span>
              <div className="relative">
                <button className={btnSm} onClick={() => setShowSelectionMenu((v) => !v)}>
                  Actions
                </button>
                {showSelectionMenu && (
                  <SelectionMenu
                    count={multiSelectIds.size}
                    canGroupCircle={multiSelectIds.size >= 2}
                    onClose={() => setShowSelectionMenu(false)}
                    onCopy={() => {
                      setShowSelectionMenu(false);
                      copySelection();
                    }}
                    onGroupCircle={() => {
                      setShowSelectionMenu(false);
                      groupSelectionIntoCircle();
                    }}
                    onDelete={() => {
                      setShowSelectionMenu(false);
                      deleteSelection();
                    }}
                  />
                )}
              </div>
            </div>
            <button className={btnSm} onClick={() => setMultiSelectIds(new Set())}>
              Deselect
            </button>
          </div>
        ) : (
          selectedNode &&
          user && (
            <>
              {/* No dimming backdrop behind this any more — it used to
                  double as "tap anywhere outside NodePanel closes it," but
                  the canvas's own onClick (see canvasRef below) already
                  deselects on a tap that reaches empty canvas directly, and
                  the backdrop's real cost outweighed that one extra bit of
                  outside-the-canvas coverage: it sat at z-30, between the
                  canvas content (z-31+) and the panel itself (z-40), which
                  made it the thing every quick-add ghost, node, and the
                  pending-create input had to specifically out-rank just to
                  stay tappable while a node was selected (see their own
                  z-index comments) — a whole layering workaround for a
                  backdrop that was mostly just visual dimming to begin with. */}
              <NodePanel
                node={selectedNode}
                nodes={nodes}
                edges={edges}
                currentUserId={user._id}
                onClose={() => setSelectedId(null)}
                onSelectNode={(id) => {
                  setSelectedId(id);
                  // Same "chosen node is always centered" rule handleNodeClick
                  // applies on the canvas — this is the panel's own path to
                  // choosing a different node (its "Points at" link).
                  centerOnNode(id);
                  // Panel's own "Points at" link is only ever shown on a
                  // weapon node's panel — same click-either-end replay the
                  // canvas gets, just reached from here instead.
                  if (selectedNode?.isWeapon) triggerWeaponShot(selectedNode.nodeId);
                }}
                onDeleted={applyNodeDeleted}
                onUpdated={upsertNode}
                onAttacked={(updatedNode, weaponNode, _weapon, healedParent) => {
                  upsertNode(updatedNode);
                  upsertNode(weaponNode);
                  // Set only on a landed retaliation — see attackAbl.ts's
                  // own healedParent doc comment.
                  if (healedParent) upsertNode(healedParent);
                  // Weapon nodes never got the "just created" flourish other
                  // nodes get — this is what NodeCard reads to fly the weapon
                  // in at the target instead of just popping into place.
                  setCelebrateIds((prev) => new Set(prev).add(weaponNode.nodeId));
                  if (mapId) refreshInsights(mapId);
                }}
                onDeleteEdge={(edgeId) => {
                  setEdges((prev) => prev.filter((e) => e.edgeId !== edgeId));
                  if (mapId) refreshInsights(mapId);
                }}
                onStartLink={() => startLinkFrom(selectedNode.nodeId)}
                onEdit={() => startInlineEdit(selectedNode)}
                onProtected={(protectionNode) => upsertNode(protectionNode)}
                onStartPack={() => startPackFrom(selectedNode.nodeId)}
                onUnpacked={(unpacked) => upsertNode(unpacked)}
              />
            </>
          )
        )}
      </div>

      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isOwner={isOwnNode(contextMenu.node)}
          canAttack={canAttackNode(contextMenu.node)}
          onClose={() => setContextMenu(null)}
          onCreate={() => {
            const anchor = contextMenu.node;
            setContextMenu(null);
            const ownGroups = new Set(
              nodeGroups
                .filter((g) => g.rootId === anchor.nodeId || g.members.some((m) => m.nodeId === anchor.nodeId))
                .map((g) => g.rootId),
            );
            const pos = avoidOverlap(
              posFor(anchor),
              [...nodeObstacles(Array.from(positions.values())), ...bigNodeObstacles(ownGroups)],
              viewportBounds(),
            );
            setInlineEditId(null);
            setPendingCreate({ x: pos.x, y: pos.y, type: "unknown", parentId: anchor.nodeId });
          }}
          onUpdate={() => startInlineEdit(contextMenu.node)}
          onDelete={() => {
            const node = contextMenu.node;
            setContextMenu(null);
            handleDeleteNode(node);
          }}
          onLink={() => {
            const anchor = contextMenu.node;
            setContextMenu(null);
            startLinkFrom(anchor.nodeId);
          }}
          onAttack={() => setContextMenu(null)}
        />
      )}

      {canvasContextMenu && (
        <CanvasContextMenu
          x={canvasContextMenu.screenX}
          y={canvasContextMenu.screenY}
          onClose={() => setCanvasContextMenu(null)}
          onPick={(type) => {
            const pos = avoidOverlap(
              { x: canvasContextMenu.canvasX, y: canvasContextMenu.canvasY },
              [...nodeObstacles(Array.from(positions.values())), ...bigNodeObstacles()],
              viewportBounds(),
            );
            setCanvasContextMenu(null);
            setInlineEditId(null);
            setPendingCreate({ x: pos.x, y: pos.y, type, parentId: null });
          }}
        />
      )}

      {/* whitespace-nowrap on every item: without it, a long label
          ("Problematic option", "negative circle / under fire") had
          nothing stopping it from wrapping *inside* its own flex item on a
          narrow screen — text breaking mid-phrase while the icon/dot sat
          oddly on its own line above it — instead of flex-wrap doing its
          actual job of moving the *whole* item down to the next row.
          Tighter gap/padding/font too, so more items fit per row before
          any wrapping is needed at all. */}
      <div className="flex flex-wrap gap-[0.3rem] border-t border-line bg-surface px-3 py-[0.45rem]">
        {NODE_TYPES.map((t) => (
          <span key={t} className="flex items-center gap-[0.25rem] whitespace-nowrap text-[0.68rem] text-ink-soft">
            <NodeTypeIcon type={t} size={13} />
            {t}
          </span>
        ))}
        <span className="flex items-center gap-[0.25rem] whitespace-nowrap text-[0.68rem] text-ink-soft">
          <span
            className="mr-[0.3rem] inline-block h-2 w-2 flex-shrink-0 rounded-full"
            style={{ background: "var(--success)" }}
          />
          positive circle
        </span>
        <span className="flex items-center gap-[0.25rem] whitespace-nowrap text-[0.68rem] text-ink-soft">
          <span
            className="mr-[0.3rem] inline-block h-2 w-2 flex-shrink-0 rounded-full"
            style={{ background: "var(--danger)" }}
          />
          negative circle / under fire
        </span>
      </div>

      {pendingLink && mapId && (
        <CreateEdgeModal
          mapId={mapId}
          nodes={pendingLink}
          onClose={() => setPendingLink(null)}
          onCreated={(created) => {
            created.forEach(upsertEdge);
            setPendingLink(null);
            refreshInsights(mapId);
          }}
        />
      )}

      {showInvite && map && (
        <InviteMemberModal map={map} onClose={() => setShowInvite(false)} onInvited={setMap} />
      )}

      {showNodeTypesLegend && (
        <Modal title="Node types" onClose={() => setShowNodeTypesLegend(false)}>
          <div className="flex flex-col gap-[0.6rem]">
            {NODE_TYPES.map((t) => (
              <div key={t} className="flex items-center gap-[0.6rem] text-[0.88rem] text-ink">
                <NodeTypeIcon type={t} size={20} />
                {t}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
