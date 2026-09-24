import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import * as mapsApi from "../api/maps";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import * as linesApi from "../api/lines";
import { ApiRequestError } from "../api/client";
import { useMapSocket } from "../hooks/useMapSocket";
import { useCanvasViewport } from "../hooks/useCanvasViewport";
import { useCanvasMode } from "../hooks/useCanvasMode";
import { useWeaponReplay } from "../hooks/useWeaponReplay";
import { useNotice } from "../hooks/useNotice";
import { stepPrefix, stepRank } from "../utils/textExport";
import { buildNodeClipboard, nodeClipboardSize, readNodeClipboard, writeNodeClipboard } from "../utils/nodeClipboard";
import { computeBasePositions, computeRadialPositions, RADIAL_MAX_NEIGHBORS } from "../utils/nodePositions";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { NodeCard } from "../map/NodeCard";
import { NodePanel } from "../map/NodePanel";
import { PackPickerPanel } from "../map/PackPickerPanel";
import { PendingNodeCard } from "../map/PendingNodeCard";
import { CreateEdgeModal } from "../map/CreateEdgeModal";
import { QuickAddGhosts } from "../map/QuickAddGhosts";
import { NodeContextMenu } from "../map/NodeContextMenu";
import { CanvasContextMenu } from "../map/CanvasContextMenu";
import { MiniMap } from "../map/MiniMap";
import { CanvasBackdrop } from "../map/CanvasBackdrop";
import { DrawLineBar } from "../map/DrawLineBar";
import { isPointFree, isSegmentFree, snapToLines } from "../utils/drawLine";
import { loadNodeDisplay, saveNodeDisplay, nodeFootprint, zoomToSeparate } from "../utils/nodeDisplay";
import type { NodeDisplay } from "../utils/nodeDisplay";
import { WeaponLayer } from "../map/WeaponLayer";
import { MapToolbar } from "../map/MapToolbar";
import { ZoomControls } from "../map/ZoomControls";
import { SelectionBar } from "../map/SelectionBar";
import { MapLegend } from "../map/MapLegend";
import { InviteMemberModal } from "../components/InviteMemberModal";
import { ExportTextModal } from "../components/ExportTextModal";
import { idOf, nodeRefId } from "../utils/nodeType";
import { layoutTemplate } from "../utils/templates";
import type { TemplateKind, TemplateNodeKey } from "../utils/templates";
import type { Sentiment } from "../utils/nodeType";
import {
  CANVAS_W,
  CANVAS_H,
  ZOOM_STEP,
  MAX_ZOOM,
  CIRCLE_DROP_RADIUS,
  computeLinkedNeighborIds,
  getNodeMinDist,
  pickNonOverlappingPosition,
  nodeObstacles,
  avoidOverlap,
  footprintObstacles,
  zoneAngleGuard,
  leavingPinchesZone,
  isDescendant,
  computeNodeGroups,
  computeLinkCycles,
} from "../utils/canvasLayout";
import type { Obstacle } from "../utils/canvasLayout";
import { loadReadingMode, saveReadingMode } from "../utils/readingMode";
import type { ReadingMode } from "../utils/readingMode";
import type { AttackIndicator, EdgeDoc, LineDoc, MapDoc, NodeDoc, NodeType, SelectedCircle } from "../types";

// A Problem-type node's own child counts as "addressing" it (see
// unsolvedProblemIds below) only if it's one of these — a plain Problem or
// Fail child piled on top doesn't count as a proposal.
const ADDRESSES_PROBLEM_TYPES = new Set<NodeType>(["Success", "Option", "Solution"]);

// Stand-in id for a node that doesn't exist yet, when checking where it may go
// (see zoneAngleGuard).
const NEW_NODE_ID = "__new__";

// Stable empty fallbacks for reading a canvas-mode field that only exists in
// one of the mode's variants (see useCanvasMode) — a plain literal instead
// would still work, just as a fresh, unnecessary object every render. Never
// mutated — every write goes through dispatchMode, which replaces the whole
// field rather than touching one of these in place.
const EMPTY_STRING_SET: Set<string> = new Set();
const EMPTY_POINTS: { x: number; y: number }[] = [];

export function MapPage() {
  const { mapId } = useParams<{ mapId: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useI18n();

  const [map, setMap] = useState<MapDoc | null>(null);
  const [nodes, setNodes] = useState<NodeDoc[]>([]);
  const [edges, setEdges] = useState<EdgeDoc[]>([]);
  // Separator lines drawn on the map — see utils/drawLine.ts and the backend's
  // Line model.
  const [lines, setLines] = useState<LineDoc[]>([]);
  // The canvas's own interaction mode — at most one of choosing nodes,
  // packing nodes into a container, or drawing a separator line, each with
  // its own data (see useCanvasMode's own doc comment for why this is one
  // reducer rather than nine separate booleans/values). `chooseMode`/
  // `packMode`/`drawMode` and each mode's own fields below are derived from
  // it fresh every render — plain reads, not additional state — so the rest
  // of this file reads exactly as it did with separate flags.
  const [mode, dispatchMode] = useCanvasMode();
  const chooseMode = mode.kind === "choose";
  const packMode = mode.kind === "pack";
  const packContainerId = mode.kind === "pack" ? mode.containerId : null;
  const packSelection = mode.kind === "pack" ? mode.picks : EMPTY_STRING_SET;
  const packError = mode.kind === "pack" ? mode.error : null;
  const drawMode = mode.kind === "draw";
  const drawPoints = mode.kind === "draw" ? mode.points : EMPTY_POINTS;
  const drawHover = mode.kind === "draw" ? mode.hover : null;
  const drawBlocked = mode.kind === "draw" ? mode.blocked : null;
  const drawSaving = mode.kind === "draw" ? mode.saving : false;
  const drawBlockedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawHoverFrameRef = useRef<number | null>(null);
  const [indicators, setIndicators] = useState<AttackIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Off by default: a bare tap/click on a node only ever selects it while
  // this is false — onNodePointerDown's own single-node drag setup is
  // gated behind it (see its own comment). Arming a drag straight from the
  // first pointerdown on any node would read lightly grazing one while just
  // trying to tap it (a phone's own touch imprecision, mainly) as "drag this
  // node," relocating or even re-parenting it by accident. Turning it on is
  // a deliberate, explicit act (the
  // toolbar's own Move toggle) instead of the app's default stance.
  // Doesn't touch double-click-to-edit (startInlineEdit) or an
  // already-multi-selected group's own drag — both stay available
  // regardless, since neither one is the "accidental" case this addresses.
  const [moveMode, setMoveMode] = useState(false);
  // How this viewer reads the map (see utils/readingMode.ts) — remembered per
  // browser, never shared with the map's other members.
  const [readingMode, setReadingModeState] = useState<ReadingMode>(loadReadingMode);
  function setReadingMode(mode: ReadingMode) {
    setReadingModeState(mode);
    saveReadingMode(mode);
    if (mode !== "actual") fitZoomForDisplay(nodeDisplay, mode);
  }
  // Nodes shown in their own reading mode instead of the map's (a chosen group
  // as a classical mind map, say) — per browser and per map, see
  // utils/nodeDisplay.ts.
  const [nodeDisplay, setNodeDisplay] = useState<NodeDisplay>(() => loadNodeDisplay(mapId));
  // Choose mode: a tap on one of your own nodes adds it to / drops it from the
  // group selection (multiSelectIds — the same one shift+click and the marquee
  // build), instead of opening that node's panel. The group bar then offers
  // what to do with the chosen nodes: link, copy or delete them. (See `mode`
  // above for chooseMode/packMode/packContainerId/packSelection/packError
  // themselves — declared once, together, up there.)
  //
  // The chosen nodes, in the order they were chosen, waiting on the sentiment
  // modal to finish linking them — 2 nodes finish as a single edge (a line);
  // 3+ finish as a closed loop (every consecutive pair plus one closing the
  // last node back to the first), which is what the cycle detector below then
  // colors as a figure.
  const [pendingLink, setPendingLink] = useState<NodeDoc[] | null>(null);
  // Same reasoning, generalized: every other per-action failure (a failed
  // update/delete/create/circle-join) routes here rather than through
  // setError, which drives the full-page failure view — a rejected
  // drag-to-join-circle shouldn't nuke the whole canvas behind a "map not
  // found"-style screen. This is a dismissible banner over the still-live
  // canvas instead.
  const [actionError, setActionError] = useState<string | null>(null);
  // The circle whose zone was just clicked, while it is still being chosen and
  // its members' titles/text are still on their way (two round trips: the
  // choice itself, then the text). Shows a spinner on the zone so the click
  // visibly registered instead of the canvas looking frozen.
  const [circleLoadingRootId, setCircleLoadingRootId] = useState<string | null>(null);
  const { notice, showNotice, dismissNotice } = useNotice();

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
  // discussion-mode…) is gone — replaced by a small floating "+" menu (see
  // MapToolbar).
  // Collapses Back/+/Move down to a single "⋮" button (Discussion/Personal
  // mode stays separately visible either way — see its own comment further
  // down) while the quick-add ghost ring is up (see quickAddActive below) —
  // that cluster floats at z-[45], above the ghosts' own z-[33], so a ghost
  // that happens to land near the top-left corner could render right
  // underneath it; shrinking most of the cluster to one small button all
  // but eliminates that, and frees up the corner for a bigger ring besides.
  // Manually reset to true (re-showing the full toolbar without waiting for
  // quick-add to end) and reset back to false the next time quick-add
  // activates fresh — see the effect below.
  const [forceShowToolbar, setForceShowToolbar] = useState(false);
  const [showExportText, setShowExportText] = useState(false);
  // Set to a circle-parent's own rootId while its cluster-scoped "Extract
  // text" modal (extractClusterText/collectClusterSubtree) is open — null
  // otherwise. A separate flag from showExportText since the two scopes
  // (whole map vs. one cluster) never overlap and need different node
  // lists/titles passed into the same ExportTextModal.
  const [extractClusterRootId, setExtractClusterRootId] = useState<string | null>(null);
  const [celebrateIds, setCelebrateIds] = useState<Set<string>>(new Set());
  const { shotState, triggerWeaponShot } = useWeaponReplay();
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
  // (free to claim — panning is native scroll/trackpad, not a click-drag)
  // sweeps this rectangle (canvas coordinates) and, on release,
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

  // Where every node sits, the node the panel is showing, and the scrolling/
  // zooming viewport onto the canvas — all derived before anything below
  // reads them.
  const positions = useMemo(() => computeBasePositions(nodes), [nodes]);
  const selectedNode = nodes.find((n) => n.nodeId === selectedId) ?? null;
  // NodePanel/PackPickerPanel's bottom sheet physically covers the bottom
  // third (half on mobile) of the screen while it's open. Skipped for the
  // group-selection footer (multiSelectIds), which is a slim bar, not a tall
  // sheet.
  const sheetOpen = chooseMode || packMode || (!!selectedNode && multiSelectIds.size === 0);
  const {
    canvasRef,
    wrapRef,
    zoom,
    hScrollMargin,
    vScrollMargin,
    selectionSettled,
    screenToCanvas,
    zoomAt,
    zoomFromCenter,
    viewportBounds,
    settledViewportBounds,
    centerOnNode,
    centerOnPoint,
  } = useCanvasViewport({ mapId, loading, sheetOpen, positions });

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

  const upsertLine = useCallback(
    (incoming: LineDoc) =>
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.lineId === incoming.lineId);
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
      const [mapDoc, nodeList, edgeList, lineList] = await Promise.all([
        mapsApi.getMap(mapId),
        nodesApi.listNodes(mapId),
        edgesApi.listEdges(mapId),
        // Lines are decoration — a backend without them yet mustn't stop the map loading.
        linesApi.listLines(mapId).catch(() => [] as LineDoc[]),
      ]);
      setMap(mapDoc);
      // Backend's listNodes deliberately omits each node's own `text` (see
      // getNodesByMapDao) — comes back `undefined` over the wire despite
      // NodeDoc's own `text: string`. Normalized to "" right here, once, so
      // every other read of node.text in this file can keep trusting that
      // type instead of null-checking it everywhere; "" doubles as the
      // "text not loaded yet" sentinel ensureNodeText below checks for,
      // which is safe precisely because a real node's text is never
      // actually empty (backend validation requires non-blank text).
      // This list replaces every node with a text-less copy, so anything
      // ensureNodeText already fetched is gone from state too — forget that
      // it was fetched, or the ids stay marked "have" while their text is
      // blank (two overlapping loads, as React StrictMode makes in dev, or a
      // reload after a socket reconnect, otherwise wiped captions for good).
      fetchedTextIds.current.clear();
      setNodes(nodeList.map((n) => ({ ...n, text: n.text ?? "" })));
      setEdges(edgeList);
      setLines(lineList);
      refreshInsights(mapId);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t.ui.errors.loadMap);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  // Backfills real text for whichever node ids actually need it right now
  // (see the loadAll comment above for why most nodes start out with ""
  // instead of their real text) and returns every requested id's now-known
  // text — a caller that just wants the UI to pick it up eventually (a
  // caption, a panel) can fire this and ignore the return value, since the
  // setNodes call below re-renders them anyway; a caller that has to build
  // something from the text *synchronously right after awaiting* (copying,
  // exporting) can't just re-read `nodes` afterward — this same function
  // call's own closure over `nodes` is whatever it was at render time, not
  // whatever setNodes below just applied — so it has to consume the
  // returned map instead. fetchedTextIds remembers every id this has
  // already resolved at least once, so a node that's genuinely empty text
  // (shouldn't happen — backend validation requires non-blank text, but
  // this is the one thing standing between that assumption breaking and an
  // infinite refetch loop) is never retried forever.
  const fetchedTextIds = useRef<Set<string>>(new Set());
  async function ensureNodeText(ids: string[]): Promise<Record<string, string>> {
    const have: Record<string, string> = {};
    const missing: string[] = [];
    for (const id of new Set(ids)) {
      const n = nodes.find((nn) => nn.nodeId === id);
      if (n && (n.text !== "" || fetchedTextIds.current.has(id))) have[id] = n.text;
      else missing.push(id);
    }
    if (missing.length === 0 || !mapId) return have;
    try {
      const fetched = await mapsApi.getNodesText(mapId, missing);
      missing.forEach((id) => {
        fetchedTextIds.current.add(id);
        have[id] = fetched[id] ?? "";
      });
      setNodes((prev) => prev.map((n) => (n.nodeId in fetched ? { ...n, text: fetched[n.nodeId] } : n)));
    } catch {
      // Best-effort — leave these ids out of fetchedTextIds so whatever
      // triggers ensureNodeText next (a re-render, a retry) gets another
      // shot instead of a permanently blank caption/panel; `have` simply
      // won't carry an entry for them, same as any other id it can't
      // resolve.
    }
    return have;
  }

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

  useMapSocket({
    mapId,
    loading,
    setNodes,
    setEdges,
    setLines,
    setMap,
    setSelectedId,
    setCelebrateIds,
    upsertNode,
    upsertEdge,
    upsertLine,
    applyCircleSelection,
    refreshInsights,
  });

  // Any node "chosen" on the map right now — a multi-select takes priority
  // (it's the more specific state), falling back to the plain single
  // selection. Null when nothing at all is chosen, the one case edges/
  // branch-arrows stay fully lit. Feeds the same dimming both the branch
  // arrows and plain Edges apply below, for a single selection too, not
  // just a multi-select — a lone selected node is already the map's "I'm
  // focused on this one" state everywhere else (NodeCard's own outline/
  // health/wings), so its edges should read that way too.
  const chosenNodeIds = multiSelectIds.size > 0 ? multiSelectIds : selectedId ? new Set([selectedId]) : null;
  // Same condition that gates the quick-add ghost ring below — reused here
  // so every other node dims while it's showing, putting the focus on the
  // selected node and its type-to-create options instead of competing with
  // the rest of the canvas. selectionSettled: the ghosts (and the dimming
  // that comes with them) wait until centerOnNode's own pan has landed —
  // see its own doc comment.
  const quickAddActive =
    !!(selectedNode && isOwnNode(selectedNode) && !chooseMode && !packMode && !dragState) && selectionSettled;

  // See forceShowToolbar's own doc comment — every fresh quick-add starts
  // collapsed again, regardless of whether a previous one was manually
  // expanded.
  useEffect(() => {
    if (!quickAddActive) setForceShowToolbar(false);
  }, [quickAddActive]);
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
  const radialPositions = useMemo(() => {
    if (multiSelectIds.size > 1 || !selectedId || !selectionSettled) return null;
    // Both rings are centered on the selected node, and the neighbor ring
    // gets squeezed by the viewport (a phone's narrow width, the bottom panel's
    // reserved height) until it lands on the ghost ring — a neighbor's icon or
    // caption ends up right under a ghost. While ghosts are on offer for an
    // own node they win: neighbors stay put at their stored positions, dimmed,
    // rather than jumping into a ring that crowds them. Not keyed off dragState
    // (unlike quickAddActive) so grabbing a node doesn't snap its neighbors
    // into a ring mid-gesture.
    if (selectedNode && isOwnNode(selectedNode) && !chooseMode && !packMode) return null;
    const center = positions.get(selectedId);
    const selected = nodes.find((n) => n.nodeId === selectedId);
    if (!center || !selected) return null;

    const neighborIds = computeLinkedNeighborIds(selectedId, nodes, edges);
    if (neighborIds.size === 0) return null;

    const neighbors = Array.from(neighborIds).slice(0, RADIAL_MAX_NEIGHBORS);
    return computeRadialPositions(center, neighbors, settledViewportBounds());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, multiSelectIds, nodes, edges, positions, selectionSettled, chooseMode, packMode]);

  function posFor(node: NodeDoc) {
    const grouped = groupDragState?.get(node.nodeId);
    if (grouped) return grouped;
    if (dragState && dragState.nodeId === node.nodeId) return { x: dragState.x, y: dragState.y };
    const radial = radialPositions?.get(node.nodeId);
    if (radial) return radial;
    return positions.get(node.nodeId) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 };
  }

  // The points a new or moved node has to stay clear of: every *visible*
  // node's position, minus `exclude` (the thing being placed). Only visible
  // ones — a node packed out of sight still has an entry in `positions`;
  // counting it here would push new placements away from a spot that looks
  // empty to the user.
  function obstaclePoints(exclude?: Set<string>) {
    return visibleNodes
      .filter((n) => !exclude?.has(n.nodeId))
      .map((n) => positions.get(n.nodeId) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 });
  }


  // Filters packed-away members out of every canvas rendering loop. Packing
  // (packAbl.ts) still exists as a relationship regardless — a container's
  // own count badge, and its "Packed (N)" unpack list in NodePanel, both
  // still work off Node.packedIntoNodeId either way — but a packed member
  // itself is hidden from the canvas. NodePanel still receives plain
  // `nodes` (not this), since it has to show a packed member in its
  // container's own unpack list even though the canvas itself doesn't
  // render it.
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
  // general on purpose, same as linkCycles below. See canvasLayout.ts's own
  // computeNodeGroups doc comment for the full reasoning (zone color vote,
  // outline polygon, etc.) — the grouping logic itself lives there now as a
  // pure function of these three inputs, this just wraps it in the memo.
  // Deliberately still keyed off [visibleNodes, positions] only, not `nodes`
  // too, even though the function resolves each root against `nodes` —
  // matching this hook's original dependency list exactly rather than
  // changing behavior as part of a pure relocation.
  const nodeGroups = useMemo(
    () => computeNodeGroups(visibleNodes, nodes, positions),
    [visibleNodes, positions],
  );

  // Circle-parent nodes always show their caption (see NodeCard's
  // showCaption) — this backfills their real text the moment a node becomes
  // one, rather than waiting on some other trigger (opening its panel, an
  // export) that might never come for a node nobody's actually clicked yet.
  useEffect(() => {
    const rootIds = nodeGroups.filter((g) => !g.members[0]?.title).map((g) => g.rootId);
    if (rootIds.length > 0) ensureNodeText(rootIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeGroups]);

  // Every member of the currently-chosen cluster shows its caption too (see
  // NodeCard's inChosenCircle) — backfill all of them the instant a circle
  // becomes the chosen one, same trigger the centering effect below reacts
  // to.
  useEffect(() => {
    if (spotlightedNodeIds && spotlightedNodeIds.length > 0) {
      // The text is what the chosen circle's members' captions need — once it
      // is in, the zone's loading spinner (if one is showing) can go.
      void ensureNodeText(spotlightedNodeIds).finally(() => setCircleLoadingRootId(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotlightedNodeIds]);

  // Centers the viewport on a circle/cluster the instant it becomes the
  // chosen one (handleCircleBackdropClick) — same "whatever you just picked
  // is always brought to the middle of the screen" rule centerOnNode already
  // applies to a single node, just aimed at the cluster's own centroid
  // (nodeGroups' cx/cy) instead of one node's position. Keyed only off the
  // rootId, not the whole selectedCircle object — a fresh object arrives on
  // every socket echo/API response even when it still names the same
  // circle, and re-panning on each of those would fight anyone who'd since
  // scrolled elsewhere without actually releasing it.
  useEffect(() => {
    const rootId = map?.selectedCircle?.rootId;
    if (!rootId) return;
    const group = nodeGroups.find((g) => g.rootId === rootId);
    if (!group) return;
    centerOnPoint(group.cx, group.cy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map?.selectedCircle?.rootId]);

  // NodePanel needs a selected node's real text regardless of how it got
  // selected (a plain click, the panel's own "Points at" link, a weapon
  // replay, …) — one backfill trigger here covers all of those instead of
  // repeating this at every call site that can set selectedId.
  useEffect(() => {
    if (selectedId) ensureNodeText([selectedId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // The two text-heavy reading modes draw every node's text, so all of it is
  // needed up front (one bulk request for whatever hasn't loaded yet).
  useEffect(() => {
    const ids = visibleNodes.filter((n) => (nodeDisplay[n.nodeId] ?? readingMode) !== "actual").map((n) => n.nodeId);
    if (ids.length > 0) ensureNodeText(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingMode, nodeDisplay, visibleNodes]);

  // Every circle member's sentiment, keyed by node id — what NodeCard reads
  // to decide its dashed outline and whether it's eligible to chaotic-drift
  // at all (see NodeCard's `chaotic`). A node in no circle isn't in this
  // map and never drifts, regardless of node.locked.
  const groupSentimentByNode = useMemo(() => {
    const map = new Map<string, Sentiment>();
    for (const g of nodeGroups) {
      for (const m of g.members) map.set(m.nodeId, g.sentiment);
    }
    return map;
  }, [nodeGroups]);

  // Every node outside any circle (a single node, or one whose parent has
  // only the one child) always shows its caption too — see NodeCard's
  // showCaption — so its real text gets backfilled the moment it's in that
  // state, same reasoning as the circle-root effect further up. A node that
  // *is* in a circle only needs its text once that circle is chosen, which
  // spotlightedNodeIds' own effect already covers.
  useEffect(() => {
    // A node with a title captions itself with that (already in hand, unlike
    // text) — nothing to fetch for it.
    const ids = nodes.filter((n) => !groupSentimentByNode.has(n.nodeId) && !n.title).map((n) => n.nodeId);
    if (ids.length > 0) ensureNodeText(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, groupSentimentByNode]);

  // Just the root/parent of each circle, keyed by its own id — what
  // NodeCard reads to draw its small crown badge (a "this is what the
  // circle radiates from" marker, distinct from groupSentimentByNode above,
  // which covers every member). Colored by the same majority-vote sentiment
  // as the circle's own zone backdrop, per nodeGroups.
  const circleRootSentimentByNode = useMemo(() => {
    const map = new Map<string, Sentiment>();
    for (const g of nodeGroups) map.set(g.rootId, g.sentiment);
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

  // Any closed loop in the Link graph reads as a "figure" and gets colored
  // in — see canvasLayout.ts's own computeLinkCycles doc comment for the
  // full reasoning; the DFS itself lives there now as a pure function of
  // `edges` alone, this just wraps it in the memo.
  const linkCycles = useMemo(() => computeLinkCycles(edges), [edges]);

  const indicatorByNode = useMemo(() => {
    const map = new Map<string, AttackIndicator>();
    for (const i of indicators) map.set(i.nodeId, i);
    return map;
  }, [indicators]);

  // A Problem node with no Success/Option/Solution child yet — nothing's
  // actually been proposed against it — pulses (see NodeCard's own
  // `unsolved` prop / index.css's unsolved-problem-pulse). "Addresses it"
  // is deliberately narrow (see ADDRESSES_PROBLEM_TYPES above): a Problem
  // with only more Problem/Fail children branched off it still counts as
  // unsolved, same as one with none at all — piling on more problems isn't
  // a proposal. Built from `nodes`, not visibleNodes: a packed-away child
  // still counts as "this got addressed", it just doesn't render on the
  // canvas any more.
  const unsolvedProblemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const n of nodes) {
      if (n.type !== "Problem" || n.isWeapon) continue;
      const hasAddressingChild = nodes.some(
        (child) => nodeRefId(child.parentId) === n.nodeId && ADDRESSES_PROBLEM_TYPES.has(child.type),
      );
      if (!hasAddressingChild) ids.add(n.nodeId);
    }
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  // ----- dragging -----

  // What dragging `dragged` to (x,y) would land it on, if anything — the
  // nearest other node within CIRCLE_DROP_RADIUS. Every restriction on
  // *joining* a circle this way (own-node-only, the 7-node cap, matching
  // sentiment) has been removed — any node can be dropped onto any other to
  // join its circle, any number of nodes, any mix of sentiment, same
  // "fully open" spirit combat and pack/protect creation already follow.
  // The one thing still checked is cycle-safety, not a restriction so much
  // as a correctness guard: dropping a node onto its own descendant would
  // close the parentId chain into a loop, which every bit of code that
  // walks that chain (nodeGroups, radialPositions, isDescendant itself)
  // assumes can never happen. null means the pointer isn't over anything
  // droppable at all, so the drag ends as a plain reposition instead.
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
    if (isDescendant(target.nodeId, dragged.nodeId, nodes)) {
      return { target, valid: false, reason: t.ui.errors.dropOnOwnBranch };
    }
    return { target, valid: true };
  }

  function onNodePointerDown(node: NodeDoc, e: ReactPointerEvent) {
    if (chooseMode || packMode || drawMode) return;
    if (!isOwnNode(node)) return;

    // Group drag: the pointer-downed node is itself a member of a 2+-node
    // multi-selection — move every selected (own) node by the same pointer
    // delta at once instead of the single-node path below. No circle-join
    // drop-target check here at all (see the plan's own scope note) — a
    // group drop is always a plain bulk reposition; each member persists
    // with its own PATCH /api/nodes/:nodeId (no bulk endpoint exists), all
    // in parallel. Skipped when the pointer-downed node itself is locked
    // (Node.locked — its circle is the currently-chosen one, see
    // handleCircleBackdropClick): a chosen cluster holds its position for
    // good, so falls through to the ordinary long-press/tap paths below
    // instead of starting a reposition.
    if (multiSelectIds.size > 1 && multiSelectIds.has(node.nodeId) && !node.locked) {
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      dragMoved.current = false;
      // !n.locked too — a locked member caught up in a wider multi-selection
      // still can't move even if the node the drag actually started from
      // isn't itself locked.
      const memberIds = Array.from(multiSelectIds).filter((id) => {
        const n = nodes.find((nn) => nn.nodeId === id);
        return !!n && isOwnNode(n) && !n.isWeapon && !n.locked;
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
          setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.moveNodes);
        }
      }

      window.addEventListener("pointermove", onGroupMove);
      window.addEventListener("pointerup", onGroupUp);
      return;
    }

    // Outside explicit move mode, a bare pointer-down on a single node
    // never arms a reposition/reparent drag — only touch's own
    // long-press-to-multiselect gesture still lives here (a deliberate,
    // held gesture, not the accidental case this addresses); a plain tap
    // or click falls straight through to NodeCard's own onClick, untouched.
    // This is what actually fixes "uncomfortable to accidentally drag and
    // drop nodes": dragging has to be turned on first (the toolbar's own
    // Move toggle) instead of arming from the very first pointerdown on
    // any node, so a phone's own touch imprecision while just trying to
    // tap a node can't relocate — or even re-parent — it by accident.
    // node.locked takes the same path even with Move on — a
    // chosen circle's own members hold their position for good (see the
    // group-drag branch's own comment above), so Move toggled on never
    // re-arms a reposition for one of them either; touch long-press-to-
    // multiselect still works, since picking a locked node into some other
    // selection doesn't move anything.
    if (!moveMode || node.locked) {
      if (e.pointerType !== "touch") return;
      const touchStartX = e.clientX;
      const touchStartY = e.clientY;
      const LONG_PRESS_MS = 500;
      const LONG_PRESS_MOVE_TOLERANCE = 10;
      let longPressTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
        longPressTimer = undefined;
        window.removeEventListener("pointermove", onIdleMove);
        window.removeEventListener("pointerup", onIdleUp);
        navigator.vibrate?.(15); // subtle haptic confirmation; a silent no-op wherever unsupported
        // Same contract onCanvasPointerDown's marquee onUp already follows —
        // starting a multi-selection always clears any stale single
        // selection, so it can't resurface (a NodePanel popping back open
        // for a node nobody re-picked) once the group empties back out.
        setSelectedId(null);
        setMultiSelectIds((prev) => {
          const next = new Set(prev);
          if (next.has(node.nodeId)) next.delete(node.nodeId);
          else next.add(node.nodeId);
          return next;
        });
      }, LONG_PRESS_MS);
      function onIdleMove(ev: PointerEvent) {
        if (longPressTimer && Math.hypot(ev.clientX - touchStartX, ev.clientY - touchStartY) > LONG_PRESS_MOVE_TOLERANCE) {
          clearTimeout(longPressTimer);
          longPressTimer = undefined;
        }
      }
      function onIdleUp() {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = undefined;
        }
        window.removeEventListener("pointermove", onIdleMove);
        window.removeEventListener("pointerup", onIdleUp);
      }
      window.addEventListener("pointermove", onIdleMove);
      window.addEventListener("pointerup", onIdleUp);
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

    // Long-press to multi-select, touch only — there's no keyboard on a
    // phone to reach shift+click's own toggle any other way, and
    // marquee-drag is already claimed by native canvas panning on touch
    // (see onCanvasPointerDown's own comment), so touch had no path into
    // multi-select at all. Holding still for LONG_PRESS_MS toggles this
    // node into/out of the multi-selection, same common "long-press to
    // start picking" gesture photo/file picker apps already use; moving
    // more than a few px (real drag, not a held finger's own jitter) or
    // releasing early cancels it and falls through to the ordinary
    // tap-to-select/drag paths below, untouched.
    const LONG_PRESS_MS = 500;
    const LONG_PRESS_MOVE_TOLERANCE = 10;
    let longPressTimer: ReturnType<typeof setTimeout> | undefined;
    // Reused below by onMove's own cancellation check — stays undefined
    // (a no-op) for a mouse pointerdown, only ever assigned for touch.
    let cancelLongPressIfMoved: ((ev: PointerEvent) => void) | undefined;
    if (e.pointerType === "touch") {
      const touchStartX = e.clientX;
      const touchStartY = e.clientY;
      longPressTimer = setTimeout(() => {
        longPressTimer = undefined;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setDragState(null);
        setGroupDragState(null);
        setDropTarget(null);
        navigator.vibrate?.(15); // subtle haptic confirmation; a silent no-op wherever unsupported
        // See the other long-press timer's own comment above (the !moveMode
        // branch) — same "starting a multi-selection clears any stale
        // single selection" contract the marquee already follows.
        setSelectedId(null);
        setMultiSelectIds((prev) => {
          const next = new Set(prev);
          if (next.has(node.nodeId)) next.delete(node.nodeId);
          else next.add(node.nodeId);
          return next;
        });
      }, LONG_PRESS_MS);
      cancelLongPressIfMoved = (ev: PointerEvent) => {
        if (longPressTimer && Math.hypot(ev.clientX - touchStartX, ev.clientY - touchStartY) > LONG_PRESS_MOVE_TOLERANCE) {
          clearTimeout(longPressTimer);
          longPressTimer = undefined;
        }
      };
    }

    function onMove(ev: PointerEvent) {
      cancelLongPressIfMoved?.(ev);
      const p = screenToCanvas(ev.clientX, ev.clientY);
      const x = p.x - offsetX;
      const y = p.y - offsetY;
      dragMoved.current = true;
      setDragState({ nodeId: node.nodeId, x, y });
      const found = findDropTarget(node, x, y);
      setDropTarget(found ? { nodeId: found.target.nodeId, valid: found.valid } : null);
    }

    async function onUp(ev: PointerEvent) {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = undefined;
      }
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
      setGroupDragState(null);
      setDropTarget(null);
      if (dragMoved.current) {
        if (found && !found.valid) {
          // Invalid drop (own descendant, per findDropTarget's own
          // isDescendant check) — cancel the whole move instead of falling
          // through to a plain reposition below. node.x/y were never
          // touched during the drag (only dragState was, and that's already
          // cleared above), so simply not persisting anything here is
          // enough to snap it back to where it started.
          setActionError(found.reason ?? t.ui.errors.cannotJoin);
          return;
        }
        if (found && found.valid) {
          // Dropped onto an eligible node — join its circle instead of a
          // plain reposition. Land just next to the target rather than
          // exactly on top of it: nudged only as far as it takes to stop
          // covering it (see footprintObstacles), not a full node-spacing
          // away from where it was let go.
          const target = found.target;
          const placed = avoidOverlap(
            { x, y },
            footprintObstacles(obstaclePoints(new Set([node.nodeId]))),
            viewportBounds(),
            zoneAngleGuard(node.nodeId, target.nodeId, visibleNodes, positions),
          );
          setActionError(null);
          try {
            const updated = await nodesApi.updateNode(node.nodeId, {
              x: placed.x,
              y: placed.y,
              parentId: target.nodeId,
            });
            upsertNode(updated);
          } catch (err) {
            setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.joinCircle);
          }
          return;
        }
        // A drop lands where it was let go. The only thing that moves it is a
        // node it would visibly cover, and then only by the little it takes
        // to clear that node (footprint boxes — see footprintObstacles), so
        // where a node ends up is never a surprise. Deliberately no
        // backdrop obstacles either: pushing a drop out of some other
        // circle's zone (a big area, once a circle has a few nodes) is what
        // sent nodes flying well away from the pointer.
        //
        // Dragged clear of its own circle's backdrop (not just repositioned
        // within it) — read as "pull this node out", clearing parentId so it
        // stops being a member. Only applies to an actual *member* (its own
        // parentId points at the circle's root); dragging the root itself
        // just moves the root. A circle with only one member left after this
        // simply stops being one — nodeGroups requires 2+ children, so its
        // backdrop disappears on its own, no separate cleanup needed here.
        const parentId = nodeRefId(node.parentId);
        const ownCircle = parentId ? nodeGroups.find((g) => g.rootId === parentId) : undefined;
        // Still a member at the raw drop point? Then that circle's corners
        // are what the drop is checked against (see zoneAngleGuard); a node
        // being pulled out no longer shapes it.
        const staysMember = !!ownCircle && Math.hypot(x - ownCircle.cx, y - ownCircle.cy) <= ownCircle.r;
        const dropped = avoidOverlap(
          { x, y },
          footprintObstacles(obstaclePoints(new Set([node.nodeId]))),
          viewportBounds(),
          zoneAngleGuard(node.nodeId, staysMember ? (parentId ?? null) : null, visibleNodes, positions),
        );
        // Judged at the raw drop point, not at `dropped` — nudging a drop off
        // another node or into a wider corner mustn't be what pulls it out.
        const leftCircle = !!ownCircle && !staysMember;
        if (leftCircle && parentId && leavingPinchesZone(node.nodeId, parentId, visibleNodes, positions)) {
          // Leaving would squeeze the circle it's leaving into a sliver.
          // Nothing was persisted (only dragState moved), so simply not
          // saving anything snaps the node back where it started.
          setActionError(t.ui.errors.pullOut);
          return;
        }

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
          if (leftCircle) setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.leaveCircle);
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
    return idOf(node.userId) === user?._id;
  }

  // Owner-only — text/type editing isn't otherwise restricted (an earlier
  // version locked it once a node had taken any damage, but that blocked
  // ordinary corrections too aggressively; see NodePanel.tsx's own canEdit).
  function canEditNode(node: NodeDoc) {
    return isOwnNode(node);
  }

  // Any node (yours, someone else's, a weapon node, already at 0 health) is a
  // valid attack target for any map member. What varies is which node types
  // the attack may carry (NodePanel's allowedAttackTypes, enforced by
  // attackAbl.ts), not which nodes may be attacked.
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
  async function startInlineEdit(node: NodeDoc) {
    setContextMenu(null);
    setPendingCreate(null);
    setSelectedId(node.nodeId);
    if (!canEditNode(node)) return;
    // Awaited, not fire-and-forget: NodeCard seeds its draft from node.text
    // the instant inlineEditing flips true, and again on every later change
    // to node.text while still editing (so a slower typist can still get
    // clobbered if this landed *during* editing instead of before it) — so
    // the real text has to be in `nodes` before setInlineEditId turns
    // editing on, not just requested around the same time as it.
    await ensureNodeText([node.nodeId]);
    setInlineEditId(node.nodeId);
  }

  function handleNodeClick(node: NodeDoc, shiftKey = false) {
    setContextMenu(null);
    // While drawing a line a node is just something in the way (a click on it
    // can't place a point) — it isn't selected.
    if (drawMode) return;
    if (packMode) {
      // Same toggle-in/out-freely behavior link mode's own picking uses —
      // clicking an already-picked node just removes that one pick.
      if (packSelection.has(node.nodeId)) {
        dispatchMode({ type: "packToggle", nodeId: node.nodeId });
        return;
      }
      if (node.nodeId === packContainerId) return; // the anchor can't pack itself
      const eligible = packContainerId ? computeLinkedNeighborIds(packContainerId, nodes, edges) : new Set<string>();
      if (!eligible.has(node.nodeId)) {
        dispatchMode({ type: "packSetError", error: t.ui.pack.onlyLinked });
        return;
      }
      dispatchMode({ type: "packToggle", nodeId: node.nodeId });
      return;
    }
    if (chooseMode) {
      // Tapping a node chooses it together with its whole branch (see
      // branchIds); tapping one that is already chosen drops it and its branch
      // again. Shift+tap acts on just that one node.
      if (!isOwnNode(node)) {
        setActionError(t.ui.errors.chooseOwn);
        return;
      }
      setActionError(null);
      const affected = shiftKey ? [node.nodeId] : [node.nodeId, ...branchIds(node.nodeId)];
      setMultiSelectIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.nodeId)) affected.forEach((id) => next.delete(id));
        else affected.forEach((id) => next.add(id));
        return next;
      });
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
      // Editing is done — close the node's panel, same as after Enter in it.
      setSelectedId((cur) => (cur === node.nodeId ? null : cur));
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.update);
    } finally {
      setInlineEditId(null);
    }
  }

  // Enters choose mode with `nodeId` already chosen — from a node's own
  // "Choose…" (its panel or right-click menu). Drops the single selection: the
  // group bar takes over the bottom sheet, and NodePanel can't share it.
  function startChooseFrom(nodeId: string) {
    setSelectedId(null);
    dispatchMode({ type: "chooseStart" });
    setMultiSelectIds(new Set([nodeId, ...branchIds(nodeId)]));
  }

  // Every node below `rootId` in the branch tree (parentId) — its children, their
  // children, and so on — that you can choose: your own, on the canvas, and not
  // an attack or shield node (those hang off a node by parentId too, but they
  // aren't part of the argument). In the order a reader would follow it, level
  // by level from the top, which is also the order "Number in order" numbers
  // them in.
  function branchIds(rootId: string): string[] {
    const childrenOf = new Map<string, NodeDoc[]>();
    for (const n of visibleNodes) {
      const parent = nodeRefId(n.parentId);
      if (!parent) continue;
      if (!childrenOf.has(parent)) childrenOf.set(parent, []);
      childrenOf.get(parent)!.push(n);
    }
    const found: string[] = [];
    const seen = new Set<string>([rootId]);
    const queue = [rootId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const child of childrenOf.get(current) ?? []) {
        if (seen.has(child.nodeId)) continue;
        seen.add(child.nodeId);
        // Not chosen itself if it's someone else's, an attack or a shield — but
        // its own children are still reached through it.
        if (isOwnNode(child) && !child.isWeapon && !child.isProtection) found.push(child.nodeId);
        queue.push(child.nodeId);
      }
    }
    return found;
  }

  // Leaves choose mode and drops the whole group selection — shared by the
  // group bar's own Deselect and every action that finishes with the chosen
  // nodes, so they can't drift apart on what "done choosing" means.
  function exitChooseMode() {
    dispatchMode({ type: "reset" });
    setMultiSelectIds(new Set());
  }

  // The group bar's "Link": the chosen nodes, in the order they were chosen,
  // go to the sentiment modal, which creates the actual edges once submitted.
  function linkSelection() {
    const picks = Array.from(multiSelectIds)
      .map((id) => nodes.find((n) => n.nodeId === id))
      .filter((n): n is NodeDoc => !!n);
    if (picks.length < 2) return;
    setPendingLink(picks);
    exitChooseMode();
  }

  // Opens the pack picker for containerNode — keyed by one fixed anchor
  // (packContainerId) instead of a growing list of choices. dispatchMode's
  // "packStart" replaces whatever mode was active before (choose or draw
  // included — the three share this same bottom-sheet slot, so only one can
  // really be "active" at once), but doesn't touch the group selection, which
  // choose mode also used — clear that explicitly, same as exitChooseMode
  // would have.
  function startPackFrom(containerNodeId: string) {
    setMultiSelectIds(new Set());
    dispatchMode({ type: "packStart", containerId: containerNodeId });
  }

  // Backs out of pack mode without packing anything — shared by the picker's
  // own ✕/Cancel and anything else abandoning a pick in progress.
  function exitPackMode() {
    dispatchMode({ type: "reset" });
  }

  const packContainer = packContainerId ? nodes.find((n) => n.nodeId === packContainerId) : undefined;
  // The picks resolved to real nodes — a node deleted mid-pick by someone
  // else just quietly drops out.
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
      dispatchMode({ type: "packSetError", error: err instanceof ApiRequestError ? err.message : t.ui.errors.pack });
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
    // While drawing, a right-click takes back the last point.
    if (drawMode) {
      undoDrawPoint();
      return;
    }
    setSelectedId(null);
    setContextMenu(null);
    setMultiSelectIds(new Set());
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    setCanvasContextMenu({ screenX: e.clientX, screenY: e.clientY, canvasX: canvasPos.x, canvasY: canvasPos.y });
  }

  // Rubber-band (marquee) select: a plain left-button drag started on empty
  // canvas (free to claim — panning is native scroll/trackpad, not a
  // click-drag) sweeps a rectangle and, on release, replaces
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
    if (chooseMode || packMode || drawMode || e.button !== 0 || e.pointerType === "touch") return;
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

  // Right-click on a node: CUD + Link for your own nodes, plus Attack for any
  // node (see canAttackNode).
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
    if (!confirm(t.ui.node.deleteConfirm)) return;
    try {
      const res = await nodesApi.deleteNode(node.nodeId);
      applyNodeDeleted(node.nodeId);
      // Deleting a protection node with banked damage releases the whole
      // total onto whatever it was defending — see Backend's deleteNodeDao.
      if (res.damagedProtectedNode) upsertNode(res.damagedProtectedNode);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.delete);
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
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.releaseCircle);
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
    setCircleLoadingRootId(rootId);
    try {
      const selected = await mapsApi.selectCircle(mapId, rootId);
      applyCircleSelection(selected);
      // Normally the spinner is cleared once the members' text has loaded (see
      // the spotlightedNodeIds effect) — with no members there is nothing to wait for.
      if (!selected || selected.nodeIds.length === 0) setCircleLoadingRootId(null);
    } catch (err) {
      setCircleLoadingRootId(null);
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.updateCircle);
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
    // it on top of another node. Nudge clear before opening the input, but
    // only as far as it takes to stop covering that node (footprint boxes —
    // see footprintObstacles): the new node should appear where the ghost
    // was, not a full node-spacing away from it.
    const placed = avoidOverlap(
      pos,
      footprintObstacles(obstaclePoints()),
      viewportBounds(),
      zoneAngleGuard(NEW_NODE_ID, parent.nodeId, visibleNodes, positions),
    );
    setInlineEditId(null);
    setPendingCreate({ x: placed.x, y: placed.y, type, parentId: parent.nodeId });
  }

  // Grows a template branch (see utils/templates.ts) from `root`: every node
  // is a real node with its prompt as title + text, created parents-first so
  // each one can hang from the previous.
  async function applyTemplate(kind: TemplateKind, root: NodeDoc) {
    if (!mapId) return;
    const rootPos = positions.get(root.nodeId) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    const placed = layoutTemplate(kind, rootPos, obstaclePoints());
    const ids = new Map<TemplateNodeKey, string>();
    for (const p of placed) {
      const copy = t.ui.templates.nodes[p.key];
      const node = await nodesApi.createNode(mapId, {
        text: copy.text,
        title: copy.title,
        type: p.type,
        order: p.order,
        x: p.x,
        y: p.y,
        parentId: p.parentKey ? ids.get(p.parentKey) : root.nodeId,
      });
      ids.set(p.key, node.nodeId);
      upsertNode(node);
    }
    showNotice(t.ui.templates.created(placed.length));
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
      // Deselect rather than select the freshly-created node — same "close
      // the panel after creating a node" behavior NodePanel's own
      // handleAttack/handleProtect follow, applied to every other
      // node-creation path (toolbar, double-click, quick-add) that ends up
      // here too. Used to select it instead, opening its panel right away;
      // this leaves the canvas clear so the create-flow itself reads as
      // finished rather than immediately handing you another panel.
      setSelectedId(null);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.createNode);
    } finally {
      setPendingCreate(null);
    }
  }

  // ---- Display of chosen nodes ----
  // Nodes in a text mode (icons + text, classic mind map) take far more room
  // than an icon does, and overlap their neighbors at the current spacing. A node
  // draws at a constant size on screen whatever the zoom is, so zooming in
  // spreads the positions apart without changing anything else — the view
  // "extends" until the expanded nodes clear each other (or as far as the zoom
  // allows). Only ever zooms in; nothing is moved.
  function fitZoomForDisplay(display: NodeDisplay, globalMode: ReadingMode, centerOn?: { x: number; y: number }) {
    const items = visibleNodes.flatMap((n) => {
      const pos = positions.get(n.nodeId);
      if (!pos) return [];
      const mode = display[n.nodeId] ?? globalMode;
      const tier = circleRootSentimentByNode.has(n.nodeId) ? 3 : (n.sizeTier ?? 1);
      const multiplier = tier === 3 ? 1.3 : tier === 2 ? 1.15 : 1;
      return [{ x: pos.x, y: pos.y, ...nodeFootprint(n, mode, multiplier), expanded: mode !== "actual" }];
    });
    const needed = zoomToSeparate(items);
    if (needed <= zoom + 0.005) return;
    const target = Math.min(MAX_ZOOM, needed * 1.03);
    zoomFromCenter(0, target);
    showNotice(needed > MAX_ZOOM ? t.ui.display.stillOverlap : t.ui.display.zoomedToFit);
    // Zooming keeps the middle of the screen fixed; bring the nodes that just
    // changed back into it.
    if (centerOn) setTimeout(() => centerOnPoint(centerOn.x, centerOn.y), 250);
  }

  // The group bar's "Show as": the chosen nodes take this reading mode (null =
  // back to following the map's), then the view zooms in if they'd overlap.
  function setDisplayForChosen(mode: ReadingMode | null) {
    const ids = Array.from(multiSelectIds);
    if (ids.length === 0) return;
    const next: NodeDisplay = { ...nodeDisplay };
    for (const id of ids) {
      if (mode === null) delete next[id];
      else next[id] = mode;
    }
    setNodeDisplay(next);
    saveNodeDisplay(mapId, next);
    const chosen = ids.map((id) => positions.get(id)).filter((p): p is { x: number; y: number } => !!p);
    const middle = chosen.length
      ? { x: chosen.reduce((sum, p) => sum + p.x, 0) / chosen.length, y: chosen.reduce((sum, p) => sum + p.y, 0) / chosen.length }
      : undefined;
    fitZoomForDisplay(next, readingMode, middle);
  }

  // ---- Separator lines ----
  // Drawing takes over the canvas clicks and the bottom sheet, so anything
  // else in progress steps aside first.
  function toggleDrawMode() {
    if (drawMode) {
      exitDrawMode();
      return;
    }
    setSelectedId(null);
    setMultiSelectIds(new Set());
    setContextMenu(null);
    setCanvasContextMenu(null);
    setPendingCreate(null);
    dispatchMode({ type: "drawStart" });
  }

  function exitDrawMode() {
    dispatchMode({ type: "reset" });
  }

  // A point may go anywhere no node and no zone covers, and so may the stretch
  // leading to it — see utils/drawLine.ts. Other lines are not obstacles: lines
  // may cross and join each other.
  function drawObstacles() {
    return {
      nodes: visibleNodes.map((n) => posFor(n)),
      polygons: [
        ...nodeGroups.map((g) => g.outline),
        ...linkCycles.map((cycle) =>
          cycle
            .map((id) => visibleNodes.find((n) => n.nodeId === id))
            .filter((n): n is NodeDoc => !!n)
            .map((n) => posFor(n)),
        ),
      ],
      circles: visibleNodes.filter((n) => n.manualZone).map((n) => posFor(n)),
      classic: readingMode === "classic",
    };
  }

  // Why `p` can't be the next point of the line in progress, or null when it can.
  function drawRefusal(p: { x: number; y: number }): "spot" | "crossing" | null {
    const obstacles = drawObstacles();
    if (!isPointFree(p, obstacles)) return "spot";
    const last = drawPoints[drawPoints.length - 1];
    if (last && !isSegmentFree(last, p, obstacles)) return "crossing";
    return null;
  }

  function addDrawPoint(raw: { x: number; y: number }) {
    if (drawSaving) return;
    // A click near an existing line joins it — on its corner, or on the spot
    // along it nearest to the click.
    const p = snapToLines(raw, lines);
    const refusal = drawRefusal(p);
    if (refusal) {
      dispatchMode({ type: "drawSetBlocked", blocked: refusal });
      if (drawBlockedTimeoutRef.current) clearTimeout(drawBlockedTimeoutRef.current);
      drawBlockedTimeoutRef.current = setTimeout(() => dispatchMode({ type: "drawSetBlocked", blocked: null }), 2200);
      return;
    }
    dispatchMode({ type: "drawSetBlocked", blocked: null });
    // A double-click lands two clicks on the same spot — one point is enough.
    const last = drawPoints[drawPoints.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 8) return;
    if (drawPoints.length >= 200) return; // the backend's own limit per line
    dispatchMode({ type: "drawAddPoint", point: p });
  }

  function undoDrawPoint() {
    dispatchMode({ type: "drawUndoPoint" });
  }

  // Follows the pointer with the free/blocked ring — at most once per frame.
  function onDrawPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "touch") return;
    const p = snapToLines(screenToCanvas(e.clientX, e.clientY), lines);
    if (drawHoverFrameRef.current !== null) cancelAnimationFrame(drawHoverFrameRef.current);
    drawHoverFrameRef.current = requestAnimationFrame(() => dispatchMode({ type: "drawSetHover", hover: p }));
  }

  async function finishLine() {
    if (!mapId || drawPoints.length < 2 || drawSaving) return;
    dispatchMode({ type: "drawSetSaving", saving: true });
    setActionError(null);
    try {
      const line = await linesApi.createLine(mapId, drawPoints);
      upsertLine(line);
      dispatchMode({ type: "drawClearPoints" });
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.lines.createFailed);
    } finally {
      dispatchMode({ type: "drawSetSaving", saving: false });
    }
  }

  // Whoever drew a line may delete it, and so may the map's owner.
  function canDeleteLine(line: LineDoc) {
    return idOf(line.userId as any) === user?._id || map?.ownerId === user?._id;
  }

  async function handleLineClick(line: LineDoc) {
    if (!canDeleteLine(line)) return;
    if (!confirm(t.ui.lines.deleteConfirm)) return;
    setActionError(null);
    try {
      await linesApi.deleteLine(line.lineId);
      setLines((prev) => prev.filter((l) => l.lineId !== line.lineId));
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.lines.deleteFailed);
    }
  }

  // Ctrl/Cmd+C / Ctrl/Cmd+V, the selection menu's Copy, the "+" menu's Copy
  // whole map / Paste, and the canvas menu's Paste here — see
  // utils/nodeClipboard.ts for what a copy holds and why it survives a
  // reload and is shared between tabs. Copies the chosen node(s)
  // (multiSelectIds if any are picked, else the single selectedId) with their
  // text, look, layout, branch parents and the connections among them — but
  // not health, attacks or packing, and nothing pointing at a node that
  // wasn't copied.
  //
  // Fixed offset (not random/growing) so a repeated copy-paste-paste-paste
  // on the *same* map fans pasted copies out along one consistent diagonal
  // instead of clustering — avoidOverlap (used when actually placing each
  // one, below) still nudges clear of whatever's already there regardless.
  const PASTE_OFFSET = 40;

  async function copySelection() {
    const ids = multiSelectIds.size > 0 ? Array.from(multiSelectIds) : selectedId ? [selectedId] : [];
    if (ids.length === 0) return;
    await copyNodes(ids);
  }

  async function copyWholeMap() {
    await copyNodes(null);
  }

  // `pickIds` null = every node on the map.
  async function copyNodes(pickIds: string[] | null) {
    if (!mapId) return;
    // Awaited, not read straight off `n.text` — a marquee/long-press pick
    // never necessarily opened any of these nodes first, so their real text
    // may not have loaded yet (see ensureNodeText's own doc comment on why
    // its *return value*, not a re-read of `nodes`, is what's safe to use
    // right after awaiting it).
    const wanted = (pickIds ?? visibleNodes.map((n) => n.nodeId)).filter((id) => {
      const n = nodes.find((x) => x.nodeId === id);
      return !!n && !n.isWeapon && !n.isProtection;
    });
    const textById = await ensureNodeText(wanted);
    const clipboard = buildNodeClipboard(mapId, nodes, pickIds, textById, edges);
    if (!clipboard) {
      showNotice(t.ui.clipboard.nothingToCopy);
      return;
    }
    if (!writeNodeClipboard(clipboard)) {
      setActionError(t.ui.clipboard.storeFailed);
      return;
    }
    showNotice(t.ui.clipboard.copied(clipboard.nodes.length));
  }

  // SelectionMenu's "Copy as text" — unlike copySelection above (which feeds
  // Ctrl/Cmd+V's in-app duplicate-paste), this writes plain text straight to
  // the OS clipboard for pasting into a doc/chat/wherever, same
  // navigator.clipboard.writeText pattern ExportTextModal/NodePanel already
  // use for their own Copy buttons. Ordered top-to-bottom/left-to-right (not
  // selection order) so the text reads in the same spatial order as the
  // canvas, same tie-break buildTreeExport uses.
  async function copySelectionAsText() {
    const ids = multiSelectIds.size > 0 ? Array.from(multiSelectIds) : selectedId ? [selectedId] : [];
    if (ids.length === 0) return;
    const picked = ids
      .map((id) => nodes.find((n) => n.nodeId === id))
      .filter((n): n is NodeDoc => !!n && !n.isWeapon && !n.isProtection)
      .sort((a, b) => {
        const pa = positions.get(a.nodeId) ?? { x: a.x ?? 0, y: a.y ?? 0 };
        const pb = positions.get(b.nodeId) ?? { x: b.x ?? 0, y: b.y ?? 0 };
        return stepRank(a) - stepRank(b) || pa.y - pb.y || pa.x - pb.x;
      });
    if (picked.length === 0) return;
    // See copySelection's own comment above — same reason this reads the
    // returned map instead of `n.text` directly.
    const textById = await ensureNodeText(picked.map((n) => n.nodeId));
    const text = picked.map((n) => `${stepPrefix(n)}${n.type}: ${textById[n.nodeId] ?? n.text}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setActionError(t.ui.errors.clipboard);
    }
  }

  // The "+" AddMenu's whole-map "Export text" — the only place this now
  // lives (NodePanel's own copy of this same button is gone; a parent node
  // gets the cluster-scoped extractClusterText below instead). Backfills
  // every visible, real node's text before opening the modal — buildTreeExport
  // needs all of it at once, unlike the other export/copy actions above,
  // which only ever need a chosen few nodes' worth.
  async function openExportText() {
    const ids = visibleNodes.filter((n) => !n.isWeapon && !n.isProtection).map((n) => n.nodeId);
    if (ids.length > 0) await ensureNodeText(ids);
    setShowExportText(true);
  }

  // NodePanel's own "Extract text" for a circle's parent node — scoped to
  // just that node's own cluster (itself + its direct children) plus, for
  // any child that's itself the root of a further cluster, that cluster too
  // — recursively, so a whole chain of nested clusters headed by this
  // node's own descendants comes along, but nothing outside this node's own
  // branch does. Same buildTreeExport-shaped output as the whole-map export
  // (see textExport.ts), just walked from one starting node instead of
  // every root on the map.
  function collectClusterSubtree(rootId: string): NodeDoc[] {
    const collected = new Map<string, NodeDoc>();
    const queue = [rootId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const group = nodeGroups.find((g) => g.rootId === id);
      if (!group) continue;
      for (const member of group.members) {
        if (collected.has(member.nodeId)) continue;
        collected.set(member.nodeId, member);
        // A member that's itself a cluster's own root gets that cluster
        // pulled in too — nodeGroups.find above will pick it up on a later
        // pass through the queue.
        queue.push(member.nodeId);
      }
    }
    return Array.from(collected.values());
  }

  async function extractClusterText(rootId: string) {
    const subtree = collectClusterSubtree(rootId);
    if (subtree.length === 0) return;
    await ensureNodeText(subtree.map((n) => n.nodeId));
    setExtractClusterRootId(rootId);
  }

  // Pastes what's on the clipboard (see copyNodes) into this map — this one
  // or a different one — as brand-new nodes, keeping branch parents and the
  // connections among them. `at` (a canvas point, from the canvas menu's
  // "Paste here") puts the group's middle there.
  async function pasteClipboard(at?: { x: number; y: number }) {
    const clipboard = readNodeClipboard();
    if (!mapId) return;
    if (!clipboard) {
      showNotice(t.ui.clipboard.nothingToPaste);
      return;
    }
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
    let dx = PASTE_OFFSET;
    let dy = PASTE_OFFSET;
    if (at || !sameMap) {
      const cx = clipboard.nodes.reduce((sum, n) => sum + n.x, 0) / clipboard.nodes.length;
      const cy = clipboard.nodes.reduce((sum, n) => sum + n.y, 0) / clipboard.nodes.length;
      const anchor = at ?? pickNonOverlappingPosition(obstaclePoints(), bigNodeObstacles(), viewportBounds());
      dx = anchor.x - cx;
      dy = anchor.y - cy;
    }
    // Each node's spot, nudged clear of what is already on the map and of the
    // pasted nodes placed before it — decided up front so the group keeps its
    // shape wherever it can.
    const existing = [...nodeObstacles(obstaclePoints()), ...bigNodeObstacles()];
    const placedPoints: { x: number; y: number }[] = [];
    const placement = new Map<string, { x: number; y: number }>();
    for (const n of clipboard.nodes) {
      const placed = avoidOverlap({ x: n.x + dx, y: n.y + dy }, [...existing, ...nodeObstacles(placedPoints)], viewportBounds());
      placement.set(n.id, placed);
      placedPoints.push(placed);
    }
    const created: NodeDoc[] = [];
    try {
      // A node can only be created once the node it branches from exists, so
      // this goes in waves: everything without a copied parent first, then
      // their children, and so on. Each wave runs in parallel.
      const newIdBySource = new Map<string, string>();
      let pending = clipboard.nodes.slice();
      while (pending.length > 0) {
        let ready = pending.filter((n) => !n.parentId || newIdBySource.has(n.parentId));
        if (ready.length === 0) ready = pending; // a parent loop can't be satisfied — create the rest unlinked
        const batch = await Promise.all(
          ready.map((n) => {
            const spot = placement.get(n.id)!;
            return nodesApi.createNode(mapId, {
              text: n.text,
              title: n.title,
              type: n.type,
              x: spot.x,
              y: spot.y,
              parentId: n.parentId ? (newIdBySource.get(n.parentId) ?? null) : null,
              order: n.order,
              symbolOverride: n.symbolOverride,
              sizeTier: n.sizeTier,
              manualZone: n.manualZone,
            });
          }),
        );
        ready.forEach((n, i) => newIdBySource.set(n.id, batch[i].nodeId));
        batch.forEach((n) => {
          upsertNode(n);
          setCelebrateIds((prev) => new Set(prev).add(n.nodeId));
        });
        created.push(...batch);
        const done = new Set(ready.map((n) => n.id));
        pending = pending.filter((n) => !done.has(n.id));
      }
      // Then the connections among the copied nodes.
      const newEdges = await Promise.all(
        clipboard.edges.map((e) => {
          const from = newIdBySource.get(e.from);
          const to = newIdBySource.get(e.to);
          return from && to ? edgesApi.createEdge(mapId, { fromNodeId: from, toNodeId: to, sentiment: e.sentiment }) : null;
        }),
      );
      newEdges.forEach((e) => e && upsertEdge(e));
      if (newEdges.some(Boolean)) refreshInsights(mapId);
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
      showNotice(t.ui.clipboard.pasted(created.length));
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.paste);
    }
  }

  // SelectionMenu's "Delete N nodes" — one bulk DELETE /api/nodes request
  // (Backend's deleteManyNodesDao) instead of N parallel single-node
  // DELETEs. Confirms once for the whole batch rather than once per node
  // (the single-node handleDeleteNode's own confirm() would be absurd N
  // times in a row here). The backend silently skips any id the caller
  // doesn't own instead of failing the whole batch, so `deleted` can be a
  // strict subset of `ids` — local state is reconciled against `deleted`,
  // not the original selection, so a partial delete doesn't drop nodes that
  // were never actually removed.
  async function deleteSelection() {
    const ids = Array.from(multiSelectIds);
    if (ids.length === 0) return;
    if (!confirm(t.ui.selection.deleteConfirm(ids.length))) return;
    setActionError(null);
    try {
      const { deleted } = await nodesApi.deleteManyNodes(ids);
      const deletedIds = new Set(deleted.map((d) => d.deletedId));
      // Any protection node in the batch releases its own banked damage
      // onto whatever it was defending — see Backend's deleteNodeDao.
      deleted.forEach(({ damagedProtectedNode }) => {
        if (damagedProtectedNode) upsertNode(damagedProtectedNode);
      });
      setNodes((prev) => prev.filter((n) => !deletedIds.has(n.nodeId)));
      setEdges((prev) =>
        prev.filter(
          (e) => !deletedIds.has(nodeRefId(e.fromNodeId) ?? "") && !deletedIds.has(nodeRefId(e.toNodeId) ?? ""),
        ),
      );
      setMultiSelectIds(new Set());
      if (mapId) refreshInsights(mapId);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.deleteSelected);
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
        setActionError(t.ui.errors.groupPartial(results.length - skipped, others.length, skipped));
      }
      setMultiSelectIds(new Set());
      setSelectedId(root.nodeId);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.groupCircle);
    }
  }

  // The chosen own nodes, numbered 1, 2, 3… in the order they were chosen (or
  // with the numbers taken off) — a quick way to label a process's steps.
  async function numberSelection(clear: boolean) {
    const picks = Array.from(multiSelectIds)
      .map((id) => nodes.find((n) => n.nodeId === id))
      .filter((n): n is NodeDoc => !!n && isOwnNode(n));
    if (picks.length === 0) return;
    setActionError(null);
    try {
      const updated = await Promise.all(
        picks.map((n, i) => nodesApi.updateNode(n.nodeId, { order: clear ? null : i + 1 })),
      );
      updated.forEach(upsertNode);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.numberNodes);
    }
  }

  // Leaves a demo session for the login page — its account and map are
  // throwaway, so there is no way back to them afterwards. ProtectedRoute
  // sends a logged-out user to /login on its own.
  function exitDemo() {
    if (!confirm(t.ui.demo.exitConfirm)) return;
    void logout();
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
      const rootPos = pickNonOverlappingPosition(obstaclePoints(), bigNodeObstacles(), viewportBounds());
      const root = await nodesApi.createNode(mapId, {
        text: t.ui.canvas.newCircleText,
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
            [...nodeObstacles([...obstaclePoints(), rootPos]), ...bigNodeObstacles()],
            viewportBounds(),
          );
          return nodesApi.createNode(mapId, {
            // "Option" (not "unknown", like the root) — an all-"unknown"
            // trio would still draw a zone now (circleSentiment returns
            // "neutral" for a tied/no-vote group instead of skipping it —
            // see nodeGroups' own doc comment), but a flat gray backdrop is
            // a duller first impression than an actual colored one. Giving
            // both children a real (positive) type up front means "Create
            // circle" shows a leaning, halo-colored circle immediately.
            text: t.ui.canvas.newNodeText,
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
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.createCircle);
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
      if (isEditableTarget(e.target)) return;
      // Drawing a line: Enter finishes it, Backspace / Ctrl+Z takes back the
      // last point, Escape clears the line (or leaves drawing when nothing is
      // placed). A focused button keeps its own Enter.
      if (drawMode) {
        const onControl = e.target instanceof HTMLElement && !!e.target.closest("button, a, select, [role=menu]");
        if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
          e.preventDefault();
          undoDrawPoint();
          return;
        }
        if (!e.ctrlKey && !e.metaKey && !onControl) {
          if (e.key === "Enter") {
            e.preventDefault();
            void finishLine();
            return;
          }
          if (e.key === "Backspace") {
            e.preventDefault();
            undoDrawPoint();
            return;
          }
        }
        if (!e.ctrlKey && !e.metaKey && e.key === "Escape") {
          e.preventDefault();
          if (drawPoints.length > 0) dispatchMode({ type: "drawClearPoints" });
          else exitDrawMode();
          return;
        }
      }
      // Enter (or Escape) finishes choosing / a group selection. Skipped when a
      // button, link, select or menu has focus — there Enter has its own job.
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        (e.key === "Enter" || e.key === "Escape") &&
        (chooseMode || multiSelectIds.size > 0)
      ) {
        if (e.target instanceof HTMLElement && e.target.closest("button, a, select, [role=menu]")) return;
        e.preventDefault();
        exitChooseMode();
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
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

  if (loading) return <div className="p-12 text-center text-ink-soft">{t.ui.loadingMap}</div>;
  if (error || !map) {
    return (
      <div className="mx-auto w-full max-w-[1080px] px-6 pt-8 pb-16">
        <div className="mb-4 rounded-lg bg-danger-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-danger">
          {error || t.ui.errors.mapNotFound}
        </div>
        {/* A demo session has nowhere else to go — see the toolbar's own
            matching omission below, and ProtectedRoute's own redirect,
            which would just bounce this link straight back here anyway. */}
        {!user?.isDemo && <Link to="/">&larr; {t.map.toolbar.back}</Link>}
      </div>
    );
  }

  const isOwner = map.ownerId === user?._id;

  // "+" menu > Create node: a blank node input at a free spot in view.
  function startCreateNodeInView() {
    const pos = pickNonOverlappingPosition(obstaclePoints(), bigNodeObstacles(), viewportBounds());
    setInlineEditId(null);
    setPendingCreate({ x: pos.x, y: pos.y, type: "unknown", parentId: null });
  }
  // Map.discussionMode's real meaning now — see Backend/CLAUDE.md's own
  // updated doc comment. Undefined/true is "Discussion" (the default: full
  // combat controls visible, current/historical behavior), explicit false
  // is "Personal" (combat controls hidden — just nodes/edges/circles for
  // solo organizing). Never coerced with `!!` anywhere this is read — that
  // would collapse the undefined "never touched" default to false/Personal
  // instead of true/Discussion.
  const isDiscussionMode = map.discussionMode !== false;
  async function toggleMapMode() {
    if (!isOwner || !mapId) return;
    setActionError(null);
    try {
      const updated = await mapsApi.updateMap(mapId, { discussionMode: !isDiscussionMode });
      setMap(updated);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.changeMode);
    }
  }

  // The error banner's dismiss button.
  const btnSmGhost =
    "inline-flex cursor-pointer items-center justify-center gap-[0.4rem] rounded-lg border border-transparent bg-transparent px-[0.65rem] py-[0.35rem] text-[0.78rem] font-semibold text-ink transition-[background-color,border-color,opacity] duration-[120ms] enabled:hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {notice && (
        <div className="mx-4 mt-[0.6rem] flex items-center justify-between gap-3 rounded-lg bg-success-bg px-[0.9rem] py-[0.7rem] text-[0.85rem] text-success">
          {notice}
          <button className={btnSmGhost} onClick={dismissNotice}>
            ✕
          </button>
        </div>
      )}
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
            className="h-full w-full overflow-auto [overscroll-behavior-x:none]"
            ref={wrapRef}
          >
          {/* Padded outer sizing/transform wrapper — canvasRef (the real
              canvas, unchanged below) sits inset within this by
              hScrollMargin/vScrollMargin on every side (see their own doc
              comment) instead of filling it edge-to-edge the way it used
              to. Without this extra margin, wrap could never scroll any
              node closer to center than "the canvas's own edge is at the
              edge of the viewport" — a node right at/near the real
              0/CANVAS_W/CANVAS_H edge had nowhere left to scroll to, so
              centerOnNode's own clamp pinned it right there, and
              QuickAddGhosts/the radial ring's own safe-zone clamp then
              visibly detached their ring from a node sitting outside it.
              Carries the zoom transform (moved up from canvasRef itself)
              so the margin scales right along with the real content — a
              plain fixed pixel margin at zoom 1 would read as a much
              smaller (or larger) safety net once zoomed. transformOrigin
              "0 0" keeps that scaling anchored at this wrapper's own
              top-left. */}
          <div
            style={{
              position: "relative",
              width: CANVAS_W + hScrollMargin * 2,
              height: CANVAS_H + vScrollMargin * 2,
              transform: `scale(${zoom})`,
              transformOrigin: "0 0",
              // The blind zone: everything in this wrapper *outside* the
              // real canvas inset within it — a darkened, hatched band on
              // every side, so it reads as "past the edge of the map" and
              // the framed canvas (see its own style below) reads as the
              // one active space. The dot grid lives on the canvas rather
              // than the scroll container, so it stops at the border
              // instead of continuing under the blind zone.
              background:
                "repeating-linear-gradient(45deg, color-mix(in srgb, var(--ink) 9%, transparent) 0 1px, transparent 1px 9px), color-mix(in srgb, #000 14%, var(--paper))",
            }}
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
            className={`absolute select-none bg-paper bg-[radial-gradient(circle,var(--line)_1px,transparent_1px)] [background-size:22px_22px]${chooseMode || packMode ? " cursor-crosshair" : ""}`}
            // width/height stay the canvas's own native 2400x1600 — every
            // node/ghost/SVG position below is still expressed in that
            // native 0..2400 coordinate space, unaffected by this div now
            // sitting inset within a bigger padded parent rather than
            // filling it — only the *outer* wrapper's own size/transform
            // above changed. left/top inset by the same margin
            // screenToCanvas/zoomAt/viewportBounds/centerOnNode above
            // already subtract back out when converting a scroll position
            // to a real canvas coordinate.
            style={{
              left: hScrollMargin,
              top: vScrollMargin,
              width: CANVAS_W,
              height: CANVAS_H,
              // The active space's border — drawn outside the box (outline,
              // not border) so it never eats into the 2400x1600 coordinate
              // space every node position is expressed in.
              outline: "3px solid color-mix(in srgb, var(--ink) 55%, transparent)",
            }}
            onClick={(e) => {
              // See onCanvasPointerDown's own onUp comment — the trailing
              // native click a completed marquee drag leaves behind on this
              // same element would otherwise immediately clear the
              // selection that drag just computed.
              if (suppressNextClick.current) {
                suppressNextClick.current = false;
                return;
              }
              // Drawing a line: a click places a point (if the spot is free).
              if (drawMode) {
                addDrawPoint(screenToCanvas(e.clientX, e.clientY));
                return;
              }
              // Tapping empty canvas while choosing finishes it (and closes the
              // Actions menu with it) — same as Done / Enter.
              if (chooseMode) {
                exitChooseMode();
                return;
              }
              if (packMode) return;
              setSelectedId(null);
              setMultiSelectIds(new Set());
              releaseChosenCircleIfOutside();
            }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={drawMode ? onDrawPointerMove : undefined}
            onContextMenu={onCanvasContextMenu}
          >
            <CanvasBackdrop
              nodeGroups={nodeGroups}
              selectedCircle={map?.selectedCircle}
              visibleNodes={visibleNodes}
              edges={edges}
              posFor={posFor}
              circleRootSentimentByNode={circleRootSentimentByNode}
              linkCycles={linkCycles}
              chosenNodeIds={chosenNodeIds}
              pendingLink={pendingLink}
              onCircleClick={handleCircleBackdropClick}
              lines={lines}
              canDeleteLine={canDeleteLine}
              onLineClick={handleLineClick}
              interactive={!drawMode}
              drawing={
                drawMode
                  ? {
                      points: drawPoints,
                      hover: drawHover,
                      hoverFree: drawHover ? drawRefusal(drawHover) === null : true,
                    }
                  : null
              }
            />

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
                  // Drags off a bare pointer-down only actually happen when
                  // moveMode is on, or the node is already part of an
                  // active 2+-node multi-selection (that path stays live
                  // regardless — see onNodePointerDown's own group-drag
                  // branch) — this just keeps NodeCard's own grab/grabbing
                  // cursor honest about which nodes will really respond.
                  canDrag={
                    isOwnNode(node) &&
                    !node.locked &&
                    (moveMode || (multiSelectIds.size > 1 && multiSelectIds.has(node.nodeId)))
                  }
                  groupSentiment={groupSentimentByNode.get(node.nodeId)}
                  parentCrownSentiment={circleRootSentimentByNode.get(node.nodeId)}
                  inChosenCircle={!!spotlightedNodeIds?.includes(node.nodeId)}
                  indicator={indicatorByNode.get(node.nodeId)}
                  packedCount={packedCountByContainer.get(node.nodeId)}
                  unsolved={unsolvedProblemIds.has(node.nodeId)}
                  chooseModeActive={chooseMode}
                  readingMode={nodeDisplay[node.nodeId] ?? readingMode}
                  discussionMode={isDiscussionMode}
                  celebrate={celebrateIds.has(node.nodeId)}
                  flightVector={flightVector}
                  muted={
                    ((quickAddActive && node.nodeId !== selectedId) ||
                      (!!spotlightedNodeIds && !spotlightedNodeIds.includes(node.nodeId)) ||
                      (!chooseMode && multiSelectIds.size > 0 && !multiSelectIds.has(node.nodeId))) &&
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

            {/* Loading spinner on a zone that was just clicked — see
                circleLoadingRootId. Sits at the zone's middle, counter-scaled
                so it stays the same size on screen at any zoom. */}
            {circleLoadingRootId &&
              (() => {
                const group = nodeGroups.find((g) => g.rootId === circleLoadingRootId);
                if (!group) return null;
                return (
                  <div
                    className="pointer-events-none absolute z-[35]"
                    style={{
                      left: group.cx,
                      top: group.cy,
                      transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                    }}
                    role="status"
                    aria-label={t.ui.common.loading}
                    title={t.ui.common.loading}
                  >
                    <div className="h-11 w-11 animate-spin rounded-full border-4 border-accent/25 border-t-accent bg-surface/90 shadow-card" />
                  </div>
                );
              })()}
            <WeaponLayer
              visibleNodes={visibleNodes}
              posFor={posFor}
              celebrateIds={celebrateIds}
              shotState={shotState}
            />

            {/* No separate ShieldMark overlay any more — a protection node
                already sits exactly on the arrows path between attacker and
                defended node (see the positions memo) and the arrows
                targeting it stop right there (see the weapon-mark loop
                above), which is signal enough on its own; the extra
                bow-and-emblem drawing on top of it read as redundant
                clutter. NodeCard's own small 🛡️ badge is still the one
                thing marking a node as a protector, active attacker or not. */}

            {quickAddActive && selectedNode && !pendingCreate && !inlineEditId && (
              <QuickAddGhosts
                anchorPos={posFor(selectedNode)}
                bounds={settledViewportBounds()}
                onPick={(type, pos) => startQuickAdd(type, pos, selectedNode)}
              />
            )}

            {!loading && nodes.length === 0 && !pendingCreate && !drawMode && (
              <QuickAddGhosts
                intro
                anchorPos={{ x: CANVAS_W / 2, y: CANVAS_H / 2 }}
                // No bounds to squeeze the ring into: the view opens centered
                // on this point, so a full round ring fits.
                bounds={{ minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity }}
                onPick={(type, pos) => {
                  setActionError(null);
                  setPendingCreate({ x: pos.x, y: pos.y, type, parentId: null });
                }}
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
          </div>
          <MiniMap
            wrapRef={wrapRef}
            nodes={visibleNodes}
            edges={edges}
            lines={lines}
            positions={positions}
            groups={nodeGroups}
            canvasW={CANVAS_W}
            canvasH={CANVAS_H}
            zoom={zoom}
            hScrollMargin={hScrollMargin}
            vScrollMargin={vScrollMargin}
          />

          <MapToolbar
            isDemo={!!user?.isDemo}
            isOwner={isOwner}
            isDiscussionMode={isDiscussionMode}
            expanded={!quickAddActive || forceShowToolbar}
            onExpand={() => setForceShowToolbar(true)}
            moveMode={moveMode}
            onToggleMove={() => setMoveMode((v) => !v)}
            drawMode={drawMode}
            onToggleDraw={toggleDrawMode}
            readingMode={readingMode}
            onPickReadingMode={setReadingMode}
            onToggleMapMode={toggleMapMode}
            onExitDemo={exitDemo}
            onInvite={() => setShowInvite(true)}
            onCreateNode={startCreateNodeInView}
            onCreateCircle={createCircle}
            onCopyMap={copyWholeMap}
            onPaste={() => pasteClipboard()}
            onExportText={openExportText}
          />

          <ZoomControls
            zoom={zoom}
            onZoomOut={() => zoomFromCenter(-ZOOM_STEP)}
            onZoomIn={() => zoomFromCenter(ZOOM_STEP)}
            onReset={() => zoomFromCenter(0, 1)}
          />
        </div>

        {/* The pack picker and the group bar each take over this bottom-sheet
            slot from NodePanel while they're active, so the two never try to
            render at once (choosing a node from its panel drops the single
            selection — see startChooseFrom). */}
        {drawMode ? (
          <DrawLineBar
            pointCount={drawPoints.length}
            blocked={drawBlocked}
            saving={drawSaving}
            onUndo={undoDrawPoint}
            onFinish={finishLine}
            onExit={exitDrawMode}
          />
        ) : packMode && packContainer ? (
          <PackPickerPanel
            containerText={packContainer.text}
            picks={packPicks}
            error={packError}
            onRemove={(id) => dispatchMode({ type: "packToggle", nodeId: id })}
            onConfirm={confirmPackSelection}
            onCancel={exitPackMode}
          />
        ) : chooseMode || multiSelectIds.size > 0 ? (
          <SelectionBar
            count={multiSelectIds.size}
            chooseMode={chooseMode}
            onLink={linkSelection}
            onNumber={() => numberSelection(false)}
            onDisplay={setDisplayForChosen}
            onClearNumbers={() => numberSelection(true)}
            onCopy={copySelection}
            onCopyText={copySelectionAsText}
            onGroupCircle={groupSelectionIntoCircle}
            onDelete={deleteSelection}
            onDone={exitChooseMode}
          />
        ) : (
          selectedNode &&
          user && (
            <>
              {/* No dimming backdrop behind this: the canvas's own onClick
                  (see canvasRef below) already deselects on a tap that
                  reaches empty canvas directly, so a backdrop's only real job
                  left would be dimming — not worth its cost. Sitting at z-30,
                  between the canvas content (z-31+) and the panel itself
                  (z-40), it would be the thing every quick-add ghost, node,
                  and the pending-create input has to specifically out-rank
                  just to stay tappable while a node is selected (see their
                  own z-index comments) — a whole layering workaround for
                  what would be mostly just visual dimming. */}
              <NodePanel
                node={selectedNode}
                nodes={nodes}
                edges={edges}
                currentUserId={user._id}
                discussionMode={isDiscussionMode}
                isMapOwner={isOwner}
                onApplyTemplate={(kind) => applyTemplate(kind, selectedNode)}
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
                onAttacked={(updatedNode, weaponNode, _weapon, healedParent, _blocked, protector) => {
                  upsertNode(updatedNode);
                  upsertNode(weaponNode);
                  // Set only on a landed retaliation — see attackAbl.ts's
                  // own healedParent doc comment.
                  if (healedParent) upsertNode(healedParent);
                  // Set only when blocked — the protector's own updated
                  // blockedDamage (see attackAbl.ts's own comment).
                  if (protector) upsertNode(protector);
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
                onStartChoose={() => startChooseFrom(selectedNode.nodeId)}
                onEdit={() => startInlineEdit(selectedNode)}
                onProtected={(protectionNode, healedNode) => {
                  upsertNode(protectionNode);
                  upsertNode(healedNode);
                }}
                onStartPack={() => startPackFrom(selectedNode.nodeId)}
                onUnpacked={(unpacked) => upsertNode(unpacked)}
                isClusterParent={circleRootSentimentByNode.has(selectedNode.nodeId)}
                onExtractText={() => extractClusterText(selectedNode.nodeId)}
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
            // Starts on the anchor itself; the footprint check moves it just
            // clear of it (and anything else it would cover), so the new
            // child appears right beside its parent.
            const pos = avoidOverlap(
              posFor(anchor),
              footprintObstacles(obstaclePoints()),
              viewportBounds(),
              zoneAngleGuard(NEW_NODE_ID, anchor.nodeId, visibleNodes, positions),
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
          onChoose={() => {
            const anchor = contextMenu.node;
            setContextMenu(null);
            startChooseFrom(anchor.nodeId);
          }}
          onAttack={() => setContextMenu(null)}
        />
      )}

      {canvasContextMenu && (
        <CanvasContextMenu
          x={canvasContextMenu.screenX}
          y={canvasContextMenu.screenY}
          onClose={() => setCanvasContextMenu(null)}
          pasteCount={nodeClipboardSize()}
          onPasteHere={() => {
            const at = { x: canvasContextMenu.canvasX, y: canvasContextMenu.canvasY };
            setCanvasContextMenu(null);
            pasteClipboard(at);
          }}
          onPick={(type) => {
            // Where the user right-clicked — nudged only if it would cover
            // another node (see footprintObstacles), not pushed away from it.
            const pos = avoidOverlap(
              { x: canvasContextMenu.canvasX, y: canvasContextMenu.canvasY },
              footprintObstacles(obstaclePoints()),
              viewportBounds(),
            );
            setCanvasContextMenu(null);
            setInlineEditId(null);
            setPendingCreate({ x: pos.x, y: pos.y, type, parentId: null });
          }}
        />
      )}

      <MapLegend />

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

      {showExportText && map && (
        <ExportTextModal
          mapName={map.name}
          nodes={nodes}
          positions={positions}
          onClose={() => setShowExportText(false)}
        />
      )}

      {extractClusterRootId &&
        (() => {
          const rootNode = nodes.find((n) => n.nodeId === extractClusterRootId);
          if (!rootNode) return null;
          // Reuses ExportTextModal/buildTreeExport as-is — handing it just
          // this cluster's own subtree (see collectClusterSubtree) instead
          // of every node on the map makes it build the exact same
          // section-per-parent document, just scoped to this one branch.
          // mapName doubles as the modal's own title label here — there's
          // no separate "scope name" prop, and the root's own text reads
          // fine in that slot ("Export text — "<root text> cluster"").
          return (
            <ExportTextModal
              mapName={`${rootNode.text} cluster`}
              nodes={collectClusterSubtree(extractClusterRootId)}
              positions={positions}
              onClose={() => setExtractClusterRootId(null)}
            />
          );
        })()}
    </div>
  );
}
