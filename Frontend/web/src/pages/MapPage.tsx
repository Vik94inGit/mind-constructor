import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { MouseEvent as ReactMouseEvent } from "react";
import * as mapsApi from "../api/maps";
import * as nodesApi from "../api/nodes";
import { ApiRequestError } from "../api/client";
import { useMapData } from "../hooks/useMapData";
import { useMapViewerPrefs } from "../hooks/useMapViewerPrefs";
import { useZoneFocus } from "../hooks/useZoneFocus";
import { usePresentation } from "../hooks/usePresentation";
import { usePuzzleConnect } from "../hooks/usePuzzleConnect";
import { useMapKeyboard } from "../hooks/useMapKeyboard";
import { useSelectionActions } from "../hooks/useSelectionActions";
import { useNodeCreation } from "../hooks/useNodeCreation";
import { useMarqueeSelect } from "../hooks/useMarqueeSelect";
import { useChosenCircle } from "../hooks/useChosenCircle";
import { usePackMode } from "../hooks/usePackMode";
import type { PendingCreate } from "../hooks/useNodeCreation";
import { useCanvasViewport } from "../hooks/useCanvasViewport";
import { useCanvasMode } from "../hooks/useCanvasMode";
import { useWeaponReplay } from "../hooks/useWeaponReplay";
import { useNotice } from "../hooks/useNotice";
import { nodeClipboardSize } from "../utils/nodeClipboard";
import { computeBasePositions, computeRadialPositions, RADIAL_MAX_NEIGHBORS } from "../utils/nodePositions";
import { childCaptionsCoveringParents, computeParentIds, nodeSizeMultiplier } from "../utils/nodePriority";
import type { CaptionSpec } from "../utils/nodePriority";
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
import { MapBanner } from "../map/MapBanner";
import { MarqueeRect, PuzzleConnectLine, ZoneLoadingSpinner } from "../map/CanvasOverlays";
import { computePuzzleJoins } from "../utils/puzzleLinks";
import { assemblePuzzles } from "../utils/puzzleAssembly";
import { usePuzzleCardSizes } from "../hooks/usePuzzleCardSizes";
import { zoneModeByNode } from "../utils/zoneDisplay";
import type { ZoneMode } from "../utils/zoneDisplay";
import type { NodeDisplay } from "../utils/nodeDisplay";
import { WeaponLayer } from "../map/WeaponLayer";
import { MapToolbar } from "../map/MapToolbar";
import { ZoomControls } from "../map/ZoomControls";
import { SelectionBar } from "../map/SelectionBar";
import { MapLegend } from "../map/MapLegend";
import { InviteMemberModal } from "../components/InviteMemberModal";
import { ExportTextModal } from "../components/ExportTextModal";
import { idOf, nodeRefId } from "../utils/nodeType";
import { useRadialBlend } from "../hooks/useRadialBlend";
import { useSentimentShow } from "../hooks/useSentimentShow";
import { useCanvasFraming } from "../hooks/useCanvasFraming";
import { useClipboardActions } from "../hooks/useClipboardActions";
import { useLineDrawing } from "../hooks/useLineDrawing";
import { useNodeDragAndDrop } from "../hooks/useNodeDragAndDrop";
import { ZoneNames } from "../map/ZoneNames";
import { PresentationOverlay } from "../map/PresentationOverlay";
import {
  collectBranchIds,
  computeAttackPairIds,
  computeHiddenBranchIds,
  computeUnsolvedProblemIds,
  countPackedByContainer,
  weaponFlightVector,
  zoneLabel,
} from "../utils/mapGraph";
import type { Sentiment } from "../utils/nodeType";
import {
  CANVAS_W,
  CANVAS_H,
  ZOOM_STEP,
  DOT_ZOOM,
  computeLinkedNeighborIds,
  footprintObstacles,
  computeNodeGroups,
  computeLinkCycles,
} from "../utils/canvasLayout";
import type { Obstacle } from "../utils/canvasLayout";
import { MIN_NODE_GAP, NEW_NODE_ID, makeZoneRule, placeByZoneRules } from "../utils/zoneRules";
import type { ExtraNode, MovingNode } from "../utils/zoneRules";
import type { ReadingMode } from "../utils/readingMode";
import type { AttackIndicator, NodeDoc, NodeType } from "../types";

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
  // The ids the node search currently matches (null = no search): everything else dims.
  const [searchMatches, setSearchMatches] = useState<Set<string> | null>(null);
  // This viewer's own, per-browser view of the map — reading mode, compact
  // view, per-node/per-zone display, block locks, card fills. See
  // hooks/useMapViewerPrefs.ts.
  const {
    readingMode,
    storeReadingMode,
    compactView,
    toggleCompactView,
    nodeDisplay,
    setNodeDisplay,
    zoneDisplay,
    storeZoneDisplay,
    blockLocks,
    toggleBlockLock: toggleStoredBlockLock,
    cardFills,
    setCardFill,
  } = useMapViewerPrefs(mapId);
  function setReadingMode(mode: ReadingMode) {
    storeReadingMode(mode);
    if (mode !== "actual") fitZoomForDisplay(effectiveDisplay(), mode);
  }
  // An assembled puzzle locks and unlocks as one: every piece clicked
  // together with this one (puzzleClusterFor) follows its new state.
  function toggleBlockLock(nodeId: string) {
    const node = nodes.find((n) => n.nodeId === nodeId);
    const ids = node ? puzzleClusterFor(node) : [nodeId];
    toggleStoredBlockLock(nodeId, ids);
    // Locking a block mid-edit ends the edit.
    setInlineEditId((cur) => (cur && ids.includes(cur) ? null : cur));
  }
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
  const { notice, showNotice, dismissNotice } = useNotice();

  // A node not yet created, still being typed into the inline input — see
  // PendingCreate (hooks/useNodeCreation.ts).
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);
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

  // The map, its nodes/links/lines and how they load, change and stay in
  // sync — see hooks/useMapData.ts.
  const {
    map,
    setMap,
    nodes,
    setNodes,
    edges,
    setEdges,
    lines,
    setLines,
    indicators,
    loading,
    error,
    upsertNode,
    upsertEdge,
    upsertLine,
    applyCircleSelection,
    ensureNodeText,
    refreshInsights,
  } = useMapData({ mapId, setSelectedId, setCelebrateIds, loadErrorMessage: t.ui.errors.loadMap });

  // Choosing ("stabilizing") a circle and letting it go again — see
  // hooks/useChosenCircle.ts.
  const {
    circleLoadingRootId,
    setCircleLoadingRootId,
    releaseChosenCircleIfOutside,
    handleCircleBackdropClick,
  } = useChosenCircle({ mapId, map, applyCircleSelection, setActionError, t });


  // dragState/groupDragState/dropTarget (posFor's own overlay inputs, and
  // NodeCard's dragging/dropHighlight props below) plus the dragMoved and
  // groupDragToken refs are now owned entirely inside useNodeDragAndDrop —
  // see hooks/dragUIState.ts — and read back from its return value further
  // down instead of living here as five separate pieces of state.

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
  // Filters packed-away members out of every canvas rendering loop. Packing
  // (packAbl.ts) still exists as a relationship regardless — a container's
  // own count badge, and its "Packed (N)" unpack list in NodePanel, both
  // still work off Node.packedIntoNodeId either way — but a packed member
  // itself is hidden from the canvas. NodePanel still receives plain
  // `nodes` (not this), since it has to show a packed member in its
  // container's own unpack list even though the canvas itself doesn't
  // render it.
  const visibleNodes = useMemo(() => nodes.filter((n) => !n.packedIntoNodeId), [nodes]);
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
    vScrollMarginBottom,
    selectionSettled,
    screenToCanvas,
    zoomAt,
    zoomFromCenter,
    viewportBounds,
    settledViewportBounds,
    centerOnNode,
    centerOnPoint,
    panTo,
  } = useCanvasViewport({ mapId, loading, sheetOpen, positions });


  // For the owner: every node in a branch hidden from invited members (a
  // flagged root, and everything hanging from it by parentId).
  const hiddenBranchIds = useMemo(() => computeHiddenBranchIds(nodes), [nodes]);

  // Any node "chosen" on the map right now — a multi-select takes priority
  // (it's the more specific state), falling back to the plain single
  // selection. Null when nothing at all is chosen, the one case edges/
  // branch-arrows stay fully lit. Feeds the same dimming both the branch
  // arrows and plain Edges apply below, for a single selection too, not
  // just a multi-select — a lone selected node is already the map's "I'm
  // focused on this one" state everywhere else (NodeCard's own outline/
  // health/wings), so its edges should read that way too.
  const chosenNodeIds = multiSelectIds.size > 0 ? multiSelectIds : selectedId ? new Set([selectedId]) : null;
  // quickAddActive (below useNodeDragAndDrop further down, since it reads
  // that hook's own dragState) gates the quick-add ghost ring; the same
  // condition is reused here so every other node dims while it's showing,
  // putting the focus on the selected node and its type-to-create options
  // instead of competing with the rest of the canvas.
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
  const unmutedAttackNodeIds = useMemo(() => computeAttackPairIds(selectedId, nodes), [selectedId, nodes]);



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

  // Neighbors glide into (and back out of) the ring rather than jumping.
  const radialBlend = useRadialBlend(radialPositions);

  function posFor(node: NodeDoc) {
    const grouped = groupDragState?.get(node.nodeId);
    if (grouped) return grouped;
    if (dragState && dragState.nodeId === node.nodeId) return { x: dragState.x, y: dragState.y };
    // Always the real position — the sentiment show's travel is drawn on top
    // of this directly on the canvas DOM (see useSentimentShow), never here.
    const own = positions.get(node.nodeId) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    // Presentation mode's own org-chart blend — checked ahead of the radial
    // selection ring below since the two are mutually exclusive in practice
    // (there's no NodePanel/selection to ring neighbors around while
    // presenting — see enterPresentation), but resolving the order
    // explicitly here means nothing actually depends on that invariant
    // holding forever elsewhere in the file.
    const geo = geometrizeBlend.map?.get(node.nodeId);
    if (geo) {
      const b = geometrizeBlend.blend;
      return { x: own.x + (geo.x - own.x) * b, y: own.y + (geo.y - own.y) * b };
    }
    // Seated against the puzzle piece it's linked to — see puzzleAssembly.
    const seated = puzzleAssembly.positions.get(node.nodeId);
    if (seated) return seated;
    const radial = radialBlend.map?.get(node.nodeId);
    if (!radial) return own;
    const b = radialBlend.blend;
    return { x: own.x + (radial.x - own.x) * b, y: own.y + (radial.y - own.y) * b };
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

  // Where `moving` (one node, or a group moved as one) lands when put at
  // `desired`: the nearest spot that covers no other node and follows the
  // zone rules — out of zones it isn't in, zones not crossing, and no more
  // than ~2 cm from the nearest node or zone line. See utils/zoneRules.ts.
  // Only the moving nodes move; nothing else on the map is pushed around.
  function placeNode(desired: { x: number; y: number }, moving: MovingNode[], extra: ExtraNode[] = []) {
    const obstacles = footprintObstacles(
      [...obstaclePoints(new Set(moving.map((m) => m.nodeId))), ...extra.map((e) => e.pos)],
      MIN_NODE_GAP,
    );
    return placeByZoneRules(desired, obstacles, viewportBounds(), makeZoneRule(visibleNodes, positions, moving, extra));
  }


  // Presentation mode: the map's own nodes as slides over an auto-tidied,
  // org-chart canvas — see hooks/usePresentation.ts. posFor reads its
  // geometrizeBlend to draw that shape.
  const {
    presenting,
    slideIndex,
    setSlideIndex,
    slideNodes,
    geometrizeBlend,
    enterPresentation,
    exitPresentation,
  } = usePresentation({
    visibleNodes,
    hiddenBranchIds,
    multiSelectIds,
    selectedCircleNodeIds: map?.selectedCircle?.nodeIds,
    posFor,
    centerOnPoint,
    ensureNodeText,
    setMultiSelectIds,
    setSelectedId,
    dispatchMode,
    setActionError,
    emptyMessage: t.ui.presentation.empty,
  });

  // How many nodes are currently packed into each container — NodeCard's
  // own corner badge reads this by nodeId.
  const packedCountByContainer = useMemo(() => countPackedByContainer(nodes), [nodes]);

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

  // Zoomed out to 50%: no icons anywhere on the canvas — nodes are plain
  // dots, and the decorations drawn around them (circle-parent rings,
  // weapon marks, quick-add ghosts) are left out too. A hair of slack so a
  // zoom that lands a rounding step off 50% still counts.
  const dotZoom = zoom <= DOT_ZOOM + 0.005;
  // How each node is drawn: its own display if it has one, else its zone's
  // view, else the map's reading mode. A zone shown as dots draws its nodes
  // as dots (and reads as the default look underneath, for everything that
  // sizes or captions a node).
  const zoneModes = useMemo(() => zoneModeByNode(nodeGroups, zoneDisplay), [nodeGroups, zoneDisplay]);
  function modeOf(nodeId: string): ReadingMode {
    const own = nodeDisplay[nodeId];
    if (own) return own;
    const zone = zoneModes.get(nodeId);
    if (zone) return zone === "dots" ? "actual" : zone;
    return readingMode;
  }
  function dottedByZone(nodeId: string): boolean {
    return !nodeDisplay[nodeId] && zoneModes.get(nodeId) === "dots";
  }
  // Every node whose look differs from the map-wide mode, for the "zoom in
  // to make room" check (fitZoomForDisplay), which reads a NodeDisplay.
  function effectiveDisplay(zones: Map<string, ZoneMode> = zoneModes): NodeDisplay {
    const out: NodeDisplay = {};
    for (const [id, zone] of zones) out[id] = zone === "dots" ? "actual" : zone;
    return { ...out, ...nodeDisplay };
  }
  function setZoneMode(rootId: string, mode: ZoneMode | null) {
    const next = { ...zoneDisplay };
    if (mode) next[rootId] = mode;
    else delete next[rootId];
    storeZoneDisplay(next);
    const group = nodeGroups.find((g) => g.rootId === rootId);
    if (mode && mode !== "actual" && mode !== "dots") {
      fitZoomForDisplay(
        effectiveDisplay(zoneModeByNode(nodeGroups, next)),
        readingMode,
        group ? { x: group.cx, y: group.cy } : undefined,
      );
    }
  }

  // The zones near the middle of the screen stay at full strength and the
  // rest are muted — see hooks/useZoneFocus.ts.
  const { activeFocusedZones, zoneMutedIds } = useZoneFocus({
    wrapRef,
    loading,
    nodeGroups,
    zoom,
    hScrollMargin,
    vScrollMargin,
    hasSelectedCircle: !!map?.selectedCircle,
  });

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
  // needed up front (one bulk request for whatever hasn't loaded yet). The
  // mixed mode only shows circle parents' text, which the circle-root
  // backfill above already covers.
  useEffect(() => {
    const ids = visibleNodes
      .filter((n) => !["actual", "mixed"].includes(modeOf(n.nodeId)))
      .map((n) => n.nodeId);
    if (ids.length > 0) ensureNodeText(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingMode, nodeDisplay, zoneModes, visibleNodes]);

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

  // Every camera-framing cue (fit-to-zoom for a text reading mode, the
  // floor-at-100%-for-editing after a drag, bringing a set of nodes into
  // view) — see hooks/useCanvasFraming.ts.
  const { fitZoomForDisplay, zoomToEditAt, showPoints, showNodes, setDisplayForChosen } = useCanvasFraming({
    visibleNodes,
    positions,
    circleRootSentimentByNode,
    zoom,
    zoomFromCenter,
    centerOnPoint,
    wrapRef,
    showNotice,
    mapId,
    multiSelectIds,
    nodeDisplay,
    setNodeDisplay,
    readingMode,
    stillOverlapNotice: t.ui.display.stillOverlap,
    zoomedToFitNotice: t.ui.display.zoomedToFit,
  });

  // A map that's already crowded the moment it's opened gets the same
  // "zoom in to make room" treatment a reading-mode change triggers —
  // without this, a map that stays in the default icon view the whole time
  // has no way to ever surface this at all, however crowded loading it left
  // the canvas (see fitZoomForDisplay's own doc comment: it now checks
  // icon-mode footprints too, not just text modes). Runs once, right as the
  // initial load settles — keyed on `loading` alone, not on positions/nodes,
  // so a node moving near another one mid-drag doesn't zoom the screen in
  // on its own, fighting the gesture that caused it.
  useEffect(() => {
    if (loading) return;
    fitZoomForDisplay(effectiveDisplay(), readingMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // What any node creation/drag has to steer clear of so it never lands
  // inside a big group backdrop — the group's own members are exempt
  // (excludeRootIds), since they belong there and are what the backdrop is
  // even drawn around. Clearance is the backdrop's own radius plus a small
  // fixed buffer (not a fraction of getNodeMinDist() any more — that put a
  // ~150px empty ring of dead space around every zone on top of the radius'
  // own +70 built-in padding, reading as an overly spread-out, uncompact
  // map instead of a clear-but-tight boundary; even the first cut down to
  // +40 still read as a single-node drag landing surprisingly far from
  // where it was actually dropped). Just enough for a node's own icon to
  // clear the backdrop's edge, not its full caption-width spacing margin.
  function bigNodeObstacles(excludeRootIds: Set<string> = new Set()): Obstacle[] {
    return nodeGroups
      .filter((g) => !excludeRootIds.has(g.rootId))
      .map((g) => ({ x: g.cx, y: g.cy, minDist: g.r + 20 }));
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

  // A Problem node nothing has been proposed against yet pulses — see
  // computeUnsolvedProblemIds. Built from `nodes`, not visibleNodes: a
  // packed-away child still counts as "this got addressed".
  const unsolvedProblemIds = useMemo(() => computeUnsolvedProblemIds(nodes), [nodes]);

  // The sentiment show (see hooks/useSentimentShow.ts): on open, and on every
  // majority swing, the majority type's nodes travel toward the center and
  // the minority's toward the edge, one after another, hold, and come back.
  // Drawn straight onto the canvas DOM on top of the real positions (posFor
  // never sees it); skip is wired to any pointer-down on the canvas.
  const sentimentShow = useSentimentShow({
    nodes,
    visibleNodes,
    positions,
    canvasRef,
    draftType: pendingCreate?.type,
    showPoints,
    showNotice,
    positiveMajorityNotice: t.ui.positiveMajorityNotice,
    negativeMajorityNotice: t.ui.negativeMajorityNotice,
  });

  // Whether a node is drawn as a puzzle card right now — the only nodes that
  // snap together (see usePuzzleConnect).
  function drawnAsCard(n: NodeDoc): boolean {
    if (dotZoom || dottedByZone(n.nodeId)) return false;
    const m = modeOf(n.nodeId);
    return m === "puzzle" || (m === "mixed" && circleRootSentimentByNode.has(n.nodeId));
  }
  // Linked puzzle cards are drawn assembled, each seated flush against the
  // piece it's linked to (utils/puzzleAssembly.ts), and interlock along the
  // map's links (utils/puzzleLinks.ts) — the seated ones claiming their
  // sides first, so a tab always meets the blank next to it.
  // Changes whenever the assembly's own inputs do, so a layout that can't
  // settle (see usePuzzleCardSizes) is held only until the map changes.
  const puzzleSettleKey = useMemo(
    () => ({}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleNodes, edges, positions, zoom, nodeDisplay, zoneModes, readingMode, circleRootSentimentByNode],
  );
  const puzzleCardSizes = usePuzzleCardSizes(canvasRef, puzzleSettleKey);
  const puzzleAssembly = useMemo(() => {
    const ids = visibleNodes.filter((n) => drawnAsCard(n)).map((n) => n.nodeId);
    const links = [
      ...visibleNodes.flatMap((n) => {
        const parent = nodeRefId(n.parentId);
        return parent ? [{ from: parent, to: n.nodeId }] : [];
      }),
      ...edges.flatMap((e) => {
        const from = nodeRefId(e.fromNodeId);
        const to = nodeRefId(e.toNodeId);
        return from && to ? [{ from, to }] : [];
      }),
    ];
    const sizes = new Map(Array.from(puzzleCardSizes, ([id, s]) => [id, { w: s.w / zoom, h: s.h / zoom }]));
    // A locked block stays assembled: its whole puzzle locks with it, and
    // nothing in it can be dragged, so only a chosen circle's members are
    // held where they're stored.
    const held = new Set(visibleNodes.filter((n) => n.locked).map((n) => n.nodeId));
    return assemblePuzzles(ids, links, positions, sizes, held);
    // drawnAsCard reads the display state below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleNodes, edges, positions, puzzleCardSizes, zoom, nodeDisplay, zoneModes, readingMode, circleRootSentimentByNode]);
  const puzzleJoins = useMemo(() => {
    const at = new Map(positions);
    for (const [id, p] of puzzleAssembly.positions) at.set(id, p);
    return computePuzzleJoins(visibleNodes, edges, at, puzzleAssembly.seated);
  }, [visibleNodes, edges, positions, puzzleAssembly]);
  // Puzzle pieces: dragging a link out of a piece's tab, and clicking pieces
  // together — see hooks/usePuzzleConnect.ts.
  const { puzzleConnect, puzzleSnapFor, puzzleClusterFor, linkSnappedPieces, startPuzzleConnect } = usePuzzleConnect({
    mapId,
    nodes,
    edges,
    visibleNodes,
    zoom,
    puzzleJoins,
    isOwnNode,
    drawnAsCard,
    posFor,
    screenToCanvas,
    upsertEdge,
    refreshInsights,
    setActionError,
    setContextMenu,
    setPendingLink,
    linkFailedMessage: t.ui.link.failed,
  });

  // The node drag/drop system: single-node reposition-or-join-a-circle,
  // group ("follow the leader") drag, and touch's own long-press-to-
  // multiselect disambiguation — see hooks/useNodeDragAndDrop.ts.
  const { onNodePointerDown, dragState, groupDragState, dropTarget } = useNodeDragAndDrop({
    nodes,
    positions,
    nodeGroups,
    chooseMode,
    packMode,
    drawMode,
    multiSelectIds,
    moveMode,
    isOwnNode,
    handleNodeClick,
    posFor,
    screenToCanvas,
    viewportBounds,
    obstaclePoints,
    placeNode,
    zoomToEditAt,
    upsertNode,
    setActionError,
    setNodes,
    setSelectedId,
    setMultiSelectIds,
    suppressNextClick,
    t,
    snapFor: puzzleSnapFor,
    onSnapped: linkSnappedPieces,
    clusterFor: puzzleClusterFor,
    isBlockLocked: (id) => !!blockLocks[id],
  });

  // Same condition that gates the quick-add ghost ring below — reused
  // higher up (chosenNodeIds' own muted computation) so every other node
  // dims while it's showing, putting the focus on the selected node and its
  // type-to-create options instead of competing with the rest of the
  // canvas. selectionSettled: the ghosts (and the dimming that comes with
  // them) wait until centerOnNode's own pan has landed — see its own doc
  // comment.
  const quickAddActive =
    !!(selectedNode && isOwnNode(selectedNode) && !chooseMode && !packMode && !dragState) && selectionSettled;

  // See forceShowToolbar's own doc comment — every fresh quick-add starts
  // collapsed again, regardless of whether a previous one was manually
  // expanded.
  useEffect(() => {
    if (!quickAddActive) setForceShowToolbar(false);
  }, [quickAddActive]);

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
    return isOwnNode(node) && !blockLocks[node.nodeId];
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
  // actually turns the inline input on when canEditNode agrees. Reached from
  // a node double-click and the side panel's own Edit button. The context
  // menu's own "Edit" item is a different, separate action now — it just
  // opens the panel (see handleNodeClick below), not this inline editor.
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

  // The context menu's own "Change type" submenu — a third path to the same
  // field the inline editor's icon-click cycling and the node panel's own
  // (now removed) type dropdown used to cover, for picking a type without
  // opening either of those. Owner-only, same as every other context-menu
  // action on someone else's node (see NodeContextMenu's own isOwner gate).
  async function handleChangeNodeType(node: NodeDoc, type: NodeType) {
    setActionError(null);
    try {
      const updated = await nodesApi.updateNode(node.nodeId, { type });
      upsertNode(updated);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.type);
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

  // Every own node below `rootId` in the branch tree, in reading order — see
  // collectBranchIds.
  function branchIds(rootId: string): string[] {
    return collectBranchIds(rootId, visibleNodes, isOwnNode);
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

  // Packing nodes into a container — see hooks/usePackMode.ts.
  const { startPackFrom, exitPackMode, packContainer, packPicks, confirmPackSelection } = usePackMode({
    packContainerId,
    packSelection,
    nodes,
    selectedId,
    setSelectedId,
    setMultiSelectIds,
    dispatchMode,
    upsertNode,
    setActionError,
    packFailedMessage: t.ui.errors.pack,
  });

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

  // Rubber-band (marquee) select on empty canvas — see
  // hooks/useMarqueeSelect.ts.
  const { marquee, onCanvasPointerDown } = useMarqueeSelect({
    disabled: chooseMode || packMode || drawMode,
    screenToCanvas,
    nodes,
    positions,
    isOwnNode,
    suppressNextClick,
    setMultiSelectIds,
    setSelectedId,
  });

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

  // Quick-add: clicking one of the half-visible type ghosts fanned around
  // the selected node opens the inline pending-node input at the ghost's
  // spot, pre-set to that type and already branching off the anchor via
  // parentId (a tree-lineage arrow, not a sentiment Edge/"link" — those
  // stay reserved for the explicit "Link nodes" flow). Nothing is created
  // until confirmPendingCreate actually fires.
  function startQuickAdd(type: NodeType, pos: { x: number; y: number }, parent: NodeDoc, text?: string) {
    setActionError(null);
    // The ghost's slot is a fixed angle around the anchor — it doesn't know
    // about anything else on the canvas, so a crowded area can still land
    // it on top of another node or inside a zone the new node won't be in.
    // Nudge it to the nearest spot the zone rules allow (see placeNode)
    // before opening the input.
    const placed = placeNode(pos, [{ nodeId: NEW_NODE_ID, parentId: parent.nodeId }]);
    setInlineEditId(null);
    setPendingCreate({ x: placed.x, y: placed.y, type, parentId: parent.nodeId, text });
  }

  // ---- Separator lines ----
  // Drawing takes over the canvas clicks and the bottom sheet — see
  // hooks/useLineDrawing.ts.
  const {
    toggleDrawMode,
    exitDrawMode,
    drawRefusal,
    addDrawPoint,
    undoDrawPoint,
    onDrawPointerMove,
    finishLine,
    canDeleteLine,
    handleLineClick,
  } = useLineDrawing({
    drawMode,
    drawPoints,
    drawSaving,
    dispatchMode,
    visibleNodes,
    nodeGroups,
    linkCycles,
    posFor,
    readingMode,
    lines,
    setLines,
    upsertLine,
    mapId,
    setActionError,
    screenToCanvas,
    setSelectedId,
    setMultiSelectIds,
    setContextMenu,
    setCanvasContextMenu,
    setPendingCreate,
    currentUserId: user?._id,
    mapOwnerId: map?.ownerId,
    createFailedMessage: t.ui.lines.createFailed,
    deleteConfirmMessage: t.ui.lines.deleteConfirm,
    deleteFailedMessage: t.ui.lines.deleteFailed,
  });

  // Every clipboard/export action (copy, copy-as-text, paste, whole-map and
  // cluster-scoped text export) — see hooks/useClipboardActions.ts.
  const {
    copySelection,
    copyWholeMap,
    copySelectionAsText,
    openExportText,
    collectClusterSubtree,
    extractClusterText,
    pasteClipboard,
  } = useClipboardActions({
    mapId,
    nodes,
    edges,
    visibleNodes,
    positions,
    nodeGroups,
    multiSelectIds,
    selectedId,
    ensureNodeText,
    upsertNode,
    upsertEdge,
    setActionError,
    showNotice,
    setSelectedId,
    setMultiSelectIds,
    setCelebrateIds,
    setShowExportText,
    setExtractClusterRootId,
    obstaclePoints,
    bigNodeObstacles,
    viewportBounds,
    refreshInsights,
    t,
  });

  // The group bar's bulk actions on the chosen nodes — see
  // hooks/useSelectionActions.ts.
  const { deleteSelection, groupSelectionIntoCircle, numberSelection } = useSelectionActions({
    mapId,
    nodes,
    positions,
    multiSelectIds,
    isOwnNode,
    upsertNode,
    setNodes,
    setEdges,
    setMultiSelectIds,
    setSelectedId,
    showNodes,
    setActionError,
    refreshInsights,
    t,
  });

  // Every way a new node gets made — the pending-node input's confirm, a
  // template branch, "Create circle". See hooks/useNodeCreation.ts.
  const { confirmPendingCreate, applyTemplate, createCircle } = useNodeCreation({
    mapId,
    positions,
    pendingCreate,
    setPendingCreate,
    upsertNode,
    setCelebrateIds,
    setSelectedId,
    setMultiSelectIds,
    setActionError,
    obstaclePoints,
    bigNodeObstacles,
    placeNode,
    viewportBounds,
    showNodes,
    showNotice,
    t,
  });

  // Leaves a demo session for the login page — its account and map are
  // throwaway, so there is no way back to them afterwards. ProtectedRoute
  // sends a logged-out user to /login on its own.
  function exitDemo() {
    if (!confirm(t.ui.demo.exitConfirm)) return;
    void logout();
  }

  // The map's keyboard shortcuts — presentation stepping, line drawing,
  // finishing a choice, copy/paste. See hooks/useMapKeyboard.ts.
  useMapKeyboard({
    presenting,
    exitPresentation,
    setSlideIndex,
    slideCount: slideNodes.length,
    drawMode,
    drawPointCount: drawPoints.length,
    undoDrawPoint,
    finishLine,
    clearDrawPoints: () => dispatchMode({ type: "drawClearPoints" }),
    exitDrawMode,
    chooseMode,
    hasGroupSelection: multiSelectIds.size > 0,
    exitChooseMode,
    copySelection,
    pasteClipboard,
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
    // As close to the middle of the view as the zone rules allow — next to
    // what's already there rather than somewhere random in the empty space.
    const view = viewportBounds();
    const pos = placeNode({ x: (view.minX + view.maxX) / 2, y: (view.minY + view.maxY) / 2 }, [
      { nodeId: NEW_NODE_ID, parentId: null },
    ]);
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

  // Parents first (utils/nodePriority.ts): a node with a visible child paints
  // above the rest, every other child is faded until someone looks at it
  // (it, or its parent, is selected, it's in the chosen circle, being
  // dragged or edited), and a child's caption that would lie over a
  // parent's caption is left out.
  const parentIds = computeParentIds(visibleNodes);
  const nodeDragged = (n: NodeDoc) => dragState?.nodeId === n.nodeId || groupDragState?.has(n.nodeId) === true;
  const childIsQuiet = (n: NodeDoc) => {
    const parentId = nodeRefId(n.parentId);
    if (!parentId || !parentIds.has(parentId) || parentIds.has(n.nodeId)) return false;
    return !(
      selectedId === n.nodeId ||
      selectedId === parentId ||
      multiSelectIds.has(n.nodeId) ||
      spotlightedNodeIds?.includes(n.nodeId) ||
      inlineEditId === n.nodeId ||
      nodeDragged(n)
    );
  };
  const hiddenChildCaptions = (() => {
    const captionSpec = (n: NodeDoc): CaptionSpec => {
      const isCircleParent = circleRootSentimentByNode.has(n.nodeId);
      return {
        pos: posFor(n),
        sizeMultiplier: nodeSizeMultiplier(n, isCircleParent, compactView),
        lines: modeOf(n.nodeId) === "iconText" ? 4 : 2,
        namedZone: isCircleParent && !!n.zoneName && !compactView,
      };
    };
    // A parent's caption is up unless its card *is* the node (puzzle
    // reading mode) or it's selected/being edited (NodeCard drops it then).
    const shownParents = visibleNodes.filter(
      (n) =>
        parentIds.has(n.nodeId) &&
        !["puzzle", "mixed"].includes(modeOf(n.nodeId)) &&
        !dottedByZone(n.nodeId) &&
        selectedId !== n.nodeId &&
        inlineEditId !== n.nodeId,
    );
    if (shownParents.length === 0) return new Set<string>();
    const children = new Map<string, CaptionSpec>();
    for (const n of visibleNodes) {
      if (!parentIds.has(n.nodeId)) children.set(n.nodeId, captionSpec(n));
    }
    return childCaptionsCoveringParents(children, shownParents.map(captionSpec), zoom);
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {notice && <MapBanner tone="success" message={notice} onDismiss={dismissNotice} />}
      {actionError && <MapBanner tone="danger" message={actionError} onDismiss={() => setActionError(null)} />}

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
              height: CANVAS_H + vScrollMargin + vScrollMarginBottom,
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
            // Capture phase, so any press anywhere on the canvas — empty
            // space, a node, a zone, a link — cuts the sentiment show short,
            // even when that element stops the event from bubbling.
            onPointerDownCapture={sentimentShow.skip}
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
              focusedZones={activeFocusedZones}
              visibleNodes={visibleNodes}
              edges={edges}
              posFor={posFor}
              circleRootSentimentByNode={circleRootSentimentByNode}
              linkCycles={linkCycles}
              chosenNodeIds={chosenNodeIds}
              pendingLink={pendingLink}
              onCircleClick={(rootId) => {
                // A zone's own polygon stops the click from ever reaching the
                // canvas div's onClick (see its own chooseMode branch above)
                // — so without this, choosing was only exitable by clicking
                // truly empty canvas, not a zone. Choosing wins over the
                // zone's normal stabilize/release behavior while it's active.
                if (chooseMode) {
                  exitChooseMode();
                  return;
                }
                handleCircleBackdropClick(rootId);
              }}
              lines={lines}
              canDeleteLine={canDeleteLine}
              onLineClick={handleLineClick}
              interactive={!drawMode}
              compact={compactView || dotZoom}
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

            {/* The connection being dragged out of a puzzle piece's tab. */}
            {puzzleConnect &&
              (() => {
                const fromNode = visibleNodes.find((n) => n.nodeId === puzzleConnect.fromId);
                return fromNode ? (
                  <PuzzleConnectLine from={posFor(fromNode)} connect={puzzleConnect} zoom={zoom} />
                ) : null;
              })()}

            {visibleNodes.map((node) => {
              const pos = posFor(node);
              const editingThis = inlineEditId === node.nodeId;
              // Weapon nodes only: fly in from away from their target — see
              // weaponFlightVector.
              let flightVector: { x: number; y: number } | undefined;
              if (node.isWeapon) {
                const targetId = nodeRefId(node.targetNodeId);
                const target = targetId ? nodes.find((t) => t.nodeId === targetId) : undefined;
                if (target) flightVector = weaponFlightVector(pos, posFor(target));
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
                  dragging={nodeDragged(node)}
                  // Drags off a bare pointer-down only actually happen when
                  // moveMode is on, or the node is already part of an
                  // active 2+-node multi-selection (that path stays live
                  // regardless — see onNodePointerDown's own group-drag
                  // branch) — this just keeps NodeCard's own grab/grabbing
                  // cursor honest about which nodes will really respond.
                  canDrag={
                    isOwnNode(node) &&
                    !node.locked &&
                    !blockLocks[node.nodeId] &&
                    (moveMode || (multiSelectIds.size > 1 && multiSelectIds.has(node.nodeId)))
                  }
                  groupSentiment={groupSentimentByNode.get(node.nodeId)}
                  parentCrownSentiment={circleRootSentimentByNode.get(node.nodeId)}
                  inChosenCircle={!!spotlightedNodeIds?.includes(node.nodeId)}
                  indicator={indicatorByNode.get(node.nodeId)}
                  packedCount={packedCountByContainer.get(node.nodeId)}
                  unsolved={unsolvedProblemIds.has(node.nodeId)}
                  chooseModeActive={chooseMode}
                  readingMode={modeOf(node.nodeId)}
                  compact={compactView}
                  hiddenBranch={hiddenBranchIds.has(node.nodeId)}
                  discussionMode={isDiscussionMode}
                  celebrate={celebrateIds.has(node.nodeId)}
                  flightVector={flightVector}
                  muted={
                    ((quickAddActive && !dotZoom && node.nodeId !== selectedId) ||
                      (!!spotlightedNodeIds && !spotlightedNodeIds.includes(node.nodeId)) ||
                      (!chooseMode && multiSelectIds.size > 0 && !multiSelectIds.has(node.nodeId)) ||
                      (!!searchMatches && !searchMatches.has(node.nodeId))) &&
                    !unmutedAttackNodeIds?.has(node.nodeId)
                  }
                  isParent={parentIds.has(node.nodeId)}
                  quiet={childIsQuiet(node) || (zoneMutedIds.has(node.nodeId) && selectedId !== node.nodeId)}
                  hideCaption={hiddenChildCaptions.has(node.nodeId) && inlineEditId !== node.nodeId}
                  dropHighlight={
                    puzzleConnect?.overId === node.nodeId
                      ? puzzleConnect.valid
                        ? "valid"
                        : "invalid"
                      : dropTarget?.nodeId === node.nodeId
                        ? dropTarget.valid
                          ? "valid"
                          : "invalid"
                        : undefined
                  }
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
                  puzzleJoins={puzzleJoins.get(node.nodeId)}
                  cardFill={cardFills[node.nodeId]}
                  dotted={dotZoom || dottedByZone(node.nodeId)}
                  blockLocked={!!blockLocks[node.nodeId]}
                  onToggleBlockLock={isOwnNode(node) ? () => toggleBlockLock(node.nodeId) : undefined}
                  onConnectStart={
                    isOwnNode(node) && !drawMode ? (e) => startPuzzleConnect(node, e) : undefined
                  }
                />
              );
            })}

            {/* Loading spinner on a zone that was just clicked — see
                circleLoadingRootId. Sits at the zone's middle, counter-scaled
                so it stays the same size on screen at any zoom. */}
            {circleLoadingRootId &&
              (() => {
                const group = nodeGroups.find((g) => g.rootId === circleLoadingRootId);
                return group ? (
                  <ZoneLoadingSpinner x={group.cx} y={group.cy} zoom={zoom} label={t.ui.common.loading} />
                ) : null;
              })()}
            {!dotZoom && (
              <WeaponLayer
                visibleNodes={visibleNodes}
                posFor={posFor}
                celebrateIds={celebrateIds}
                shotState={shotState}
              />
            )}

            {/* No separate ShieldMark overlay any more — a protection node
                already sits exactly on the arrows path between attacker and
                defended node (see the positions memo) and the arrows
                targeting it stop right there (see the weapon-mark loop
                above), which is signal enough on its own; the extra
                bow-and-emblem drawing on top of it read as redundant
                clutter. NodeCard's own small 🛡️ badge is still the one
                thing marking a node as a protector, active attacker or not. */}

            {quickAddActive && !dotZoom && selectedNode && !pendingCreate && !inlineEditId && (
              <QuickAddGhosts
                anchorPos={posFor(selectedNode)}
                bounds={settledViewportBounds()}
                compact={compactView}
                zoom={zoom}
                onPick={(type, pos, text) => startQuickAdd(type, pos, selectedNode, text)}
              />
            )}

            {!loading && nodes.length === 0 && !pendingCreate && !drawMode && (
              <QuickAddGhosts
                intro
                compact={compactView}
                zoom={zoom}
                anchorPos={{ x: CANVAS_W / 2, y: CANVAS_H / 2 }}
                // No bounds to squeeze the ring into: the view opens centered
                // on this point, so a full round ring fits.
                bounds={{ minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity }}
                onPick={(type, pos, text) => {
                  setActionError(null);
                  setPendingCreate({ x: pos.x, y: pos.y, type, parentId: null, text });
                }}
              />
            )}

            {pendingCreate && (
              <PendingNodeCard
                x={pendingCreate.x}
                y={pendingCreate.y}
                type={pendingCreate.type}
                initialText={pendingCreate.text}
                zoom={zoom}
                onConfirm={confirmPendingCreate}
                onCancel={() => setPendingCreate(null)}
                // Keeps pendingCreate.type in sync with whichever type is
                // currently armed in the card, live — the dominantSentiment
                // memo below reads it straight off pendingCreate rather
                // than needing its own separate piece of state.
                onTypeChange={(draftType) =>
                  setPendingCreate((prev) => (prev ? { ...prev, type: draftType } : prev))
                }
              />
            )}

            {/* Rubber-band select rectangle — see useMarqueeSelect. */}
            {marquee && <MarqueeRect marquee={marquee} />}
          </div>
          </div>
          </div>
          {/* All of this is normal editing chrome — replaced outright by
              PresentationOverlay below while presenting, not just dimmed
              underneath it, same "swap the slot, don't hide-under" approach
              the pack/choose/draw bottom-sheet ternary just below already
              uses for NodePanel. */}
          {!presenting && (
            <>
              <MiniMap
                wrapRef={wrapRef}
                nodes={visibleNodes}
                edges={edges}
                lines={lines}
                positions={positions}
                groups={nodeGroups.map((g) => ({ ...g, variant: !!nodes.find((n) => n.nodeId === g.rootId)?.parentId }))}
                canvasW={CANVAS_W}
                canvasH={CANVAS_H}
                zoom={zoom}
                hScrollMargin={hScrollMargin}
                vScrollMargin={vScrollMargin}
                onPanTo={panTo}
              />

              <ZoneNames
                wrapRef={wrapRef}
                zones={nodeGroups.flatMap((g) => {
                  const root = nodes.find((n) => n.nodeId === g.rootId);
                  // See zoneLabel: zoneName, else title, else text, capped.
                  const shortName = zoneLabel(root);
                  return shortName
                    ? [{ rootId: g.rootId, name: shortName, sentiment: g.sentiment, variant: !!root!.parentId }]
                    : [];
                })}
                positions={positions}
                zoom={zoom}
                hScrollMargin={hScrollMargin}
                vScrollMargin={vScrollMargin}
                // Centers the view on the whole zone (zooming out only if it
                // doesn't fit), without selecting anything.
                modes={zoneDisplay}
                onSetMode={setZoneMode}
                onGo={(rootId) => {
                  const group = nodeGroups.find((g) => g.rootId === rootId);
                  if (!group) return;
                  const pts = [group.rootId, ...group.members.map((m) => m.nodeId)]
                    .map((id) => positions.get(id))
                    .filter((p): p is { x: number; y: number } => !!p);
                  showPoints(pts, { aboveSheet: false });
                }}
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
                compact={compactView}
                onToggleCompact={toggleCompactView}
                nodes={visibleNodes}
                onLoadTexts={async () => {
                  await ensureNodeText(visibleNodes.map((n) => n.nodeId));
                }}
                onSearchMatches={setSearchMatches}
                onPickSearchResult={(id) => {
                  setSelectedId(id);
                  centerOnNode(id);
                }}
                onToggleMapMode={toggleMapMode}
                onExitDemo={exitDemo}
                onInvite={() => setShowInvite(true)}
                onCreateNode={startCreateNodeInView}
                onCreateCircle={createCircle}
                onCopyMap={copyWholeMap}
                onPaste={() => pasteClipboard()}
                onExportText={openExportText}
                onPresent={enterPresentation}
              />

              <ZoomControls
                zoom={zoom}
                onZoomOut={() => zoomFromCenter(-ZOOM_STEP)}
                onZoomIn={() => zoomFromCenter(ZOOM_STEP)}
                onReset={() => zoomFromCenter(0, 1)}
              />
            </>
          )}

          {presenting && (
            <PresentationOverlay
              slides={slideNodes}
              index={Math.min(slideIndex, Math.max(0, slideNodes.length - 1))}
              onIndexChange={setSlideIndex}
              onExit={exitPresentation}
            />
          )}
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
          // !presenting: NodePanel already only renders when a node is
          // selected, and enterPresentation clears selectedId — but this
          // guard stays defensive rather than relying on that alone, in
          // case anything else (e.g. a queued search-result pick) ever
          // re-selects a node while presenting.
          !presenting &&
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
                textLocked={!!blockLocks[selectedNode.nodeId]}
                onToggleLock={isOwnNode(selectedNode) ? () => toggleBlockLock(selectedNode.nodeId) : undefined}
                cardFill={(() => {
                  const mode = modeOf(selectedNode.nodeId);
                  const isCard =
                    mode === "puzzle" || (mode === "mixed" && circleRootSentimentByNode.has(selectedNode.nodeId));
                  return isCard
                    ? {
                        value: cardFills[selectedNode.nodeId],
                        onChange: (c: string | null) => setCardFill(selectedNode.nodeId, c),
                      }
                    : null;
                })()}
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
          // Remounts fresh (back to the root menu, not stuck on whatever
          // submenu the previous node's menu was showing) whenever the
          // target node changes.
          key={contextMenu.node.nodeId}
          x={contextMenu.x}
          y={contextMenu.y}
          isOwner={isOwnNode(contextMenu.node)}
          canAttack={canAttackNode(contextMenu.node)}
          blockLocked={!!blockLocks[contextMenu.node.nodeId]}
          onToggleBlockLock={isOwnNode(contextMenu.node) ? () => toggleBlockLock(contextMenu.node.nodeId) : undefined}
          nodeType={contextMenu.node.type}
          onClose={() => setContextMenu(null)}
          onCreate={() => {
            const anchor = contextMenu.node;
            setContextMenu(null);
            // Starts on the anchor itself; placeNode moves it just clear of
            // it (and of anything else the zone rules keep it from), so the
            // new child appears right beside its parent.
            const pos = placeNode(posFor(anchor), [{ nodeId: NEW_NODE_ID, parentId: anchor.nodeId }]);
            setInlineEditId(null);
            setPendingCreate({ x: pos.x, y: pos.y, type: "unknown", parentId: anchor.nodeId });
          }}
          onEdit={() => handleNodeClick(contextMenu.node)}
          onChangeType={(type) => handleChangeNodeType(contextMenu.node, type)}
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
            // another node or break a zone rule (see placeNode).
            const pos = placeNode({ x: canvasContextMenu.canvasX, y: canvasContextMenu.canvasY }, [
              { nodeId: NEW_NODE_ID, parentId: null },
            ]);
            setCanvasContextMenu(null);
            setInlineEditId(null);
            setPendingCreate({ x: pos.x, y: pos.y, type, parentId: null });
          }}
        />
      )}

      {!presenting && <MapLegend />}

      {pendingLink && mapId && (
        <CreateEdgeModal
          mapId={mapId}
          nodes={pendingLink}
          onClose={() => setPendingLink(null)}
          onCreated={(created) => {
            created.forEach(upsertEdge);
            showNodes(pendingLink.map((n) => n.nodeId));
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
