import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import * as mapsApi from "../api/maps";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import { ApiRequestError } from "../api/client";
import { getSocket, joinMap, leaveMap } from "../api/socket";
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
import { AddMenu } from "../map/AddMenu";
import { SelectionMenu } from "../map/SelectionMenu";
import { MiniMap } from "../map/MiniMap";
import { WeaponMark } from "../map/WeaponMark";
import { OutcomeBadge, ringKindFor } from "../map/OutcomeBadge";
import type { OutcomeType } from "../map/OutcomeBadge";
import { InviteMemberModal } from "../components/InviteMemberModal";
import { ExportTextModal } from "../components/ExportTextModal";
import { Modal } from "../components/Modal";
import { ThemeToggle } from "../components/ThemeToggle";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { idOf, nodeRefId, sentimentOf, ZONE_COLORS } from "../utils/nodeType";
import type { Sentiment } from "../utils/nodeType";
import {
  CANVAS_W,
  CANVAS_H,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  CIRCLE_DROP_RADIUS,
  FULL_CANVAS_BOUNDS,
  panelReserveFrac,
  nodeClipboard,
  setNodeClipboard,
  hashOffset,
  computeLinkedNeighborIds,
  getNodeMinDist,
  isMobileViewport as computeIsMobileViewport,
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
import type { Obstacle, ViewportBounds } from "../utils/canvasLayout";
import { NodeTypeIcon } from "../map/NodeTypeIcon";
import { NODE_TYPES } from "../types";
import type { AttackIndicator, EdgeDoc, MapDoc, NodeDoc, NodeType, SelectedCircle } from "../types";

// A Problem-type node's own child counts as "addressing" it (see
// unsolvedProblemIds below) only if it's one of these — a plain Problem or
// Fail child piled on top doesn't count as a proposal.
const ADDRESSES_PROBLEM_TYPES = new Set<NodeType>(["Success", "Option", "Solution"]);

// Stand-in id for a node that doesn't exist yet, when checking where it may go
// (see zoneAngleGuard).
const NEW_NODE_ID = "__new__";

// The dead zone past each edge of the canvas, as a fraction of the viewport:
// just enough to scroll an edge node in far enough for its quick-add ghost
// ring to fit, and no more.
const SCROLL_MARGIN_FRAC = 0.3;

export function MapPage() {
  const { mapId } = useParams<{ mapId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();

  const [map, setMap] = useState<MapDoc | null>(null);
  const [nodes, setNodes] = useState<NodeDoc[]>([]);
  const [edges, setEdges] = useState<EdgeDoc[]>([]);
  const [indicators, setIndicators] = useState<AttackIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Off by default: a bare tap/click on a node only ever selects it while
  // this is false — onNodePointerDown's own single-node drag setup is
  // gated behind it (see its own comment). Root cause this fixes: dragging
  // used to arm from the very first pointerdown on any node, so lightly
  // grazing one while trying to tap it (a phone's own touch imprecision,
  // mainly) read as "drag this node," relocating or even re-parenting it
  // by accident. Turning it on is a deliberate, explicit act (the
  // toolbar's own Move toggle) instead of the app's default stance.
  // Doesn't touch double-click-to-edit (startInlineEdit) or an
  // already-multi-selected group's own drag — both stay available
  // regardless, since neither one is the "accidental" case this addresses.
  const [moveMode, setMoveMode] = useState(false);
  // Choose mode: a tap on one of your own nodes adds it to / drops it from the
  // group selection (multiSelectIds — the same one shift+click and the marquee
  // build), instead of opening that node's panel. The group bar then offers
  // what to do with the chosen nodes: link, copy or delete them.
  const [chooseMode, setChooseMode] = useState(false);
  // The chosen nodes, in the order they were chosen, waiting on the sentiment
  // modal to finish linking them — 2 nodes finish as a single edge (a line);
  // 3+ finish as a closed loop (every consecutive pair plus one closing the
  // last node back to the first), which is what the cycle detector below then
  // colors as a figure.
  const [pendingLink, setPendingLink] = useState<NodeDoc[] | null>(null);
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
  const [showNodeTypesLegend, setShowNodeTypesLegend] = useState(false);
  const [showExportText, setShowExportText] = useState(false);
  // Set to a circle-parent's own rootId while its cluster-scoped "Extract
  // text" modal (extractClusterText/collectClusterSubtree) is open — null
  // otherwise. A separate flag from showExportText since the two scopes
  // (whole map vs. one cluster) never overlap and need different node
  // lists/titles passed into the same ExportTextModal.
  const [extractClusterRootId, setExtractClusterRootId] = useState<string | null>(null);
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
  // centerOnNode starts a pan, true once it's actually landed. Without
  // this, choosing a node fanned its ghosts/neighbors out immediately,
  // which — while the camera was still smoothly panning to center that
  // node — read as the whole ring sliding across the screen mid-pan rather
  // than fanning out around a node that's already settled in the middle.
  // Starts true: nothing's panning before the first selection ever happens.
  const [selectionSettled, setSelectionSettled] = useState(true);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True from the moment centerOnNode kicks off a pan until its own
  // scroll-position poll (see centerOnNode) notices the camera has
  // actually stopped moving. Guards against a *stale* poll (one left over
  // from a pan nobody's waiting on any more, e.g. it got superseded by
  // picking a different node) flipping selectionSettled back on when
  // nothing asked it to.
  const panInFlightRef = useRef(false);
  // The exact scroll position centerOnNode's most recent pan is (or was)
  // headed for — set the instant that pan is kicked off, not once it
  // lands. Waiting for a real device to actually *finish* an animated
  // smooth-scroll turned out to be the wrong thing to build correctness
  // on at all: whether that's signaled by `scrollend` or by polling
  // scrollLeft/scrollTop until they stop moving (both tried here), it's
  // still at the mercy of whatever that specific browser/device actually
  // does with the animation, and evidently some real phones either never
  // settle where expected or settle too late — ghosts kept rendering
  // against the wrong viewport regardless of which completion signal this
  // used. This sidesteps the whole question: settledViewportBounds()
  // below computes the ghost ring's/radial ring's safe zone from *this*
  // known destination instead of the live (possibly still-animating, or
  // on some devices seemingly never-finishing) DOM scroll position, so
  // their geometry is correct independent of whether the pan visually
  // catches up in any particular amount of time. selectionSettled still
  // gates *when* they're allowed to appear at all (so they don't pop in
  // while the camera is still visibly moving) — just no longer where they
  // end up once they do.
  const lastPanTargetRef = useRef<{ left: number; top: number } | null>(null);
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

  // centerOnNode's own settle-detection (see its doc comment) polls via
  // this instead of a fixed guessed duration — the id of the in-flight
  // requestAnimationFrame loop, so a newer pan (picking a different node
  // before the previous one even finished) can cancel the stale one
  // instead of two polls racing to declare "settled" for the wrong node.
  const settlePollRef = useRef<number | null>(null);

  // Keeps lastPanTargetRef from going stale if the user manually pans the
  // canvas (drag/pinch/wheel) after selecting a node but before deselecting
  // it — without this, quick-add ghosts/the radial ring would keep clamping
  // into whatever rectangle centerOnNode last aimed for, ignoring wherever
  // the view has since actually moved to. Guarded on `!panInFlightRef.current`
  // so this doesn't fight the *programmatic* scroll events centerOnNode's
  // own animation fires while a pan is genuinely still in flight — those
  // are intermediate positions, not a real destination, and overwriting
  // the target with one would reintroduce exactly the mid-pan race this
  // whole ref exists to avoid. A manual scroll can only ever happen once
  // nothing is animating, so this check alone is enough to tell them apart.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function onScroll() {
      if (panInFlightRef.current) return;
      lastPanTargetRef.current = { left: wrap!.scrollLeft, top: wrap!.scrollTop };
    }
    wrap.addEventListener("scroll", onScroll);
    return () => wrap.removeEventListener("scroll", onScroll);
  }, []);

  // How far (in canvas units) the *real* 0..CANVAS_W/CANVAS_H content sits
  // inset from every edge of the actual scrollable area — canvasRef itself
  // is rendered CANVAS_W+hScrollMargin*2 wide (CANVAS_H+vScrollMargin*2
  // tall), with the real content positioned at (hScrollMargin,
  // vScrollMargin) inside it (see its own JSX below). Without this, wrap
  // can never scroll any node closer to center than "the canvas's own edge
  // is at the edge of the viewport" — fine for a node in the middle of the
  // map, but one sitting at/near the real 0/CANVAS_W/CANVAS_H edge has
  // nowhere left to scroll to: centerOnNode's target gets clamped back to
  // 0 or maxLeft/maxTop, landing the node pinned near the edge of the
  // screen instead of centered — and, worse, outside the safe zone
  // QuickAddGhosts/the radial neighbor ring clamp themselves into (see
  // their own doc comments), so their ring visibly detached from the node
  // instead of surrounding it. This margin exists on all four sides so a
  // node near *any* edge — not just the bottom, which used to be the only
  // side this was ever added for — can still be scrolled into that safe
  // zone. SCROLL_MARGIN_FRAC (30%) of a clientWidth/clientHeight (divided
  // back out of screen pixels into canvas units, same *zoom reasoning every
  // other screen<->canvas conversion here uses): enough room for an edge
  // node's ghost ring, without being able to center it dead-on — anything
  // more is just empty blind zone to scroll through. It used to be a full
  // viewport's worth, then half, which still left a lot of nothing past
  // every border; the
  // margin itself is drawn dimmed and hatched (see the padded wrapper's own
  // JSX) so it reads as "outside the map", with the real canvas framed as
  // the active space.
  // Recomputed on resize (ResizeObserver, same pattern MiniMap's own
  // viewport tracking already uses) and whenever zoom changes, since both
  // change how many canvas units one screen pixel is worth.
  const [hScrollMargin, setHScrollMargin] = useState(0);
  const [vScrollMargin, setVScrollMargin] = useState(0);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function update() {
      setHScrollMargin(Math.ceil((wrap!.clientWidth / zoom) * SCROLL_MARGIN_FRAC));
      setVScrollMargin(Math.ceil((wrap!.clientHeight / zoom) * SCROLL_MARGIN_FRAC));
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
      // Backend's listNodes deliberately omits each node's own `text` (see
      // getNodesByMapDao) — comes back `undefined` over the wire despite
      // NodeDoc's own `text: string`. Normalized to "" right here, once, so
      // every other read of node.text in this file can keep trusting that
      // type instead of null-checking it everywhere; "" doubles as the
      // "text not loaded yet" sentinel ensureNodeText below checks for,
      // which is safe precisely because a real node's text is never
      // actually empty (backend validation requires non-blank text).
      setNodes(nodeList.map((n) => ({ ...n, text: n.text ?? "" })));
      setEdges(edgeList);
      refreshInsights(mapId);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to load map");
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
      protector,
    }: {
      node: NodeDoc;
      weaponNode: NodeDoc;
      // Set only when this attack was a retaliation that landed — see
      // attackAbl.ts's own healedParent doc comment. null on an ordinary
      // attack, so every other map member's canvas picks up the heal too,
      // not just the retaliator's own tab.
      healedParent: NodeDoc | null;
      // Set only when this attack was blocked — the protection node that
      // blocked it, with its own blockedDamage bumped (see attackAbl.ts's
      // own comment). Every other tab needs this too, not just the
      // attacker's own, so NodePanel's own "blocked N damage so far" line
      // and the weapon-mark loop's own "redirect arrows to the shield"
      // lookup both stay in sync everywhere.
      protector: NodeDoc | null;
    }) => {
      upsertNode(node);
      upsertNode(weaponNode);
      if (healedParent) upsertNode(healedParent);
      if (protector) upsertNode(protector);
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
    const onNodeProtected = ({ protectionNode, healedNode }: { protectionNode: NodeDoc; healedNode: NodeDoc }) => {
      upsertNode(protectionNode);
      upsertNode(healedNode);
    };
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
    // Someone (the owner — see updateMapAbl's own ownerId check) flipped a
    // map-wide setting, most commonly the Discussion/Personal mode toggle
    // (see isPersonalMode/toggleMapMode below) — merge just the changed
    // fields in rather than replacing `map` outright, so this can't
    // clobber a selectedCircle/color update this client applied locally in
    // between this broadcast being sent and received.
    const onMapUpdated = ({ map: updated }: { map: MapDoc }) =>
      setMap((prev) => (prev ? { ...prev, ...updated } : updated));

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
    socket.on("map:updated", onMapUpdated);

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
      socket.off("map:updated", onMapUpdated);
      socket.off("node:packed", onNodePacked);
      socket.off("node:unpacked", onNodeUnpacked);
      leaveMap(mapId);
    };
  }, [mapId, loading, upsertNode, upsertEdge, applyCircleSelection]);

  const selectedNode = nodes.find((n) => n.nodeId === selectedId) ?? null;
  // Any node "chosen" on the map right now — a multi-select takes priority
  // (it's the more specific state), falling back to the plain single
  // selection. Null when nothing at all is chosen, the one case edges/
  // branch-arrows stay fully lit. Feeds the same dimming both the branch
  // arrows and plain Edges apply below — previously that only kicked in
  // for a multi-select, leaving every edge full-opacity while a single
  // node was selected even though that's already the map's "I'm focused on
  // this one" state everywhere else (NodeCard's own outline/health/wings).
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
      const creatorId = idOf(n.userId);
      let base = refPos;
      let closestDist = Infinity;
      for (const own of regular) {
        if (own.nodeId === n.nodeId || idOf(own.userId) !== creatorId) continue;
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
        // A sunflower (golden-angle) spiral for nodes with no stored x/y
        // (everything a template map seeds): radius grows with sqrt(i),
        // which keeps every node's nearest neighbor ~1.9x `spacing` away no
        // matter how many there are. Spacing is derived from
        // getNodeMinDist() so the base layout gets the room placement
        // elsewhere already enforces.
        const angle = i * 137.508 * (Math.PI / 180);
        const radius = (getNodeMinDist() / 1.9) * Math.sqrt(i + 0.5);
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
      const protectedId = nodeRefId(n.protectsNodeId);
      const protectedNode = protectedId ? nodes.find((t) => t.nodeId === protectedId) : undefined;
      const protectedPos = (protectedNode && map.get(protectedNode.nodeId)) || { x: CANVAS_W / 2, y: CANVAS_H / 2 };

      // Whoever most recently attacked the node this shield defends (same
      // "nodes come back in creation order, last match is most recent"
      // convention handleNodeClick's own weapon-replay already relies on) —
      // when one exists, the shield belongs literally between the two:
      // positioned at their midpoint, reading as "standing in the way"
      // rather than floating near its own creator's other nodes (also what
      // the weapon-mark loop's own arrow-redirect lookup uses to find where
      // to stop). No active attacker at all: this is just an ordinary
      // companion node (placeCompanionNode, same as a weapon node with
      // nothing target-specific to react to) — a shield badge on the node
      // itself (NodeCard) is all that marks it as one.
      const attackers = weapons.filter((w) => nodeRefId(w.targetNodeId) === protectedId);
      const latestAttackerId = attackers[attackers.length - 1]?.nodeId;
      const attackerPos = latestAttackerId ? map.get(latestAttackerId) : undefined;

      if (attackerPos) {
        // Deliberately *not* run through avoidOverlap here, unlike every
        // other placement in this memo — a weapon node is anchored only
        // getNodeMinDist() away from its own target (close enough that the
        // bow reads as "right next to the attacker"), which puts their own
        // midpoint well inside *both* nodes' minDist zones every time.
        // avoidOverlap's own job is exactly to push out of a zone like
        // that, which here would walk the shield away from the midpoint by
        // more than the attacker-target distance itself — the opposite of
        // "on the arrows path." A literal on-the-line position, slightly
        // overlapping either endpoint's own footprint, is the actual ask.
        map.set(n.nodeId, { x: (attackerPos.x + protectedPos.x) / 2, y: (attackerPos.y + protectedPos.y) / 2 });
      } else {
        map.set(n.nodeId, placeCompanionNode(n, protectedPos));
      }
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
  // Shrunk on a phone-width viewport, same isMobile threshold
  // getNodeMinDist() already uses — the fixed 190px radius left several of
  // a 10-neighbor ring's members past the horizontal edges of a ~375px-wide
  // screen (center ± 190 overshoots a 375px width on either side once the
  // node's own ~37px half-width is added in), physically unreachable to
  // tap. This is exactly what made picking pack-eligible neighbors "not
  // work" on mobile — the picker opened, but some of the very nodes it
  // needed you to tap were off-screen. 110px keeps a full-diameter ring
  // (220px) comfortably inside even a narrow phone width.
  // Open a map looking at its nodes. The scroll area starts at its own
  // top-left corner — the empty blind-zone margin, since the canvas is far
  // bigger than any screen and nodes cluster near its middle — so without
  // this a fresh load shows nothing and the map has to be hunted for. Once
  // per map, the first time both the nodes and the scroll margins exist.
  const didInitialFitRef = useRef<string | null>(null);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (loading || !wrap || !mapId || didInitialFitRef.current === mapId) return;
    if (hScrollMargin === 0 || vScrollMargin === 0 || positions.size === 0) return;
    didInitialFitRef.current = mapId;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of positions.values()) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    wrap.scrollTo({
      left: (cx + hScrollMargin) * zoom - wrap.clientWidth / 2,
      top: (cy + vScrollMargin) * zoom - wrap.clientHeight / 2,
    });
    // zoom is read once, at fit time — a later zoom must not re-center.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, mapId, hScrollMargin, vScrollMargin, positions]);

  const isMobileViewport = computeIsMobileViewport();
  const RADIAL_NEIGHBOR_RADIUS = isMobileViewport ? 110 : 190;
  const RADIAL_MAX_NEIGHBORS = 10;
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
    // Same fix as QuickAddGhosts' own ring-centering (see its doc comment)
    // — this ring used to have no bounds awareness at all, just `center +
    // radius`, trusting centerOnNode to have already put `center` in the
    // middle of the screen. A node close enough to the actual edge of the
    // whole 2400x1600 canvas (nothing left to scroll into) never gets
    // truly centered, and on a narrow phone viewport that's routine, not
    // rare — so members on the far side of the ring rendered clear off the
    // visible screen, unreachable to tap (the exact "picking pack-eligible
    // neighbors doesn't work" symptom this radius was already shrunk for
    // once before). Nudging the ring's own center into a safe zone inside
    // the current viewport keeps the whole ring on-screen and evenly
    // spaced regardless of where the selected node itself landed.
    const bounds = settledViewportBounds();
    const halfSpan = RADIAL_NEIGHBOR_RADIUS + 40;
    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;
    // See QuickAddGhosts' own matching doc comment — same fallback fix.
    // panelReserveFrac's 1/2 mobile reserve leaves less vertical room than
    // halfSpan*2 for essentially every mobile selection, so this fallback
    // isn't a rare "tiny window" case — falling back to bounds' own plain
    // midpoint instead of anchoring on `center` used to strand the ring
    // floating mid-screen, detached from a node sitting pinned near a real
    // canvas edge (the one case centerOnNode can't actually center it).
    // Anchoring on `center` here too (still clamped into `bounds`, just
    // without the halfSpan inset) keeps neighbors visibly attached to the
    // selected node even when the full safe-zone clamp doesn't fit.
    const ringCenter =
      spanX >= halfSpan * 2 && spanY >= halfSpan * 2
        ? {
            x: Math.min(bounds.maxX - halfSpan, Math.max(bounds.minX + halfSpan, center.x)),
            y: Math.min(bounds.maxY - halfSpan, Math.max(bounds.minY + halfSpan, center.y)),
          }
        : {
            x: Math.min(bounds.maxX, Math.max(bounds.minX, center.x)),
            y: Math.min(bounds.maxY, Math.max(bounds.minY, center.y)),
          };
    const map = new Map<string, { x: number; y: number }>();
    neighbors.forEach((id, i) => {
      const angle = (i / neighbors.length) * Math.PI * 2 - Math.PI / 2;
      // Final per-point safety clamp — see QuickAddGhosts' own matching
      // comment. No-op whenever the full ring already fit inside the
      // halfSpan-inset safe zone; only trims the fallback branch's
      // outermost members back into `bounds` so a neighbor can't scroll
      // off-screen entirely just because RADIAL_NEIGHBOR_RADIUS didn't fit.
      map.set(id, {
        x: Math.min(bounds.maxX, Math.max(bounds.minX, ringCenter.x + RADIAL_NEIGHBOR_RADIUS * Math.cos(angle))),
        y: Math.min(bounds.maxY, Math.max(bounds.minY, ringCenter.y + RADIAL_NEIGHBOR_RADIUS * Math.sin(angle))),
      });
    });
    return map;
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
  // ones — a node packed out of sight still has an entry in `positions`, and
  // used to push new placements away from a spot that looked empty.
  function obstaclePoints(exclude?: Set<string>) {
    return visibleNodes
      .filter((n) => !exclude?.has(n.nodeId))
      .map((n) => positions.get(n.nodeId) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 });
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
    // - hScrollMargin/vScrollMargin: wrap's own scroll metrics are screen
    // pixels within the *padded* canvasRef (see its own doc comment) — the
    // real 0..CANVAS_W/CANVAS_H content sits inset by that margin inside
    // it, so converting back to a real canvas coordinate has to subtract
    // it back out.
    return {
      x: (wrap.scrollLeft + (clientX - rect.left)) / zoom - hScrollMargin,
      y: (wrap.scrollTop + (clientY - rect.top)) / zoom - vScrollMargin,
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
    // Same -hScrollMargin/-vScrollMargin conversion as screenToCanvas above.
    const canvasX = (wrap.scrollLeft + (clientX - rect.left)) / zoom - hScrollMargin;
    const canvasY = (wrap.scrollTop + (clientY - rect.top)) / zoom - vScrollMargin;
    setZoom(nextZoom);
    // Deferred a frame: scrollLeft/scrollTop set synchronously here would
    // still be measured against the *old* scaled scrollWidth/scrollHeight,
    // since canvasRef hasn't actually re-rendered at its new scale yet —
    // the browser would clamp against stale bounds and this would land in
    // the wrong place.
    requestAnimationFrame(() => {
      // + margin: back from a real canvas coordinate to padded-canvasRef
      // screen pixels, same convention centerOnNode's own targetLeft/Top
      // use.
      wrap.scrollLeft = (canvasX + hScrollMargin) * nextZoom - (clientX - rect.left);
      wrap.scrollTop = (canvasY + vScrollMargin) * nextZoom - (clientY - rect.top);
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
    // NodePanel/PackPickerPanel's bottom sheet (see panelReserveFrac's own
    // doc comment) physically covers the bottom third (half on mobile) of
    // the screen while it's open — shrink the placeable
    // rectangle by the same amount so a freshly-created node (or a
    // quick-add ghost, which reads this via MapPage's own bounds prop)
    // never lands underneath it. Skipped for the group-selection footer
    // (multiSelectIds), which is a slim bar, not a tall sheet.
    const sheetOpen = chooseMode || packMode || (!!selectedNode && multiSelectIds.size === 0);
    const reserve = sheetOpen ? wrap.clientHeight * panelReserveFrac(isMobileViewport) : 0;
    // - hScrollMargin/-vScrollMargin: same padded-canvasRef -> real-canvas
    // conversion screenToCanvas uses.
    return {
      minX: wrap.scrollLeft / zoom + pad - hScrollMargin,
      minY: wrap.scrollTop / zoom + pad - vScrollMargin,
      maxX: (wrap.scrollLeft + wrap.clientWidth) / zoom - pad - hScrollMargin,
      maxY: (wrap.scrollTop + wrap.clientHeight - reserve) / zoom - pad - vScrollMargin,
    };
  }

  // Same as viewportBounds(), except it substitutes centerOnNode's own
  // known destination (lastPanTargetRef — see its own doc comment) for
  // wrap.scrollLeft/scrollTop wherever a pan is/was heading somewhere in
  // particular. Quick-add ghosts and the radial neighbor ring both read
  // this instead of plain viewportBounds() specifically because they're
  // the two things that have to line up with *where the selected node
  // ends up*, not with whatever the scroll container happens to read at
  // the moment they're computed — and that's exactly the value a real
  // device's own animation timing can't be trusted to have caught up to
  // yet (or, evidently, ever quite catch up to on some phones). Every
  // other caller of viewportBounds() (placing a brand new node, clamping a
  // drag, etc.) is unrelated to any in-flight pan and should keep reading
  // the real, current scroll position, so this stays a separate function
  // rather than changing viewportBounds() itself.
  function settledViewportBounds(): ViewportBounds {
    const wrap = wrapRef.current;
    if (!wrap) return FULL_CANVAS_BOUNDS;
    const target = lastPanTargetRef.current;
    if (!target) return viewportBounds();
    const pad = 70;
    const sheetOpen = chooseMode || packMode || (!!selectedNode && multiSelectIds.size === 0);
    const reserve = sheetOpen ? wrap.clientHeight * panelReserveFrac(isMobileViewport) : 0;
    // - hScrollMargin/-vScrollMargin: same padded-canvasRef -> real-canvas
    // conversion screenToCanvas uses.
    return {
      minX: target.left / zoom + pad - hScrollMargin,
      minY: target.top / zoom + pad - vScrollMargin,
      maxX: (target.left + wrap.clientWidth) / zoom - pad - hScrollMargin,
      maxY: (target.top + wrap.clientHeight - reserve) / zoom - pad - vScrollMargin,
    };
  }

  // Pans the canvas so the given node's position lands in the middle of the
  // current viewport, unconditionally — the chosen node (whatever was just
  // clicked/selected) always ends up centered, not just nudged into view.
  // Selecting a node always brings up NodePanel too, and that panel is now a
  // bottom sheet *overlaying* the canvas at every screen size (see its own
  // PANEL_CLASS) rather than a sidebar the canvas shrinks to make room for —
  // so wrap.clientHeight's own full height is no longer what's actually
  // visible above it. panelReserveFrac() (see its own doc comment) is a
  // deliberate approximation (there's no reliable, synchronously-correct
  // measurement of the panel's real height here — it hasn't mounted yet for
  // a first selection, and its content, and so its height, varies by node
  // and tab anyway) — but it's the *same* fraction viewportBounds()
  // reserves and PANEL_CLASS caps the sheet at, so the chosen node (and the
  // quick-add ghosts fanned around it, clamped to that same
  // viewportBounds) land in the space actually left on screen rather than
  // drifting out of sync with how tall the sheet is actually allowed to
  // grow.
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
    const visibleH = Math.max(150, wrap.clientHeight * (1 - panelReserveFrac(isMobileViewport)));
    // *zoom throughout: pos.x/y are canvas-space, but scrollTo/scrollWidth
    // deal in screen pixels of the rendered (scaled) canvas — same
    // conversion as screenToCanvas/zoomAt above, just the other direction.
    // (CANVAS_W + hScrollMargin*2)/(CANVAS_H + vScrollMargin*2): canvasRef's
    // own real rendered size now (see its own doc comment/JSX) — the margin
    // on every side is what lets this clamp actually reach 0 or maxLeft/
    // maxTop for a node sitting right at the real 0/CANVAS_W/CANVAS_H edge
    // instead of leaving it pinned there with nowhere left to scroll to.
    const maxLeft = Math.max(0, (CANVAS_W + hScrollMargin * 2) * zoom - wrap.clientWidth);
    const maxTop = Math.max(0, (CANVAS_H + vScrollMargin * 2) * zoom - wrap.clientHeight);
    // + hScrollMargin/+ vScrollMargin: pos.x/y are real canvas coordinates;
    // scrollTo deals in screen pixels within the *padded* canvasRef (see
    // screenToCanvas's own doc comment) — same conversion, just the other
    // direction.
    const targetLeft = Math.min(maxLeft, Math.max(0, (pos.x + hScrollMargin) * zoom - wrap.clientWidth / 2));
    const targetTop = Math.min(maxTop, Math.max(0, (pos.y + vScrollMargin) * zoom - visibleH / 2));
    // See its own doc comment — recorded regardless of which branch below
    // actually runs, since settledViewportBounds() should always reflect
    // the most recent centerOnNode call, not just the ones that had to
    // scroll somewhere new.
    lastPanTargetRef.current = { left: targetLeft, top: targetTop };

    // Cancel whatever a previous call left running — a newer pan (picking
    // a different node before the last one even settled) fully supersedes
    // it, and letting the old poll/timeout keep going could flip
    // selectionSettled back on for the wrong node's ghosts.
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    if (settlePollRef.current) cancelAnimationFrame(settlePollRef.current);

    // Already there (the just-selected node was already sitting dead
    // center, or re-clicking the same one) — scrollTo wouldn't actually
    // move anything, so there's no pan to wait on at all.
    if (Math.hypot(targetLeft - wrap.scrollLeft, targetTop - wrap.scrollTop) < 1) {
      panInFlightRef.current = false;
      setSelectionSettled(true);
      return;
    }

    wrap.scrollTo({ left: targetLeft, top: targetTop, behavior: "smooth" });
    setSelectionSettled(false);
    panInFlightRef.current = true;

    // See selectionSettled's own doc comment — quick-add ghosts/the radial
    // ring stay hidden until this pan actually lands. Used to guess *when*
    // that was with one fixed duration (350ms, then a scrollend listener
    // with a 900ms fallback) — both still amount to a guess: a `scrollend`
    // that never fires on some real browser/device, or a real pan that
    // (a big canvas, a slower phone actually rendering the animation
    // rather than this environment's own sandboxed panes, which don't
    // always tick it forward at all) genuinely takes longer than any fixed
    // number picked here, leaves ghosts fanning out against whatever the
    // viewport still was at that guessed moment — not where the node
    // actually ends up — which is exactly what read as "ghosts floating in
    // a curvy row, disconnected from the node" on a real phone. Polling
    // the actual scroll position every frame until it stops moving is
    // correct regardless of distance, device speed, or scrollend support:
    // however long the real pan takes, this notices the moment it's
    // actually done. 3 consecutive unchanged frames (not just one, which
    // could land between two ticks that happened to round to the same
    // pixel) before declaring it settled; an outer 3s timeout is a last-
    // resort safety net for the pathological case where scrolling somehow
    // never stabilizes at all, so ghosts can never end up permanently
    // stuck hidden.
    let lastLeft = wrap.scrollLeft;
    let lastTop = wrap.scrollTop;
    let stableFrames = 0;
    const finish = () => {
      panInFlightRef.current = false;
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
      if (settlePollRef.current) cancelAnimationFrame(settlePollRef.current);
      setSelectionSettled(true);
    };
    const poll = () => {
      if (!panInFlightRef.current) return; // superseded by a newer pan, or already finished
      const nowLeft = wrap.scrollLeft;
      const nowTop = wrap.scrollTop;
      if (Math.abs(nowLeft - lastLeft) < 0.5 && Math.abs(nowTop - lastTop) < 0.5) {
        stableFrames++;
      } else {
        stableFrames = 0;
        lastLeft = nowLeft;
        lastTop = nowTop;
      }
      if (stableFrames >= 3) {
        finish();
        return;
      }
      settlePollRef.current = requestAnimationFrame(poll);
    };
    settlePollRef.current = requestAnimationFrame(poll);
    settleTimeoutRef.current = setTimeout(finish, 3000);
  }

  // Pans to a fixed canvas point rather than any one node's own position —
  // used below to center a circle/cluster the moment it becomes the chosen
  // one, which has no single "the node" the way an ordinary selection does.
  // Same target-rectangle math centerOnNode uses, just without any of its
  // settle-detection/quick-add-ghost machinery: nothing here needs to know
  // the instant this pan actually lands, since a chosen cluster has no
  // ghosts fanning off it the way a selected node does.
  function centerOnPoint(x: number, y: number) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const visibleH = Math.max(150, wrap.clientHeight * (1 - panelReserveFrac(isMobileViewport)));
    const maxLeft = Math.max(0, (CANVAS_W + hScrollMargin * 2) * zoom - wrap.clientWidth);
    const maxTop = Math.max(0, (CANVAS_H + vScrollMargin * 2) * zoom - wrap.clientHeight);
    const targetLeft = Math.min(maxLeft, Math.max(0, (x + hScrollMargin) * zoom - wrap.clientWidth / 2));
    const targetTop = Math.min(maxTop, Math.max(0, (y + vScrollMargin) * zoom - visibleH / 2));
    wrap.scrollTo({ left: targetLeft, top: targetTop, behavior: "smooth" });
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

  // Filters packed-away members out of every canvas rendering loop. Packing
  // (packAbl.ts) still exists as a relationship regardless — a container's
  // own count badge, and its "Packed (N)" unpack list in NodePanel, both
  // still work off Node.packedIntoNodeId either way — but a packed member
  // itself is hidden from the canvas again (this filter briefly went away
  // per an earlier "no packed are hidden" ask; reinstated per a later,
  // final call reverting that). NodePanel still receives plain `nodes`
  // (not this), since it has to show a packed member in its container's own
  // unpack list even though the canvas itself no longer renders it.
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
    if (spotlightedNodeIds && spotlightedNodeIds.length > 0) ensureNodeText(spotlightedNodeIds);
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
      return { target, valid: false, reason: "Can't drop a node onto its own branch." };
    }
    return { target, valid: true };
  }

  function onNodePointerDown(node: NodeDoc, e: ReactPointerEvent) {
    if (chooseMode || packMode) return;
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
          setActionError(err instanceof ApiRequestError ? err.message : "Failed to move the selected nodes");
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
    // tap a node can no longer relocate — or even re-parent — it by
    // accident. node.locked takes the same path even with Move on — a
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
          setActionError(found.reason ?? "Can't join that circle.");
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
            setActionError(err instanceof ApiRequestError ? err.message : "Failed to join circle");
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
          setActionError("Can't pull it out — the remaining circle would get a corner under 30°.");
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
    return idOf(node.userId) === user?._id;
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
    if (chooseMode) {
      // Same toggle shift+click does, without the key — tapping an already
      // chosen node drops just that one.
      if (!isOwnNode(node)) {
        setActionError("You can only choose nodes you created.");
        return;
      }
      setActionError(null);
      setMultiSelectIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.nodeId)) next.delete(node.nodeId);
        else next.add(node.nodeId);
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
      setActionError(err instanceof ApiRequestError ? err.message : "Update failed");
    } finally {
      setInlineEditId(null);
    }
  }

  // Enters choose mode with `nodeId` already chosen — from a node's own
  // "Choose…" (its panel or right-click menu). Drops the single selection: the
  // group bar takes over the bottom sheet, and NodePanel can't share it.
  function startChooseFrom(nodeId: string) {
    setPackMode(false);
    setPackContainerId(null);
    setPackSelection(new Set());
    setSelectedId(null);
    setChooseMode(true);
    setMultiSelectIds(new Set([nodeId]));
  }

  // Leaves choose mode and drops the whole group selection — shared by the
  // group bar's own Deselect and every action that finishes with the chosen
  // nodes, so they can't drift apart on what "done choosing" means.
  function exitChooseMode() {
    setChooseMode(false);
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
  // (packContainerId) instead of a growing list of choices. Exits choose mode
  // first if it was somehow active (the two share the same bottom-sheet slot —
  // see the JSX below — so only one can really be "active" at once).
  function startPackFrom(containerNodeId: string) {
    exitChooseMode();
    setPackMode(true);
    setPackContainerId(containerNodeId);
    setPackSelection(new Set());
    setPackError(null);
  }

  // Backs out of pack mode without packing anything — shared by the picker's
  // own ✕/Cancel and anything else abandoning a pick in progress.
  function exitPackMode() {
    setPackMode(false);
    setPackContainerId(null);
    setPackSelection(new Set());
    setPackError(null);
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
    if (chooseMode || packMode || e.button !== 0 || e.pointerType === "touch") return;
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
      const res = await nodesApi.deleteNode(node.nodeId);
      applyNodeDeleted(node.nodeId);
      // Deleting a protection node with banked damage releases the whole
      // total onto whatever it was defending — see Backend's deleteNodeDao.
      if (res.damagedProtectedNode) upsertNode(res.damagedProtectedNode);
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

  async function copySelection() {
    if (!mapId) return;
    const ids = multiSelectIds.size > 0 ? Array.from(multiSelectIds) : selectedId ? [selectedId] : [];
    if (ids.length === 0) return;
    const candidates = ids
      .map((id) => nodes.find((n) => n.nodeId === id))
      .filter((n): n is NodeDoc => !!n && !n.isWeapon);
    if (candidates.length === 0) return;
    // Awaited, not read straight off `n.text` — a marquee/long-press pick
    // never necessarily opened any of these nodes first, so their real text
    // may not have loaded yet (see ensureNodeText's own doc comment on why
    // its *return value*, not a re-read of `nodes`, is what's safe to use
    // right after awaiting it).
    const textById = await ensureNodeText(candidates.map((n) => n.nodeId));
    const copied = candidates.map((n) => {
      const pos = positions.get(n.nodeId) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 };
      return { text: textById[n.nodeId] ?? n.text, type: n.type, x: pos.x, y: pos.y };
    });
    if (copied.length > 0) setNodeClipboard({ sourceMapId: mapId, nodes: copied });
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
        return pa.y - pb.y || pa.x - pb.x;
      });
    if (picked.length === 0) return;
    // See copySelection's own comment above — same reason this reads the
    // returned map instead of `n.text` directly.
    const textById = await ensureNodeText(picked.map((n) => n.nodeId));
    const text = picked.map((n) => `${n.type}: ${textById[n.nodeId] ?? n.text}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setActionError("Copy failed — this browser blocked clipboard access.");
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
      const anchor = pickNonOverlappingPosition(obstaclePoints(), bigNodeObstacles(), viewportBounds());
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
            [...nodeObstacles(obstaclePoints()), ...bigNodeObstacles()],
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
    if (!confirm(`Delete ${ids.length} node${ids.length === 1 ? "" : "s"}?`)) return;
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
      const rootPos = pickNonOverlappingPosition(obstaclePoints(), bigNodeObstacles(), viewportBounds());
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
        {/* A demo session has nowhere else to go — see the toolbar's own
            matching omission below, and ProtectedRoute's own redirect,
            which would just bounce this link straight back here anyway. */}
        {!user?.isDemo && <Link to="/">&larr; {t.map.toolbar.back}</Link>}
      </div>
    );
  }

  const isOwner = map.ownerId === user?._id;
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
      setActionError(err instanceof ApiRequestError ? err.message : "Failed to change map mode");
    }
  }

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
              top-left, same as canvasRef's own transform used to. */}
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
              // one active space. The dot grid that used to sit on the
              // scroll container itself now lives on the canvas instead,
              // so it stops at the border rather than continuing under
              // the blind zone.
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
            onClick={() => {
              // See onCanvasPointerDown's own onUp comment — the trailing
              // native click a completed marquee drag leaves behind on this
              // same element would otherwise immediately clear the
              // selection that drag just computed.
              if (suppressNextClick.current) {
                suppressNextClick.current = false;
                return;
              }
              if (chooseMode || packMode) return;
              setSelectedId(null);
              setMultiSelectIds(new Set());
              releaseChosenCircleIfOutside();
            }}
            onPointerDown={onCanvasPointerDown}
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
                own majority sentiment (positive-majority halo-gold, negative-majority horns-red,
                a tied/all-"unknown" group neutral gray — see circleSentiment's own doc comment).
                Deepest layer on the canvas, under even the link figures below — every member
                stays a real, individually clickable node; this is purely a backdrop. Shape
                actually reflects the tree's own spread now instead of one fixed bounding circle
                either overlapping unrelated nodes or leaving a lot of empty space, and it visibly
                deforms live as members get dragged around — nodeGroups recomputes `outline` from
                current positions (including mid-drag) on every render, nothing here is a
                snapshot. Same "click to stabilize" control the old plain-circle backdrop had.
              */}
              {nodeGroups.map((g) => {
                const color = ZONE_COLORS[g.sentiment];
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
                Manual zones: a single node's own owner-chosen zone ring (node.manualZone —
                see NodePanel's Info tab), independent of the automatic parentId-group zones
                above — no 2+-children requirement, color picked outright rather than voted.
                Fixed-radius circle (there's no multi-member outline to trace, unlike the
                polygon zones) around just that one node's own position. Drawn alongside an
                automatic zone if a node happens to be in both at once — these are separate
                layers, not mutually exclusive.
              */}
              {visibleNodes
                .filter((n) => n.manualZone)
                .map((n) => {
                  const p = posFor(n);
                  const color = n.manualZone === "positive" ? ZONE_COLORS.positive : ZONE_COLORS.negative;
                  return (
                    <circle
                      key={`manual-zone-${n.nodeId}`}
                      cx={p.x}
                      cy={p.y}
                      r={55}
                      fill={color}
                      fillOpacity={0.14}
                      stroke={color}
                      strokeOpacity={0.5}
                      strokeWidth={2.5}
                    />
                  );
                })}
              {/*
                Circle-parent ring: a small automatic version of the manual zone circle just
                above, drawn around every circle root/parent (circleRootSentimentByNode — same
                nodes NodeCard's own crown badge marks), colored the same way its zone backdrop
                already is (majority pos/neg/neutral vote). Same fixed-radius-circle shape as a
                manual zone, just tighter (close around the node itself, not a wide zone) and
                never owner-chosen — this one exists for every circle root automatically,
                alongside the crown badge rather than instead of it.
              */}
              {visibleNodes
                .filter((n) => circleRootSentimentByNode.has(n.nodeId))
                .map((n) => {
                  const p = posFor(n);
                  const color = ZONE_COLORS[circleRootSentimentByNode.get(n.nodeId)!];
                  return (
                    <circle
                      key={`circle-parent-ring-${n.nodeId}`}
                      cx={p.x}
                      cy={p.y}
                      r={34}
                      fill={color}
                      fillOpacity={0.16}
                      stroke={color}
                      strokeOpacity={0.6}
                      strokeWidth={2}
                    />
                  );
                })}
              {/*
                Figures: any closed loop in the Link graph — colored fill as a backdrop, under
                everything else. A plain two-node link is a line and can never close, so it never
                shows up here; this is what "except line" means in practice, not a special case.
              */}
              {linkCycles.map((cycle) => {
                // visibleNodes, not nodes — a member folded into a pack
                // drops out of the shape entirely (same as the plain Edge
                // lines below), rather than a figure still tracing a vertex
                // at a node nobody can see any more.
                const pts = cycle
                  .map((id) => visibleNodes.find((n) => n.nodeId === id))
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
                halo-gold, negative-majority horns-red, neutral gray on a tie), same as the zone
                it's inside, and doubles
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
                const color = group ? ZONE_COLORS[group.sentiment] : "var(--accent)";
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
                const chosenDimmed =
                  !!chosenNodeIds && !chosenNodeIds.has(parentId) && !chosenNodeIds.has(node.nodeId);
                const dimmed = circleDimmed || chosenDimmed;
                // The flip side of chosenDimmed — this branch touches the
                // chosen node itself, not just "isn't dimmed" (which also
                // covers the plain default state, nothing chosen at all).
                // Boosted brighter than the normal baseline, not just left
                // alone, so the chosen node's own connections actually pop
                // against the dimmed rest instead of only avoiding the fade.
                const chosenHighlighted =
                  !!chosenNodeIds && (chosenNodeIds.has(parentId) || chosenNodeIds.has(node.nodeId));
                return (
                  <line
                    key={`branch-${node.nodeId}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={color}
                    strokeOpacity={dimmed ? 0.12 : chosenHighlighted ? (group ? 0.95 : 0.6) : group ? 0.65 : 0.35}
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
                // visibleNodes, not nodes — a packed-away endpoint hides
                // this edge along with it (same relationship as a branch
                // arrow into a packed node, which already goes through
                // visibleNodes below); unpacking either end brings the edge
                // right back since this re-resolves on every render.
                const fromNode = visibleNodes.find((n) => n.nodeId === fromId);
                const toNode = visibleNodes.find((n) => n.nodeId === toId);
                if (!fromNode || !toNode) return null;
                const a = posFor(fromNode);
                const b = posFor(toNode);
                const color =
                  edge.sentiment === "negative"
                    ? "var(--danger)"
                    : edge.sentiment === "positive"
                      ? "var(--success)"
                      : "var(--ink-soft)";
                // Same chosen-node dimming the branch arrows above apply —
                // an edge with neither end chosen (selected or
                // multi-selected) fades, so the selected node's own
                // connections read clearly against the rest.
                const dimmed = !!chosenNodeIds && !chosenNodeIds.has(fromId) && !chosenNodeIds.has(toId);
                // The flip side of `dimmed` — this edge touches the chosen
                // node itself. Boosted brighter than the plain default
                // (0.55, used when nothing at all is chosen), not just left
                // there, so the chosen node's own edges actually pop against
                // the dimmed rest instead of only avoiding the fade.
                const highlighted = !!chosenNodeIds && (chosenNodeIds.has(fromId) || chosenNodeIds.has(toId));
                // Full opacity against var(--danger)/var(--success)'s own
                // already-saturated colors read as glaring, especially with
                // several edges overlapping near a busy node — toned down
                // to 0.55 normally (dimmed keeps roughly the same ratio to
                // it, not just to the old 1); highlighted goes brighter
                // still, close to full.
                return (
                  <line
                    key={edge.edgeId}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={color}
                    strokeWidth={2}
                    strokeOpacity={dimmed ? 0.06 : highlighted ? 0.9 : 0.55}
                  />
                );
              })}
              {/* The chosen set stays lit while the sentiment modal is open. */}
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
                  // An active shield on the target intercepts the arrows —
                  // they fly to (and stop at) the shield's own position
                  // instead of reaching the target, reading as "blocked
                  // here," not "landed." Any one active protector is enough
                  // to redirect every one of the target's own attackers,
                  // same "just needs to exist" gate attackAbl.ts's own
                  // findActiveProtectorDao check already uses server-side.
                  const activeProtector = visibleNodes.find(
                    (n) => n.isProtection && !n.defeated && nodeRefId(n.protectsNodeId) === targetId,
                  );
                  const b = posFor(activeProtector ?? targetNode);
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
            positions={positions}
            groups={nodeGroups}
            canvasW={CANVAS_W}
            canvasH={CANVAS_H}
            zoom={zoom}
            hScrollMargin={hScrollMargin}
            vScrollMargin={vScrollMargin}
          />

          {/* The whole top toolbar collapses to this one compact floating
              cluster — Back + a single "+" menu (Invite/Create/Node types)
              — pinned top-left instead of a separate full-width bar. Same
              z-[45] reasoning as the minimap/zoom-controls cluster below
              (which stays put, bottom-right, on its own): above
              canvas/panel, below a real modal. */}
          <div className="absolute top-3 left-3 z-[45] flex items-center gap-1 rounded-card border border-line bg-surface p-1 shadow-card">
            {!quickAddActive || forceShowToolbar ? (
            <>
            {/* Omitted outright for a demo session — see ProtectedRoute's
                own redirect, which sends "/" straight back here anyway;
                a demo account has exactly the one map it was seeded with,
                nowhere else to go back to. */}
            {!user?.isDemo && (
            <Link
              to="/"
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-[0.95rem] font-semibold text-ink hover:bg-surface-2"
              title={t.map.toolbar.back}
            >
              &larr;
            </Link>
            )}
            <div className="relative">
              <button
                type="button"
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-[1.05rem] font-semibold text-ink hover:bg-surface-2"
                title={t.map.toolbar.add}
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
                      obstaclePoints(),
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
                  onExportText={() => {
                    setShowAddMenu(false);
                    openExportText();
                  }}
                />
              )}
            </div>
            {/* Off by default — see moveMode's own doc comment for why
                (dragging used to arm from a bare pointerdown, which read
                as accidental relocation on any touch imprecision). Pressed
                state mirrors tabBtn's own active look elsewhere in the
                app, just inline here since this cluster has no shared
                button style of its own to draw from. */}
            <button
              type="button"
              className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border text-[0.95rem] font-semibold hover:bg-surface-2 ${
                moveMode ? "border-accent bg-accent-soft text-accent-ink" : "border-transparent bg-transparent text-ink"
              }`}
              title={moveMode ? t.map.toolbar.moveOn : t.map.toolbar.moveOff}
              onClick={() => setMoveMode((v) => !v)}
            >
              ✥
            </button>
            {/* Global Navbar (which normally hosts these) is hidden on the
                map route — see App.tsx's onMapPage check — so this is the
                only place a map-page user can reach them. */}
            <div className="ml-1 flex items-center gap-1 border-l border-line pl-1">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
            </>
            ) : (
              // Collapsed while a node's own quick-add ring is up — see
              // forceShowToolbar's own doc comment. Expands the full
              // cluster back (without waiting for quick-add to end) rather
              // than opening some separate menu of its own — everything it
              // would show is already right here, just one click further.
              <button
                type="button"
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-[0.95rem] font-semibold text-ink hover:bg-surface-2"
                title={t.map.toolbar.expandToolbar}
                onClick={() => setForceShowToolbar(true)}
              >
                ⋮
              </button>
            )}
            {/* Owner-only — updateMapDao's own ownerId filter would reject
                this from anyone else anyway, so the button just doesn't
                offer what the server would refuse. Discussion (the
                default) shows every combat control below; Personal hides
                them — see isDiscussionMode's own doc comment. Exempted from
                the collapse above (unlike Back/+/Move) — toggling combat
                visibility is something you're just as likely to want while
                a node's own quick-add ring is up as any other time, so
                collapsing it away behind "⋮" too would bury a control
                that's actually in more, not less, demand right then. */}
            {isOwner && (
              <button
                type="button"
                className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border text-[0.95rem] font-semibold hover:bg-surface-2 ${
                  isDiscussionMode
                    ? "border-transparent bg-transparent text-ink"
                    : "border-accent bg-accent-soft text-accent-ink"
                }`}
                title={
                  isDiscussionMode
                    ? t.map.toolbar.discussionTooltip
                    : t.map.toolbar.personalTooltip
                }
                onClick={toggleMapMode}
              >
                {/* Plain text-presentation glyphs (no emoji variation
                    selector), not the colorful ⚔️/🧠 emoji this used to be —
                    matches the rest of this cluster's own monochrome
                    icons (✥ above, +/← beside it) instead of standing out
                    as the one brightly-colored button among them. */}
                {isDiscussionMode ? "⚔" : "✎"}
              </button>
            )}
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
              title={t.map.toolbar.zoomOut}
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
              title={t.map.toolbar.zoomReset}
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
              title={t.map.toolbar.zoomIn}
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

        {/* The pack picker and the group bar each take over this bottom-sheet
            slot from NodePanel while they're active, so the two never try to
            render at once (choosing a node from its panel drops the single
            selection — see startChooseFrom). */}
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
        ) : chooseMode || multiSelectIds.size > 0 ? (
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
                {multiSelectIds.size === 0
                  ? "Tap your nodes to choose them"
                  : `${multiSelectIds.size} node${multiSelectIds.size === 1 ? "" : "s"} ${chooseMode ? "chosen" : "selected"}`}
              </span>
              <div className="relative">
                <button
                  className={btnSm}
                  disabled={multiSelectIds.size === 0}
                  onClick={() => setShowSelectionMenu((v) => !v)}
                >
                  Actions
                </button>
                {showSelectionMenu && (
                  <SelectionMenu
                    count={multiSelectIds.size}
                    canGroupCircle={multiSelectIds.size >= 2}
                    canLink={multiSelectIds.size >= 2}
                    onLink={() => {
                      setShowSelectionMenu(false);
                      linkSelection();
                    }}
                    onClose={() => setShowSelectionMenu(false)}
                    onCopy={() => {
                      setShowSelectionMenu(false);
                      copySelection();
                    }}
                    onCopyText={() => {
                      setShowSelectionMenu(false);
                      copySelectionAsText();
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
            <button className={btnSm} onClick={exitChooseMode}>
              {chooseMode ? "Done" : "Deselect"}
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
                discussionMode={isDiscussionMode}
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

      {/* whitespace-nowrap on every item: without it, a long label
          ("Problematic option", "negative circle / under fire") had
          nothing stopping it from wrapping *inside* its own flex item on a
          narrow screen — text breaking mid-phrase while the icon/dot sat
          oddly on its own line above it — instead of flex-wrap doing its
          actual job of moving the *whole* item down to the next row.
          Tighter gap/padding/font too, so more items fit per row before
          any wrapping is needed at all. */}
      <div className="flex flex-wrap gap-[0.3rem] border-t border-line bg-surface px-3 py-[0.45rem]">
        {/* nt, not t — this file's own translation object is already
            destructured as `t` (useI18n) at the top of the component; a
            per-item loop variable of the same name would shadow it within
            this callback instead of colliding outright, which still works
            but reads as a landmine for the next edit in here. */}
        {NODE_TYPES.map((nt) => (
          <span key={nt} className="flex items-center gap-[0.25rem] whitespace-nowrap text-[0.68rem] text-ink-soft">
            {/* Same symbol a real node of this type actually renders
                (OutcomeBadge), not NodeTypeIcon's own separate glyph set —
                this legend used to teach a different symbol than the one
                you'd actually see on the map. "unknown" alone has no
                outcome symbol, so it keeps its own plain NodeTypeIcon
                glyph, same as a real "unknown" node does. */}
            {ringKindFor(nt) ? (
              <OutcomeBadge type={nt as OutcomeType} size={13} />
            ) : (
              <NodeTypeIcon type={nt} size={13} />
            )}
            {nt}
          </span>
        ))}
        <span className="flex items-center gap-[0.25rem] whitespace-nowrap text-[0.68rem] text-ink-soft">
          <span
            className="mr-[0.3rem] inline-block h-2 w-2 flex-shrink-0 rounded-full"
            style={{ background: "var(--success)" }}
          />
          {t.map.legend.positiveCircle}
        </span>
        <span className="flex items-center gap-[0.25rem] whitespace-nowrap text-[0.68rem] text-ink-soft">
          <span
            className="mr-[0.3rem] inline-block h-2 w-2 flex-shrink-0 rounded-full"
            style={{ background: "var(--danger)" }}
          />
          {t.map.legend.negativeCircle}
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
        <Modal title={t.map.addMenu.nodeTypes} onClose={() => setShowNodeTypesLegend(false)}>
          <div className="flex flex-col gap-[0.6rem]">
            {/* nt, not t — see the bottom legend bar's own matching comment. */}
            {NODE_TYPES.map((nt) => (
              <div key={nt} className="flex items-center gap-[0.6rem] text-[0.88rem] text-ink">
                {/* Same symbol a real node of this type actually renders —
                    see the bottom legend bar's own matching comment. */}
                {ringKindFor(nt) ? (
                  <OutcomeBadge type={nt as OutcomeType} size={20} />
                ) : (
                  <NodeTypeIcon type={nt} size={20} />
                )}
                {nt}
              </div>
            ))}
          </div>
        </Modal>
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
