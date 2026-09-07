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
import { PendingNodeCard } from "../map/PendingNodeCard";
import { CreateEdgeModal } from "../map/CreateEdgeModal";
import { QuickAddGhosts } from "../map/QuickAddGhosts";
import { NodeContextMenu } from "../map/NodeContextMenu";
import { MiniMap } from "../map/MiniMap";
import { WeaponMark } from "../map/WeaponMark";
import { ringKindFor } from "../map/OutcomeBadge";
import { InviteMemberModal } from "../components/InviteMemberModal";
import { Modal } from "../components/Modal";
import { ColorPicker } from "../components/ColorPicker";
import { idOf, nodeRefId } from "../utils/nodeType";
import { NodeTypeIcon } from "../map/NodeTypeIcon";
import { NODE_TYPES } from "../types";
import type { AttackIndicator, EdgeDoc, MapDoc, NodeDoc, NodeType, SelectedCircle, Weapon } from "../types";

const CANVAS_W = 2400;
const CANVAS_H = 1600;

// Canvas zoom bounds/step — see the zoom state and zoomAt() below. 0.5x
// still leaves individual node captions legible; 2.5x is plenty for
// picking out detail in a crowded circle without the canvas's own
// 2400x1600 bound making a fully-zoomed-out view pointless.
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.35;

function hashOffset(seed: string, range: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 10007;
  return (h % (range * 2)) - range;
}

// Node icons are 92px wide (icon + caption) — keep freshly-placed nodes at
// least that far apart (plus a visible margin) so a new node never lands on
// top of an existing one. The margin shrinks on a phone-width viewport: the
// canvas is the same 2400x1600 regardless of screen size, so the same 50px
// buffer that's comfortable on desktop just means more panning/zooming to
// see fewer nodes at once on mobile — the 92px icon footprint itself is the
// one part of this that can't shrink without nodes actually overlapping.
// Read live (not memoized) since it only matters at the moment a node is
// placed/dragged, by which point the real viewport width is already known.
function getNodeMinDist() {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;
  return 92 + (isMobile ? 20 : 50);
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
  const [showColor, setShowColor] = useState(false);
  // The map's own toolbar (name, member count, Link/Add/Invite…) starts
  // collapsed — the canvas is the point, and this row was permanent
  // vertical real estate spent on it whether or not anyone needed it right
  // then. A small arrow tab (always visible, see the JSX below) toggles it
  // back open on demand.
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [celebrateIds, setCelebrateIds] = useState<Set<string>>(new Set());
  // Which weapon just had its arrows re-fired — set by clicking either end
  // of an attack (see handleNodeClick/triggerWeaponShot below), cleared
  // once the flight's had time to finish. `nonce` is what actually reaches
  // WeaponMark as replayNonce: a plain boolean/id wouldn't force a second
  // flight if you click the same weapon twice in a row, since nothing
  // about the value would have changed the second time.
  const [shotState, setShotState] = useState<{ id: string; nonce: number } | null>(null);
  const shotTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contextMenu, setContextMenu] = useState<{ node: NodeDoc; x: number; y: number } | null>(null);
  // Which node currently has its caption swapped for an inline text input —
  // see startInlineEdit. Null means no node is being edited.
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);

  const [cooldowns, setCooldowns] = useState<Partial<Record<Weapon, number>>>({});

  // Canvas zoom level — applied to canvasRef as a CSS transform: scale(),
  // see the JSX below. 1 = the canvas's own native 2400x1600 pixels.
  // Changed via zoomAt() (double-click, or the zoom control buttons) rather
  // than set directly, so every change stays clamped to [MIN_ZOOM, MAX_ZOOM]
  // in one place.
  const [zoom, setZoom] = useState(1);

  const [dragState, setDragState] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  // Live, while dragging: whichever node the pointer is currently hovering
  // close enough to read as "drop here to join its circle" — null once the
  // pointer isn't over anything droppable. Drives NodeCard's highlight ring.
  const [dropTarget, setDropTarget] = useState<{ nodeId: string; valid: boolean } | null>(null);
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

    socket.on("node:created", onNodeCreated);
    socket.on("node:updated", onNodeUpdated);
    socket.on("node:deleted", onNodeDeleted);
    socket.on("node:attacked", onNodeAttacked);
    socket.on("edge:created", onEdgeCreated);
    socket.on("edge:deleted", onEdgeDeleted);
    socket.on("circle:selected", onCircleSelected);
    socket.on("circle:deselected", onCircleDeselected);

    return () => {
      socket.off("node:created", onNodeCreated);
      socket.off("node:updated", onNodeUpdated);
      socket.off("node:deleted", onNodeDeleted);
      socket.off("node:attacked", onNodeAttacked);
      socket.off("edge:created", onEdgeCreated);
      socket.off("edge:deleted", onEdgeDeleted);
      socket.off("circle:selected", onCircleSelected);
      socket.off("circle:deselected", onCircleDeselected);
      leaveMap(mapId);
    };
  }, [mapId, loading, upsertNode, upsertEdge, applyCircleSelection]);

  const selectedNode = nodes.find((n) => n.nodeId === selectedId) ?? null;
  // Same condition that gates the quick-add ghost ring below — reused here
  // so every other node dims while it's showing, putting the focus on the
  // selected node and its type-to-create options instead of competing with
  // the rest of the canvas.
  const quickAddActive = !!(selectedNode && isOwnNode(selectedNode) && !linkMode && !dragState);
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
    const regular = nodes.filter((n) => !n.isWeapon);
    const weapons = nodes.filter((n) => n.isWeapon);
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
      const attackerId = idOf(n.userId as any);
      let base = targetPos;
      let closestDist = Infinity;
      for (const own of regular) {
        if (own.nodeId === n.nodeId || idOf(own.userId as any) !== attackerId) continue;
        const p = map.get(own.nodeId);
        if (!p) continue;
        const d = Math.hypot(p.x - targetPos.x, p.y - targetPos.y);
        if (d < closestDist) {
          closestDist = d;
          base = p;
        }
      }
      // A fixed radius (not independent x/y jitter) so the gap between this
      // weapon node and its anchor stays consistent — close enough to read
      // as "this weapon node belongs over here", wide enough that its own
      // caption doesn't run into its anchor's. Angle still comes from the
      // hash, so multiple attacks anchored at the same node fan out around
      // it instead of stacking.
      const angle = hashOffset(n.nodeId, 180) * (Math.PI / 180);
      const radius = getNodeMinDist();
      const desired = { x: base.x + radius * Math.cos(angle), y: base.y + radius * Math.sin(angle) };
      // Fanning by angle alone doesn't guarantee two attacks (or an attack
      // and some unrelated node) don't land on each other — nudge clear of
      // anything already placed, same spacing rule every other node uses.
      // Big-group backdrops aren't checked here: nodeGroups itself is
      // derived from these positions, so consulting it back inside this
      // same memo would be circular. Weapon nodes fan out from an explicit
      // anchor and land far enough out (getNodeMinDist() radius) that this
      // is a rare miss in practice, not a gap worth breaking the memo for.
      map.set(n.nodeId, avoidOverlap(desired, nodeObstacles(Array.from(map.values()))));
    });
    return map;
  }, [nodes]);

  function posFor(node: NodeDoc) {
    if (dragState && dragState.nodeId === node.nodeId) return { x: dragState.x, y: dragState.y };
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
    return {
      minX: wrap.scrollLeft / zoom + pad,
      minY: wrap.scrollTop / zoom + pad,
      maxX: (wrap.scrollLeft + wrap.clientWidth) / zoom - pad,
      maxY: (wrap.scrollTop + wrap.clientHeight) / zoom - pad,
    };
  }

  // Pans the canvas so the given node's position lands in the middle of the
  // current viewport, unconditionally — the chosen node (whatever was just
  // clicked/selected) always ends up centered, not just nudged into view.
  // Selecting a node always brings up NodePanel too, and that panel is now a
  // bottom sheet *overlaying* the canvas at every screen size (see its own
  // PANEL_CLASS) rather than a sidebar the canvas shrinks to make room for —
  // so wrap.clientHeight's own full height is no longer what's actually
  // visible above it. PANEL_RESERVE_FRAC below is a deliberate approximation
  // (there's no reliable, synchronously-correct measurement of the panel's
  // real height here — it hasn't mounted yet for a first selection, and its
  // content, and so its height, varies by node and tab anyway), landing the
  // node roughly centered in the space actually left on screen instead of
  // precisely centered in the space technically covered by it.
  function centerOnNode(nodeId: string) {
    const wrap = wrapRef.current;
    const node = nodes.find((n) => n.nodeId === nodeId);
    if (!wrap || !node) return;
    const pos = posFor(node);
    const PANEL_RESERVE_FRAC = 0.4;
    const visibleH = Math.max(150, wrap.clientHeight * (1 - PANEL_RESERVE_FRAC));
    // *zoom throughout: pos.x/y are canvas-space, but scrollTo/scrollWidth
    // deal in screen pixels of the rendered (scaled) canvas — same
    // conversion as screenToCanvas/zoomAt above, just the other direction.
    const maxLeft = Math.max(0, CANVAS_W * zoom - wrap.clientWidth);
    const maxTop = Math.max(0, CANVAS_H * zoom - wrap.clientHeight);
    wrap.scrollTo({
      left: Math.min(maxLeft, Math.max(0, pos.x * zoom - wrap.clientWidth / 2)),
      top: Math.min(maxTop, Math.max(0, pos.y * zoom - visibleH / 2)),
      behavior: "smooth",
    });
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

  // Any node with 2+ direct parentId-children reads as a group ("circle") —
  // general on purpose, same as linkCycles below: this fires whether the
  // star came from dragging one node onto another or just from branching
  // off the same node several times over. Majority of the group's own node
  // *types* decides halo vs horns; a tie, or a group made entirely of
  // "unknown" nodes (the only type with no ring, so no vote — see
  // sentimentOf), draws nothing — there's no majority to color it by.
  const nodeGroups = useMemo(() => {
    const childrenByParent = new Map<string, NodeDoc[]>();
    for (const n of nodes) {
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
  }, [nodes, positions]);

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
    if (linkMode) return;
    if (!isOwnNode(node)) return;
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

  // Mirrors attackAbl.ts's own-node rule exactly (normal: someone else's
  // node only; Map.discussionMode: your own node only), plus the defeated
  // exclusion, which never depends on mode. A weapon node is otherwise
  // excluded here — landing an attack on an attack still isn't a thing
  // this game models in general — except retaliation: the one node it
  // actually hit striking back at it, mirroring attackAbl.ts's own
  // CannotRetaliateError check (own the node this weapon's targetNodeId
  // resolves to). That bypasses the own-node/discussion-mode rule below
  // entirely, same as server-side. Client-side only, same caveat as
  // isOwnNode elsewhere — the server enforces the real rule.
  function canAttackNode(node: NodeDoc) {
    if (node.defeated) return false;
    if (node.isWeapon) {
      const targetId = nodeRefId(node.targetNodeId);
      const target = targetId ? nodes.find((n) => n.nodeId === targetId) : undefined;
      return !!target && isOwnNode(target);
    }
    return map?.discussionMode ? isOwnNode(node) : !isOwnNode(node);
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

  function handleNodeClick(node: NodeDoc) {
    setContextMenu(null);
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

  // Double-click (or double-tap) anywhere on the canvas — empty space or
  // right on a node, doesn't matter which — zooms in one step centered on
  // wherever was clicked, via zoomAt. This used to open inline editing/node
  // creation instead; that's deliberately gone now (see startInlineEdit's
  // own comment) so a stray double-tap on a phone can't silently edit or
  // create a node any more, and the gesture is free for the much more
  // reversible "zoom in for a closer look."
  function onCanvasDoubleClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (linkMode) return;
    zoomAt(e.clientX, e.clientY, ZOOM_STEP);
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

  // Right-click on empty canvas is "close whatever's open": suppresses the
  // browser's native context menu and dismisses the classical side panel
  // (which also tears down its quick-add ghost ring, since that's derived
  // from selectedId) plus any node context menu — a quick way out that
  // doesn't need the panel's ✕ or a click on empty canvas. Right-click *on*
  // a node instead opens that node's own menu — see handleNodeContextMenu,
  // which stops the event before it ever reaches this handler.
  function onCanvasContextMenu(e: ReactMouseEvent<HTMLDivElement>) {
    e.preventDefault();
    setSelectedId(null);
    setContextMenu(null);
  }

  // Right-click on a node: CUD + Link always for your own nodes (a weapon
  // node included — it's usual for this purpose now, same as everywhere
  // else isOwnNode gates), plus Attack when canAttackNode agrees (normal
  // mode: someone else's node; discussion mode: your own; a weapon node
  // only via retaliation, when it's the one that hit a node you own — see
  // canAttackNode). Nothing opens for a node that's neither yours to edit
  // nor yours to attack right now (an already-defeated node you don't own;
  // anyone else's node at all while in discussion mode; someone else's
  // weapon node that didn't target you), since there'd be no action left
  // to show.
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

  // Owner-only toggle (updateMap itself already restricts the PATCH to the
  // owner server-side, same as name/color) — flips Map.discussionMode,
  // which NodeCard/NodePanel/NodeContextMenu below all read straight off
  // `map` to decide health visibility and who an attack can land on.
  async function toggleDiscussionMode() {
    if (!mapId || !map) return;
    setActionError(null);
    try {
      const updated = await mapsApi.updateMap(mapId, { discussionMode: !map.discussionMode });
      setMap(updated);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : "Failed to update discussion mode");
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
  const chip =
    "inline-flex items-center gap-1 rounded-[20px] border border-line bg-surface-2 px-[0.55rem] py-[0.2rem] text-[0.72rem] text-ink-soft";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {toolbarOpen && (
        <div className="flex flex-wrap items-center gap-[0.6rem] border-b border-line bg-surface px-4 py-[0.7rem]">
          <Link to="/" className={btnSmGhost}>
            &larr;
          </Link>
          <h2 className="mr-2 text-[1.05rem] font-bold">{map.name}</h2>
          <span className={chip}>{Array.isArray(map.members) ? map.members.length : 0} member(s)</span>
          {map.discussionMode && (
            <span
              className="inline-flex items-center gap-1 rounded-[20px] border border-transparent bg-accent-soft px-[0.55rem] py-[0.2rem] text-[0.72rem] text-accent-ink"
              title="Attacks only land on your own nodes here; health stays hidden until hover"
            >
              Discussion mode
            </span>
          )}
          <div className="flex-1" />
          {/* Just the on/off switch now — the pick count, confirm button,
              and any pick error all moved to LinkPickerPanel (see its own
              doc comment), which shows regardless of whether this toolbar
              is even open, so starting a link from a node's own "Link from
              this node" button doesn't require hunting this down to
              finish it. */}
          <button
            className={linkMode ? btnSmPrimary : btnSm}
            onClick={() => {
              if (linkMode) {
                exitLinkMode();
              } else {
                setLinkMode(true);
                setLinkSelection([]);
                setLinkError(null);
              }
            }}
          >
            {linkMode ? "Cancel linking" : "Link nodes"}
          </button>
          <button
            className={btnSmPrimary}
            onClick={() => {
              const pos = pickNonOverlappingPosition(Array.from(positions.values()), bigNodeObstacles(), viewportBounds());
              setInlineEditId(null);
              setPendingCreate({ x: pos.x, y: pos.y, type: "unknown", parentId: null });
            }}
          >
            + Add node
          </button>
          <button className={btnSm} onClick={() => setShowColor(true)}>
            My color
          </button>
          {isOwner && (
            <button
              className={map.discussionMode ? btnSmPrimary : btnSm}
              onClick={toggleDiscussionMode}
              title="Attacks only land on your own nodes; health stays hidden until hover"
            >
              Discussion mode: {map.discussionMode ? "On" : "Off"}
            </button>
          )}
          {isOwner && (
            <button className={btnSm} onClick={() => setShowInvite(true)}>
              Invite
            </button>
          )}
        </div>
      )}

      {/* Always-visible handle for the toolbar above — a small arrow tab
          rather than the toolbar's own real estate, so collapsing it back
          down doesn't also hide the one control that reopens it. Sized a
          bit past the old h-4/w-12 (16x48px, uncomfortably thin to actually
          land a tap on) — still a small tab, just one that's easier to hit
          without being clumsy about the space it costs. */}
      <div className="flex justify-center border-b border-line bg-surface">
        <button
          className="flex h-6 w-16 cursor-pointer items-center justify-center rounded-b-lg border border-t-0 border-line bg-surface text-[0.7rem] leading-none text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
          onClick={() => setToolbarOpen((v) => !v)}
          title={toolbarOpen ? "Hide toolbar" : "Show toolbar"}
        >
          {toolbarOpen ? "▲" : "▼"}
        </button>
      </div>

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
            className={`relative${linkMode ? " cursor-crosshair" : ""}`}
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
              if (linkMode) return;
              setSelectedId(null);
              releaseChosenCircleIfOutside();
            }}
            onDoubleClick={onCanvasDoubleClick}
            onContextMenu={onCanvasContextMenu}
          >
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
                const color = g.sentiment === "positive" ? "#ffd54f" : "#ff3d00";
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
                    fillOpacity={dimmed ? 0.03 : 0.08}
                    stroke={color}
                    strokeOpacity={dimmed ? 0.15 : 0.3}
                    strokeWidth={2}
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
              {nodes.map((node) => {
                const parentId = nodeRefId(node.parentId);
                if (!parentId) return null;
                const parentNode = nodes.find((n) => n.nodeId === parentId);
                if (!parentNode) return null;
                const a = posFor(parentNode);
                const b = posFor(node);
                const group = nodeGroups.find((g) => g.rootId === parentId);
                const color = group ? (group.sentiment === "positive" ? "#ffd54f" : "#ff3d00") : "var(--accent)";
                // Same "chosen one stays full-opacity, every other circle
                // dims" spotlight the old backdrop drew — see its own
                // removed comment for why. Ungrouped branches never dim;
                // they were never part of the spotlight to begin with.
                const isStabilized = !!group && map?.selectedCircle?.rootId === group.rootId;
                const dimmed = !!group && !!map?.selectedCircle && !isStabilized;
                return (
                  <line
                    key={`branch-${node.nodeId}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={color}
                    strokeOpacity={group ? (dimmed ? 0.25 : 0.85) : 0.45}
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
                return <line key={edge.edgeId} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={2} />;
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

            {nodes.map((node) => {
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
                  dragging={dragState?.nodeId === node.nodeId}
                  canDrag={isOwnNode(node)}
                  groupSentiment={groupSentimentByNode.get(node.nodeId)}
                  indicator={indicatorByNode.get(node.nodeId)}
                  linkModeActive={linkMode}
                  discussionMode={!!map.discussionMode}
                  celebrate={celebrateIds.has(node.nodeId)}
                  flightVector={flightVector}
                  muted={
                    ((quickAddActive && node.nodeId !== selectedId) ||
                      (!!spotlightedNodeIds && !spotlightedNodeIds.includes(node.nodeId))) &&
                    !unmutedAttackNodeIds?.has(node.nodeId)
                  }
                  dropHighlight={dropTarget?.nodeId === node.nodeId ? (dropTarget.valid ? "valid" : "invalid") : undefined}
                  inlineEditing={editingThis}
                  onInlineConfirm={(text, type) => confirmInlineEdit(node, text, type)}
                  onInlineCancel={() => setInlineEditId(null)}
                  onPointerDown={editingThis ? undefined : (e) => onNodePointerDown(node, e)}
                  onClick={() => {
                    if (suppressNextClick.current) {
                      suppressNextClick.current = false;
                      return;
                    }
                    handleNodeClick(node);
                  }}
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
              {nodes
                .filter((n) => n.isWeapon)
                .map((weaponNode) => {
                  const targetId = nodeRefId(weaponNode.targetNodeId);
                  if (!targetId) return null;
                  const targetNode = nodes.find((n) => n.nodeId === targetId);
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
          </div>
          </div>
          <MiniMap
            wrapRef={wrapRef}
            nodes={nodes}
            positions={positions}
            groups={nodeGroups}
            canvasW={CANVAS_W}
            canvasH={CANVAS_H}
            zoom={zoom}
          />

          {/* Zoom controls — stacked directly above the minimap in the same
              bottom-right corner (used to sit bottom-left; moved to keep
              both of the canvas's floating controls in one place instead
              of split across the screen). bottom-[150px]: minimap's own
              bottom-3 (12px) plus its ~122px rendered height (120px
              MINIMAP_H + its 1px border each side) plus a small gap, so
              this sits just above it rather than touching. Same z-[45]
              reasoning as the minimap: above the canvas/panel, below a
              real modal. Double-clicking the canvas (see
              onCanvasDoubleClick) zooms in one step too, but that's
              zoom-in-only and needs a pointer position to zoom toward;
              these buttons are the only way to zoom back out or reset,
              and work the same without a mouse (a tap is plenty). */}
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
        {linkMode ? (
          <LinkPickerPanel
            picks={linkPicks}
            error={linkError}
            onRemove={(id) => setLinkSelection((prev) => prev.filter((x) => x !== id))}
            onConfirm={confirmLinkSelection}
            onCancel={exitLinkMode}
          />
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
                discussionMode={!!map.discussionMode}
                cooldowns={cooldowns}
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
                onCooldown={(weapon, readyAt) => setCooldowns((prev) => ({ ...prev, [weapon]: readyAt }))}
                onDeleteEdge={(edgeId) => {
                  setEdges((prev) => prev.filter((e) => e.edgeId !== edgeId));
                  if (mapId) refreshInsights(mapId);
                }}
                onStartLink={() => startLinkFrom(selectedNode.nodeId)}
                onEdit={() => startInlineEdit(selectedNode)}
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

      {showColor && map && (
        <SetColorModal
          map={map}
          onClose={() => setShowColor(false)}
          onSaved={(updated) => {
            setMap(updated);
            setShowColor(false);
          }}
        />
      )}
    </div>
  );
}

function SetColorModal({
  map,
  onClose,
  onSaved,
}: {
  map: MapDoc;
  onClose: () => void;
  onSaved: (map: MapDoc) => void;
}) {
  const { user } = useAuth();
  const existing = map.memberColors.find((mc) => mc.userId === user?._id)?.color ?? "#22c55e";
  const [color, setColor] = useState(existing);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const updated = await mapsApi.setMyColor(map.mapId, color);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to set color");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="My color on this map" onClose={onClose}>
      {error && (
        <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">{error}</div>
      )}
      <ColorPicker value={color} onChange={setColor} />
      <div className="mt-[1.2rem] flex justify-end gap-[0.6rem]">
        <button
          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-line bg-surface px-4 py-[0.55rem] text-[0.88rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-accent bg-accent px-4 py-[0.55rem] text-[0.88rem] font-semibold text-white transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={save}
          disabled={busy}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}
