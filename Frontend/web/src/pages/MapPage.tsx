import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { MouseEvent as ReactMouseEvent } from "react";
import * as nodesApi from "../api/nodes";
import { ApiRequestError } from "../api/client";
import { useMapData } from "../hooks/useMapData";
import { useBackGuard } from "../hooks/useBackGuard";
import { useIntroMigration } from "../hooks/useIntroMigration";
import { usePositionGlide } from "../hooks/usePositionGlide";
import { useMapViewerPrefs } from "../hooks/useMapViewerPrefs";
import { useZoneFocus } from "../hooks/useZoneFocus";
import { usePresentation } from "../hooks/usePresentation";
import { usePuzzleConnect } from "../hooks/usePuzzleConnect";
import { useMapKeyboard } from "../hooks/useMapKeyboard";
import { useSelectionActions } from "../hooks/useSelectionActions";
import { useNodeCreation } from "../hooks/useNodeCreation";
import { useDesktopLayout } from "../hooks/useDesktopLayout";
import { useMarqueeSelect } from "../hooks/useMarqueeSelect";
import { useChosenCircle } from "../hooks/useChosenCircle";
import { usePackMode } from "../hooks/usePackMode";
import type { PendingCreate } from "../hooks/useNodeCreation";
import { useCanvasViewport } from "../hooks/useCanvasViewport";
import { useCanvasMode } from "../hooks/useCanvasMode";
import { useWeaponReplay } from "../hooks/useWeaponReplay";
import { useNotice } from "../hooks/useNotice";
import { useStableActions } from "../hooks/useStableActions";
import { getSyncStatus, subscribeSyncStatus } from "../offline/sync";
import { nodeClipboardSize } from "../utils/nodeClipboard";
import { computeBasePositions } from "../utils/nodePositions";
import { cardSpaceIds, spotFields, withCardSpots } from "../utils/cardSpace";
import { computeParentIds, hiddenChildCaptions } from "../utils/nodePriority";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { CanvasNodeCard } from "../map/CanvasNodeCard";
import type { CanvasNodeActions } from "../map/CanvasNodeCard";
import { NodePanel } from "../map/NodePanel";
import { PackPickerPanel } from "../map/PackPickerPanel";
import { TextToNodesModal } from "../map/TextToNodesModal";
import { findFreeSpots } from "../utils/freeSpots";
import { PendingNodeCard } from "../map/PendingNodeCard";
import { CreateEdgeModal } from "../map/CreateEdgeModal";
import { QuickAddGhosts } from "../map/QuickAddGhosts";
import { ReparentBar } from "../map/ReparentBar";
import { NewNodePanel } from "../map/NewNodePanel";
import { useFlipSequence } from "../hooks/useFlipSequence";
import { NodeContextMenu } from "../map/NodeContextMenu";
import { CheckInPrompt } from "../map/CheckInPrompt";
import type { NodeLinkItem } from "../map/NodeContextMenu";
import { CanvasContextMenu } from "../map/CanvasContextMenu";
import { MiniMap } from "../map/MiniMap";
import { PictureViewer } from "../map/PictureViewer";
import { TimeLapseBar, timeLapseOrder } from "../map/TimeLapseBar";
import { ViewCorner } from "../map/ViewCorner";
import { ViewPrompt } from "../map/ViewPrompt";
import { loadMinimapShown, saveMinimapShown } from "../utils/minimapPref";
import { readingOrder, stepNode } from "../utils/nodeOrder";
import { useMoveUndo } from "../hooks/useMoveUndo";
import { deletedNodeOf, leafChildrenOf, restoreDeletedNode } from "../utils/restoreNode";
import { CanvasBackdrop } from "../map/CanvasBackdrop";
import { CanvasFrame } from "../map/CanvasFrame";
import { DrawLineBar } from "../map/DrawLineBar";
import { SiegePanel } from "../map/SiegePanel";
import { holdsOf } from "../utils/siege";
import { MapBanner } from "../map/MapBanner";
import { MarqueeRect, PuzzleConnectLine, ZoneLoadingSpinner } from "../map/CanvasOverlays";
import { zoneModeByNode } from "../utils/zoneDisplay";
import { MAP_ZONE_KEY } from "../utils/zoneLayout";
import type { ZoneMode } from "../utils/zoneDisplay";
import { WeaponLayer } from "../map/WeaponLayer";
import { useChompRuns } from "../hooks/useChompRuns";
import { MapToolbar } from "../map/MapToolbar";
import { ZoomControls } from "../map/ZoomControls";
import { SelectionBar } from "../map/SelectionBar";
import { MapLegend } from "../map/MapLegend";
import { ZoneMenu } from "../map/ZoneMenu";
import { GestureHint } from "../map/GestureHint";
import type { ZoneStylePatch } from "../map/ZoneMenuBody";
import { InviteMemberModal } from "../components/InviteMemberModal";
import { ExportTextModal } from "../components/ExportTextModal";
import { idOf, nodeRefId, zoneParentId } from "../utils/nodeType";
import { useRadialFocus } from "../hooks/useRadialFocus";
import { useMapEntrance } from "../hooks/useMapEntrance";
import { useAutoPack } from "../hooks/useAutoPack";
import { useCardPacking } from "../hooks/useCardPacking";
import { useCanvasFraming } from "../hooks/useCanvasFraming";
import { useClipboardActions } from "../hooks/useClipboardActions";
import { useLineDrawing } from "../hooks/useLineDrawing";
import { useNodeDragAndDrop } from "../hooks/useNodeDragAndDrop";
import { useReparent } from "../hooks/useReparent";
import { useRestoreView } from "../hooks/useRestoreView";
import { useNodeBursts } from "../hooks/useNodeBursts";
import { useTextBackfill } from "../hooks/useTextBackfill";
import { useNodeStyling } from "../hooks/useNodeStyling";
import { useNodeDelete } from "../hooks/useNodeDelete";
import { useNodeLinks } from "../hooks/useNodeLinks";
import { useTimeLapse } from "../hooks/useTimeLapse";
import { useQuickAdd } from "../hooks/useQuickAdd";
import { useZoneDisplay } from "../hooks/useZoneDisplay";
import { usePlacement } from "../hooks/usePlacement";
import { useChooseMode } from "../hooks/useChooseMode";
import { hasPictures, usePictureView } from "../hooks/usePictureView";
import { useMapControls } from "../hooks/useMapControls";
import { ZoneNames } from "../map/ZoneNames";
import { PresentationOverlay } from "../map/PresentationOverlay";
import {
  computeAttackPairIds,
  computeHiddenBranchIds,
  computeSolved,
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
  freeFootprintScale,
  computeNodeGroups,
  computeLinkCycles,
  getCirclePackSpacing,
  nodeObstacles,
} from "../utils/canvasLayout";
import type { ReadingMode } from "../utils/readingMode";
import type { AttackIndicator, MapAttack, NodeDoc, NodeType } from "../types";
import { battleTally, healthAt } from "../utils/finish";
import { FinishedBanner } from "../map/FinishedBanner";
import { HistoryPanel } from "../map/HistoryPanel";
import { NodeBurst } from "../map/NodeBurst";
import { mapBackgroundStyle } from "../utils/mapBackground";
import { MoveNoteModal } from "../dashboard/MoveNoteModal";
import { findInbox, noteBranch } from "../utils/inbox";

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
  const desktopLayout = useDesktopLayout();
  // A back swipe / back button doesn't leave the map — only the toolbar's ←
  // does (see useBackGuard).
  useBackGuard();
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
  const reparentMode = mode.kind === "reparent";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The ring of ghosts is up around each node opened; the 👻 on its panel
  // hides it for that node. Opening another node brings them back.
  const [ghostsHiddenFor, setGhostsHiddenFor] = useState<string | null>(null);
  const ghostsHidden = !!selectedId && ghostsHiddenFor === selectedId;
  // The time-lapse (TimeLapseBar): how many nodes, oldest first, are shown,
  // and whether it's playing. `null` when it's off.
  const [timeLapse, setTimeLapse] = useState<{ step: number; playing: boolean } | null>(null);
  // The opponent's turn (SiegePanel) is open — discussion mode only.
  const [siegeOpen, setSiegeOpen] = useState(false);
  // The discussion's history of changes (HistoryPanel) is open.
  const [historyOpen, setHistoryOpen] = useState(false);
  // Every attack on the map, fetched when a replay starts, so the replay can
  // show health as it was at each step (utils/finish.ts healthAt).
  const [replayAttacks, setReplayAttacks] = useState<MapAttack[]>([]);
  // Off by default: a bare click on a node only ever selects it while this
  // is false — onNodePointerDown's single-node mouse drag is gated behind it
  // (see its own comment), so a click never relocates a node by accident.
  // Turning it on is a deliberate act (the toolbar's Move toggle). A finger
  // drags a node either way once it really travels; a tap or a graze below
  // that distance stays a tap.
  // Doesn't touch double-click-to-edit (startInlineEdit) or an
  // already-multi-selected group's own drag — both stay available
  // regardless, since neither one is the "accidental" case this addresses.
  const [moveMode, setMoveMode] = useState(false);
  // The ids the node search currently matches (null = no search): everything else dims.
  const [searchMatches, setSearchMatches] = useState<Set<string> | null>(null);
  // The node types picked in the search (empty = all): nodes of other types dim.
  const [nodeTypeFilter, setNodeTypeFilter] = useState<NodeType[]>([]);
  // This viewer's own view of the map — reading mode, compact view,
  // per-node/per-zone display, block locks, card fills, and where they were on
  // it — kept on the server too, so it follows them to any device. See
  // hooks/useMapViewerPrefs.ts.
  const {
    readingMode,
    storeReadingMode,
    compactView,
    toggleCompactView,
    // "Emoji first" (eye menu) and the viewer's emoji per type — see utils/emojiFace.ts.
    emojiFirst,
    toggleEmojiFirst,
    typeEmoji,
    setTypeEmoji,
    nodeDisplay,
    setNodeDisplay,
    zoneDisplay,
    storeZoneDisplay,
    zoneLayouts,
    setZoneLayout,
    blockLocks,
    toggleBlockLock: toggleStoredBlockLock,
    cardFills,
    setCardFill,
    feelings,
    setFeeling,
    checkIn,
    setCheckIn,
    detachedPieces,
    setPiecesDetached,
    savedView,
    saveView,
  } = useMapViewerPrefs(mapId, !!user && !user.isDemo);
  function setReadingMode(mode: ReadingMode) {
    storeReadingMode(mode);
    if (mode !== "actual") fitZoomForDisplay(effectiveDisplay(), mode);
  }
  // Locking is per piece (right-click, or hold on touch). An assembled puzzle
  // with any piece locked holds still as a whole (see useNodeDragAndDrop).
  function toggleBlockLock(nodeId: string) {
    toggleStoredBlockLock(nodeId);
    // Locking a block mid-edit ends the edit.
    setInlineEditId((cur) => (cur === nodeId ? null : cur));
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
  // The Inbox note whose "Move to a map" picker is open (dashboard/MoveNoteModal).
  const [movingNote, setMovingNote] = useState<NodeDoc | null>(null);
  const [celebrateIds, setCelebrateIds] = useState<Set<string>>(new Set());
  const { shotState, triggerWeaponShot } = useWeaponReplay();
  const [contextMenu, setContextMenu] = useState<{ node: NodeDoc; x: number; y: number } | null>(null);
  // Right-click on *empty* canvas (as opposed to a node — see contextMenu
  // above) — opens a small type-picker for creating a new, parent-less
  // node right where the click landed. Carries both coordinate spaces:
  // screenX/screenY position the fixed-to-viewport menu itself (same as
  // contextMenu's own x/y), canvasX/canvasY (run through screenToCanvas)
  // are where the eventual node actually gets placed.
  // A zone's pattern/colour menu, opened by right-clicking the zone or holding
  // a finger on it (see CanvasBackdrop's onZoneMenu).
  const [zoneMenu, setZoneMenu] = useState<{ rootId: string; x: number; y: number } | null>(null);
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

  // Battle mode needs the server and the other members, so it is off while
  // offline: the map reads as Creating mode until the connection is back.
  const online = useSyncExternalStore(subscribeSyncStatus, () => getSyncStatus().online);
  const discussionOn = map?.discussionMode !== false && online;
  const offlinePausedBattle = map?.discussionMode !== false && !online && !!map;
  useEffect(() => {
    if (offlinePausedBattle) showNotice(t.map.toolbar.discussionOffline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlinePausedBattle]);

  // Choosing ("stabilizing") a circle and letting it go again — see
  // hooks/useChosenCircle.ts.
  const {
    circleLoadingRootId,
    setCircleLoadingRootId,
    releaseChosenCircleIfOutside,
    handleCircleBackdropClick,
  } = useChosenCircle({ mapId, map, applyCircleSelection, setActionError, t });

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
  // Filters packed-away members out of every canvas rendering loop. Packing
  // (packAbl.ts) still exists as a relationship regardless — a container's
  // own count badge, and its "Packed (N)" unpack list in NodePanel, both
  // still work off Node.packedIntoNodeId either way — but a packed member
  // itself is hidden from the canvas. NodePanel still receives plain
  // `nodes` (not this), since it has to show a packed member in its
  // container's own unpack list even though the canvas itself doesn't
  // render it.
  const unpackedNodes = useMemo(() => nodes.filter((n) => !n.packedIntoNodeId), [nodes]);
  // Parents that tuck their branch in, and the overview — see hooks/useAutoPack.ts.
  const { folded, fold, mapParents, toggleFold, overviewOn, setOverview } = useAutoPack(mapId, unpackedNodes);
  // Whether the minimap shows (the view corner's menu) — see utils/minimapPref.ts.
  const [minimapShown, setMinimapShown] = useState<boolean>(loadMinimapShown);
  function toggleMinimap() {
    setMinimapShown((v) => {
      saveMinimapShown(!v);
      return !v;
    });
  }
  const timeLapseNodes = useMemo(() => timeLapseOrder(unpackedNodes), [unpackedNodes]);
  const timeLapseStep = timeLapse ? Math.min(timeLapse.step, timeLapseNodes.length) : null;
  const visibleNodes = useMemo(() => {
    if (timeLapseStep !== null) {
      const shown = new Set(timeLapseNodes.slice(0, timeLapseStep).map((n) => n.nodeId));
      // The fight as it was at the newest node on screen, not as it ended.
      return healthAt(
        unpackedNodes.filter((n) => shown.has(n.nodeId)),
        replayAttacks,
        timeLapseNodes[timeLapseStep - 1]?.createdAt,
      );
    }
    return fold.hidden.size === 0
      ? unpackedNodes
      : unpackedNodes.filter((n) => n.nodeId === selectedId || !fold.hidden.has(n.nodeId));
  }, [unpackedNodes, selectedId, timeLapseNodes, timeLapseStep, replayAttacks, fold]);
  // A node drawn as a puzzle card sits at its own card spot, apart from the
  // icon's — see utils/cardSpace.ts. Worked out from the same display choices
  // modeOf reads below, with zones taken by membership alone (their outline
  // follows these very positions).
  const cardSpace = useMemo(() => {
    const zones =
      Object.keys(zoneDisplay).length > 0
        ? zoneModeByNode(computeNodeGroups(visibleNodes, nodes, new Map()), zoneDisplay)
        : new Map<string, ZoneMode>();
    return cardSpaceIds(nodes, (id) => {
      const zone = zones.get(id);
      return nodeDisplay[id] ?? (zone ? (zone === "dots" ? "actual" : zone) : readingMode);
    });
  }, [nodes, visibleNodes, nodeDisplay, zoneDisplay, readingMode]);
  // Someone else's cards, laid out close in the cards view for this viewer
  // alone (hooks/useCardPacking.ts).
  const [packedCards, setPackedCards] = useState<Map<string, { x: number; y: number }>>(() => new Map());
  useEffect(() => setPackedCards(new Map()), [mapId]);
  const positions = useMemo(
    () => computeBasePositions(withCardSpots(nodes, cardSpace, packedCards)),
    [nodes, cardSpace, packedCards],
  );
  // What saves a move of `node` to `pt`: its card spot or its icon spot.
  function spotFor(node: NodeDoc, pt: { x: number; y: number }) {
    return spotFields(cardSpace.has(node.nodeId), pt);
  }
  // Each node's drift during the map's opening animation — see posFor.
  const introOffset = useIntroMigration(loading ? null : (mapId ?? null), positions);
  // Nodes glide to a changed resting spot instead of jumping — see posFor.
  const glide = usePositionGlide(positions);
  const selectedNode = nodes.find((n) => n.nodeId === selectedId) ?? null;
  // ?node=<id> (a search result on the dashboard): the map opens on that node.
  const [searchParams] = useSearchParams();
  const focusNodeId = searchParams.get("node");
  // NodePanel/PackPickerPanel's bottom sheet physically covers the bottom
  // third (half on mobile) of the screen while it's open. Skipped for the
  // group-selection footer (multiSelectIds), which is a slim bar, not a tall
  // sheet.
  const sheetOpen = chooseMode || packMode || reparentMode || !!pendingCreate || (!!selectedNode && multiSelectIds.size === 0);
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
  } = useCanvasViewport({
    mapId,
    loading,
    sheetOpen,
    positions,
    openAt: focusNodeId ? null : (savedView?.center ?? null),
  });

  // Picking up where you left off — see hooks/useRestoreView.ts.
  useRestoreView({
    mapId,
    loading,
    focusNodeId,
    savedView,
    saveView,
    visibleNodes,
    selectedId,
    setSelectedId,
    centerOnNode,
    centerOnPoint,
    wrapRef,
    screenToCanvas,
  });

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
  const spotlightedSet = useMemo(() => (spotlightedNodeIds ? new Set(spotlightedNodeIds) : null), [spotlightedNodeIds]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.nodeId, n])), [nodes]);

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



  // The selected node's neighbors, ringed round it — see hooks/useRadialFocus.ts.
  const radialBlend = useRadialFocus({
    selectedId,
    multiSelectIds,
    selectionSettled,
    ghostsOnOffer: !!selectedNode && isOwnNode(selectedNode) && !chooseMode && !packMode,
    nodes,
    edges,
    positions,
    settledViewportBounds,
  });

  function posFor(node: NodeDoc) {
    const grouped = groupDragState?.get(node.nodeId);
    if (grouped) return glide.shown(node.nodeId, grouped);
    if (dragState && dragState.nodeId === node.nodeId) return glide.shown(node.nodeId, { x: dragState.x, y: dragState.y });
    // Always the real position, gliding there when it changes, not jumping (see usePositionGlide).
    const stored = glide.shown(
      node.nodeId,
      glide.at(node.nodeId, positions.get(node.nodeId) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 }),
    );
    // The map's opening animation: drifting out and back (useIntroMigration).
    const drift = introOffset(node.nodeId);
    const own = drift ? { x: stored.x + drift.x, y: stored.y + drift.y } : stored;
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
    // A card on the board stays at its own spot among the other cards.
    const radial = cardSpace.has(node.nodeId) ? undefined : radialBlend.map?.get(node.nodeId);
    if (!radial) return own;
    const b = radialBlend.blend;
    return { x: own.x + (radial.x - own.x) * b, y: own.y + (radial.y - own.y) * b };
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
  // Nodes that leave the map pop where they stood — see hooks/useNodeBursts.ts.
  const bursts = useNodeBursts(mapId, nodes, positions);

  // Each zone's corner order from last time — moving one node then moves only
  // its own corner (see computeNodeGroups).
  const zoneCornerOrder = useRef(new Map<string, string[]>());
  const nodeGroups = useMemo(
    () => computeNodeGroups(visibleNodes, nodes, positions, undefined, zoneLayouts, zoneCornerOrder.current),
    [visibleNodes, positions, zoneLayouts],
  );
  // Discussion mode reads the zones as a realm: the kingdom and its castles
  // (utils/siege.ts), named like the zone list names them.
  const holds = useMemo(
    () =>
      holdsOf(
        nodeGroups.map((g) => g.rootId),
        nodes,
      ).map((h) => ({ ...h, name: zoneLabel(nodes.find((n) => n.nodeId === h.rootId)) ?? "" })),
    [nodeGroups, nodes],
  );

  // Zoomed out to 50%: no icons anywhere on the canvas — nodes are plain
  // dots, and the decorations drawn around them (circle-parent rings,
  // weapon marks, quick-add ghosts) are left out too. A hair of slack so a
  // zoom that lands a rounding step off 50% still counts.
  const dotZoom = zoom <= DOT_ZOOM + 0.005;
  // How each node is drawn, by its own, its zone's or the map's look — see
  // hooks/useZoneDisplay.ts.
  const { zoneModes, modeOf, dottedByZone, effectiveDisplay, setZoneMode } = useZoneDisplay({
    nodeGroups,
    zoneDisplay,
    storeZoneDisplay,
    nodeDisplay,
    readingMode,
    fitZoomForDisplay: (display, mode, centerOn) => fitZoomForDisplay(display, mode, centerOn),
  });

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

  // Fetching the text the canvas is about to show — see hooks/useTextBackfill.ts.
  useTextBackfill({
    nodes,
    visibleNodes,
    nodeGroups,
    groupSentimentByNode,
    spotlightedNodeIds,
    selectedId,
    modeOf,
    displayKeys: [readingMode, nodeDisplay, zoneModes],
    ensureNodeText,
    setCircleLoadingRootId,
  });

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

  // Choosing a zone — clicking its parent node, or holding the zone still —
  // turns its emoji cards over one by one, parent first (see useFlipSequence).
  const flipTokens = useFlipSequence(
    selectedId && circleRootSentimentByNode.has(selectedId) ? selectedId : (map?.selectedCircle?.rootId ?? null),
    nodeGroups,
  );

  // Every camera-framing cue (fit-to-zoom for a text reading mode, the
  // floor-at-100%-for-editing after a drag, bringing a set of nodes into
  // view) — see hooks/useCanvasFraming.ts.
  const { fitZoomForDisplay, showPoints, showNodes, setDisplayForChosen, fitAll } = useCanvasFraming({
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

  // Where a new or moved node may go — see hooks/usePlacement.ts.
  const { obstaclePoints, placeNode, bigNodeObstacles } = usePlacement({
    visibleNodes,
    positions,
    nodeGroups,
    zoom,
    viewportBounds,
    zoneLayouts,
    discussionOn,
    userId: user?._id,
  });

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
  // A Success that solved a Problem or reached a goal wears wings and a halo,
  // and every zone it's in gets a gold outline — see computeSolved.
  const solved = useMemo(() => computeSolved(nodes), [nodes]);
  const solvedZones = useMemo(
    () => new Set(nodeGroups.filter((g) => g.members.some((m) => solved.successIds.has(m.nodeId))).map((g) => g.rootId)),
    [nodeGroups, solved],
  );

  // How the map opens (its entrance) and the view it then settles into — see
  // hooks/useMapEntrance.ts.
  const { entranceActive, skipEntrance, view, viewPromptOpen, chooseView, closeViewPrompt } = useMapEntrance({
    mapId,
    loading,
    visibleNodes,
    unpackedCount: unpackedNodes.length,
    zoneRootIds: nodeGroups.map((g) => g.rootId),
    canvasRef,
    readingMode,
    overviewOn,
    setOverview,
    setReadingMode,
  });

  // Whether a node is drawn as a puzzle card right now — the only nodes that
  // snap together (see usePuzzleConnect).
  function drawnAsCard(n: NodeDoc): boolean {
    if (dotZoom || dottedByZone(n.nodeId)) return false;
    const m = modeOf(n.nodeId);
    return m === "puzzle" || (m === "mixed" && circleRootSentimentByNode.has(n.nodeId));
  }
  // A card on the board: drawn in the cards view, in the canvas's own units
  // (see NodeCard's canvasCard) — the only cards that glue together and keep
  // from piling up. A zone parent shown as a card in the mixed view isn't.
  function onCardBoard(n: NodeDoc): boolean {
    return !dotZoom && !dottedByZone(n.nodeId) && modeOf(n.nodeId) === "puzzle";
  }
  // Cards: dragging a link out of a card's handle, gluing cards together and
  // keeping them from piling up — see hooks/usePuzzleConnect.ts.
  const { puzzleConnect, puzzleSnapFor, puzzleClusterFor, linkSnappedPieces, startPuzzleConnect, cardClearSpot, cardBranchSpot } = usePuzzleConnect({
    mapId,
    nodes,
    edges,
    visibleNodes,
    zoom,
    isOwnNode,
    drawnAsCard: onCardBoard,
    posFor,
    screenToCanvas,
    upsertEdge,
    refreshInsights,
    setActionError,
    setContextMenu,
    setPendingLink,
    linkFailedMessage: t.ui.link.failed,
    isDetached: (id) => !!detachedPieces[id],
  });
  // The cards view lays its cards close together, linked by nothing drawn,
  // so they can be read and dragged side by side (hooks/useCardPacking.ts).
  const fitAllLatest = useRef(fitAll);
  fitAllLatest.current = fitAll;
  const cardBoard = useMemo(
    () => new Set(visibleNodes.filter(onCardBoard).map((n) => n.nodeId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCardBoard reads exactly these
    [visibleNodes, dotZoom, nodeDisplay, zoneModes, readingMode],
  );
  const { layCardsClose } = useCardPacking({
    visibleNodes,
    zoom,
    onCardBoard,
    isOwnNode,
    restingSpot: (n) => positions.get(n.nodeId) ?? { x: n.x ?? CANVAS_W / 2, y: n.y ?? CANVAS_H / 2 },
    ready: !loading && !entranceActive && !timeLapse,
    packed: packedCards,
    setPacked: setPackedCards,
    setNodes,
    upsertNode,
    setActionError,
    moveFailedMessage: t.ui.errors.moveNodes,
    // After the cards have glided in, from the newest render's positions.
    onLaidOut: () => setTimeout(() => fitAllLatest.current(), 450),
  });
  // Ungluing cards, on demand from a card's menu: just this one, or every
  // card of its block. An unglued card moves on its own, and dragging it
  // against another card glues it back.
  function detachPieces(ids: string[]) {
    setPiecesDetached(ids, true);
  }
  function attachPiece(nodeId: string) {
    setPiecesDetached([nodeId], false);
  }

  // The node drag/drop system: single-node reposition-or-join-a-circle,
  // group ("follow the leader") drag, and touch's own long-press-to-
  // multiselect disambiguation — see hooks/useNodeDragAndDrop.ts.
  // Undo for moves: each drag records where its nodes were; Ctrl+Z (or the
  // toolbar's undo button) puts the last one back.
  const { recordMove, recordUndo, undo: undoMove, canUndo } = useMoveUndo({
    nodes,
    upsertNode,
    setActionError,
    errorMessage: t.ui.errors.moveNodes,
    keysEnabled: !presenting && !drawMode,
  });
  const { onNodePointerDown, magnetize, redirectParent, saveHeadPlan, dragState, groupDragState, dropTarget } = useNodeDragAndDrop({
    nodes,
    positions,
    nodeGroups,
    chooseMode,
    // Changing a parent takes taps, like packing: no node drags meanwhile.
    packMode: packMode || reparentMode,
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
    footprintScale: freeFootprintScale(zoom),
    upsertNode,
    setActionError,
    setNodes,
    setSelectedId,
    setMultiSelectIds,
    suppressNextClick,
    t,
    spotFor,
    snapFor: puzzleSnapFor,
    clearSpotFor: cardClearSpot,
    // A piece clicked into another is in a puzzle again, detached or not.
    onSnapped: (node, snap) => {
      if (detachedPieces[node.nodeId]) attachPiece(node.nodeId);
      linkSnappedPieces(node, snap);
    },
    clusterFor: puzzleClusterFor,
    // Holding one of your puzzle cards opens its menu (lock, detach…) — the
    // touch counterpart of right-clicking it.
    onHold: (node, clientX, clientY) => {
      if (!isOwnNode(node) || !drawnAsCard(node)) return false;
      suppressNextClick.current = true;
      setSelectedId(node.nodeId);
      setContextMenu({ node, x: clientX, y: clientY });
      return true;
    },
    isBlockLocked: (id) => !!blockLocks[id],
    recordMove,
  });

  // Changing a parent, and swapping a child with its parent — see
  // hooks/useReparent.ts.
  const { reparentChild, reparentError, startReparent, pickNewParent, headZone } = useReparent({
    mapId,
    mode,
    dispatchMode,
    nodes,
    edges,
    isOwnNode,
    posFor,
    redirectParent,
    saveHeadPlan,
    setEdges,
    upsertEdge,
    refreshInsights,
    setActionError,
    setContextMenu,
    setSelectedId,
    setMultiSelectIds,
    t,
  });

  // Same condition that gates the quick-add ghost ring below — reused
  // higher up (chosenNodeIds' own muted computation) so every other node
  // dims while it's showing, putting the focus on the selected node and its
  // type-to-create options instead of competing with the rest of the
  // canvas. selectionSettled: the ghosts (and the dimming that comes with
  // them) wait until centerOnNode's own pan has landed — see its own doc
  // comment.
  // Not around a card on the board: a card has its own place among the
  // other cards, and the ghost ring would only sit on top of them.
  const quickAddActive =
    !!(selectedNode && isOwnNode(selectedNode) && !chooseMode && !packMode && !dragState && !onCardBoard(selectedNode)) &&
    selectionSettled &&
    !ghostsHidden;

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
  // This map is the user's Inbox (utils/inbox.ts): its notes offer "Move to a map".
  const isInboxMap = !!map && !!user && findInbox([map], user._id, t.dashboard.quickNote.inboxName)?.mapId === map.mapId;

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
  // attackAbl.ts), not which nodes may be attacked. A Personal map has no
  // attacks at all (the owner can switch it back to Discussion for that).
  function canAttackNode(_node: NodeDoc) {
    return discussionOn;
  }

  // Single entry point for "start editing this node's text/type inline, on
  // its own icon" — always selects (so the side panel shows something,
  // including the locked message when editing isn't allowed), but only
  // actually turns the inline input on when canEditNode agrees. Reached from
  // a node double-click and the side panel's own Edit button. The context
  // menu's own "Edit" item is a different, separate action now — it just
  // opens the panel (see handleNodeClick below), not this inline editor.
  // Editing opens the node's panel on its text field (NodePanel's
  // autoFocusText), the same place a new node is written — not an inline
  // input under the icon any more.
  async function startInlineEdit(node: NodeDoc) {
    setContextMenu(null);
    setPendingCreate(null);
    if (multiSelectIds.size > 0) setMultiSelectIds(new Set());
    setSelectedId(node.nodeId);
    centerOnNode(node.nodeId);
    if (!canEditNode(node)) return;
    await ensureNodeText([node.nodeId]);
    setFocusTextNodeId(node.nodeId);
  }

  function handleNodeClick(node: NodeDoc, shiftKey = false) {
    setContextMenu(null);
    // The time-lapse is only for watching; its nodes can't be opened.
    if (timeLapse) return;
    // While drawing a line a node is just something in the way (a click on it
    // can't place a point) — it isn't selected.
    if (drawMode) return;
    if (reparentMode) {
      pickNewParent(node);
      return;
    }
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
    // While reading (any view but the default icons), a node with pictures
    // shows them first; closing them opens its panel (closePictureView).
    if (modeOf(node.nodeId) !== "actual" && node.nodeId !== selectedId && hasPictures(node)) {
      openPictureView(node);
      return;
    }
    selectNodeFromClick(node);
  }

  // Replaying the map from its first node — see hooks/useTimeLapse.ts.
  const { startTimeLapse, onTimeLapseStep, togglePlay, stepTimeLapse } = useTimeLapse({
    mapId,
    timeLapse,
    setTimeLapse,
    timeLapseNodes,
    timeLapseStep,
    discussionOn,
    setReplayAttacks,
    positions,
    zoom,
    zoomFromCenter,
    centerOnPoint,
    showPoints,
    onStart: () => {
      setSelectedId(null);
      setMultiSelectIds(new Set());
      clearPictureView();
      setSiegeOpen(false);
    },
  });

  // Reads the map node by node (utils/nodeOrder.ts readingOrder): from the
  // open node to the one before or after it, or, with none open, from the
  // first (→) or last (←) node. The panel's arrows and the keyboard's ← / →
  // both land here; only the text field's own arrows move focus into the
  // next node's text.
  function stepReading(dir: -1 | 1, focusText = true) {
    if (timeLapse) {
      // In the time-lapse the arrows step it instead, one node at a time.
      stepTimeLapse(dir);
      return;
    }
    const order = readingOrder(visibleNodes);
    const next = selectedId ? stepNode(visibleNodes, selectedId, dir) : (dir === 1 ? order[0] : order[order.length - 1])?.nodeId;
    if (!next) return;
    clearPictureView();
    setSteppedToId(next);
    setSelectedId(next);
    centerOnNode(next);
    if (focusText) setFocusTextNodeId(next);
  }

  // A node's pictures, full size before its panel — see hooks/usePictureView.ts.
  const { pictureView, openPictureView, closePictureView, clearPictureView } = usePictureView(nodes, selectNodeFromClick);

  function selectNodeFromClick(node: NodeDoc) {
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

  // A node's type, shape and card look, a zone's pattern and colour — see
  // hooks/useNodeStyling.ts.
  const { handleChangeNodeType, setZoneStyle, zoneStyleFor, saveCardLook, zoneActionsFor, zoneNameChips } = useNodeStyling({
    nodes,
    nodeGroups,
    isOwnNode,
    setNodes,
    upsertNode,
    setActionError,
    copyText: (ids) => void copySelectionAsText(ids),
    deleteNodes: (ids) => void deleteSelection(ids),
    t,
  });

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

  // Choosing nodes for the group bar — see hooks/useChooseMode.ts.
  const { branchIds, startChooseFrom, exitChooseMode, linkSelection } = useChooseMode({
    nodes,
    visibleNodes,
    isOwnNode,
    multiSelectIds,
    setMultiSelectIds,
    setSelectedId,
    dispatchMode,
    setPendingLink,
  });

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

  // An attack landed, from a node's panel or the opponent's turn.
  function applyAttack(target: NodeDoc, weaponNode: NodeDoc, healedParent?: NodeDoc | null, protector?: NodeDoc | null) {
    upsertNode(target);
    upsertNode(weaponNode);
    // Set only on a landed retaliation — see attackAbl.ts's own healedParent doc comment.
    if (healedParent) upsertNode(healedParent);
    // Set only when blocked — the protector's own updated blockedDamage (see attackAbl.ts).
    if (protector) upsertNode(protector);
    // Weapon nodes never got the "just created" flourish other nodes get —
    // this is what NodeCard reads to fly the weapon in at the target.
    setCelebrateIds((prev) => new Set(prev).add(weaponNode.nodeId));
    if (mapId) refreshInsights(mapId);
  }

  // Deleting a node, undoable — see hooks/useNodeDelete.ts.
  const { deleteNodeWithUndo, handleDeleteNode } = useNodeDelete({
    mapId,
    nodes,
    edges,
    isOwnNode,
    setNodes,
    setEdges,
    upsertNode,
    setSelectedId,
    setCelebrateIds,
    setActionError,
    showNotice,
    refreshInsights,
    recordUndo,
    t,
  });

  // Taking a node's links apart from its menu — see hooks/useNodeLinks.ts.
  const { linkLabel, nodeLinkActions, runUnlinks, nodeLinkItems } = useNodeLinks({
    mapId,
    nodes,
    edges,
    isOwnNode,
    upsertNode,
    setEdges,
    setActionError,
    refreshInsights,
    t,
  });

  // Starting a new node from the canvas — see hooks/useQuickAdd.ts.
  const { startQuickAdd, addBranchFromCard, sketchBranch, startBranchOf, startNodeAt, startCreateNodeInView } = useQuickAdd({
    mapId,
    emojiFirst,
    placeNode,
    posFor,
    cardBranchSpot,
    viewportBounds,
    setInlineEditId,
    setPendingCreate,
    upsertNode,
    setCelebrateIds,
    setActionError,
    t,
  });

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
  // A node just made through the inline input: its panel opens focused on
  // the text (see NodePanel's autoFocusText) — cleared once that's done.
  const [focusTextNodeId, setFocusTextNodeId] = useState<string | null>(null);
  // The node the ← / → arrows last stepped to: its panel opens on Info, even
  // for an attack on your own node (which otherwise opens on Attack).
  const [steppedToId, setSteppedToId] = useState<string | null>(null);
  // A node being made is brought to the middle of the screen below its panel,
  // with the emoji ring around it.
  useEffect(() => {
    if (pendingCreate) centerOnPoint(pendingCreate.x, pendingCreate.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCreate?.x, pendingCreate?.y]);
  // "Text → nodes" (canvas right-click menu): where on the canvas it was asked for.
  const [textNodesAt, setTextNodesAt] = useState<{ x: number; y: number } | null>(null);
  const { confirmPendingCreate, applyTemplate, createCircle, growStructure, createFromText } = useNodeCreation({
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
    onCreated: () => {
      setMultiSelectIds(new Set());
      setSelectedId(null);
    },
    t,
  });

  // The map's mode and background, finishing the discussion, deleting the map
  // — see hooks/useMapControls.ts.
  const { isOwner, toggleMapMode, setMapBackground, deleteThisMap, exitDemo, finish } = useMapControls({
    map,
    setMap,
    nodes,
    userId: user?._id,
    online,
    discussionOn,
    setActionError,
    setSiegeOpen,
    logout,
    t,
  });

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
    onImagePasteWithoutNode: () => showNotice(t.ui.images.selectNode),
    // Your own chosen nodes; a single node goes the way its panel's Delete does (undoable).
    deleteSelection: () => {
      if (multiSelectIds.size > 0) {
        const own = nodes.filter((n) => multiSelectIds.has(n.nodeId) && isOwnNode(n)).map((n) => n.nodeId);
        if (own.length > 0) void deleteSelection(own);
        return;
      }
      if (selectedNode && isOwnNode(selectedNode)) void handleDeleteNode(selectedNode);
    },
    stepReading: (dir) => stepReading(dir, false),
  });

  // Selecting any other node, by a tap, ends the arrows' step.
  useEffect(() => {
    if (steppedToId && selectedId !== steppedToId) setSteppedToId(null);
  }, [selectedId, steppedToId]);
  // Pac-Man runs of strong attacks — see hooks/useChompRuns.ts.
  const { chompSpots, chompMoves, hoverChomp } = useChompRuns({
    visibleNodes,
    selectedId,
    steppedToId,
    dotZoom,
    zoom,
    compact: compactView,
    isCircleParent: (id) => circleRootSentimentByNode.has(id),
    posFor,
  });

  // What a card on the canvas does when used: one stable object for every
  // card, so CanvasNodeCard only re-renders when its own node changed.
  const nodeActions = useStableActions<CanvasNodeActions>({
    inlineConfirm: (node, text, type) => void confirmInlineEdit(node, text, type),
    inlineCancel: () => setInlineEditId(null),
    pointerDown: (node, e) => onNodePointerDown(node, e),
    click: (node, e) => {
      if (suppressNextClick.current) {
        suppressNextClick.current = false;
        return;
      }
      handleNodeClick(node, e.shiftKey);
    },
    doubleClick: (node) => startInlineEdit(node),
    contextMenu: (node, e) => handleNodeContextMenu(node, e),
    resize: (node, size) => void saveCardLook(node, { cardW: size.w, cardH: size.h }),
    toggleBlockLock: (nodeId) => toggleBlockLock(nodeId),
    connectStart: (node, e) => startPuzzleConnect(node, e),
    addBranch: (node) => addBranchFromCard(node),
    hoverText: (nodeId) => void ensureNodeText([nodeId]),
    iconHover: (nodeId, on) => hoverChomp(nodeId, on),
    unfold: (nodeId) => toggleFold(nodeId),
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
        {!user?.isDemo && (
          <Link to="/" replace>
            &larr; {t.map.toolbar.back}
          </Link>
        )}
      </div>
    );
  }

  const isDiscussionMode = discussionOn;
  const canvasBackground = mapBackgroundStyle(map.background);
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
      spotlightedSet?.has(n.nodeId) ||
      inlineEditId === n.nodeId ||
      nodeDragged(n)
    );
  };
  const hiddenChildCaptionIds = hiddenChildCaptions(visibleNodes, parentIds, {
    posFor,
    isCircleParent: (id) => circleRootSentimentByNode.has(id),
    modeOf,
    dottedByZone,
    compact: compactView,
    zoom,
    selectedId,
    inlineEditId,
  });

  // The map's toolbar: a floating top-left cluster, or in computer mode a
  // panel docked down the left edge, like a desktop's taskbar / main menu
  // (see hooks/useDesktopLayout.ts).
  const renderToolbar = (vertical: boolean) => (
    <MapToolbar
      vertical={vertical}
      isDemo={!!user?.isDemo}
      isOwner={isOwner}
      isDiscussionMode={isDiscussionMode}
      offline={!online}
      expanded={!quickAddActive || forceShowToolbar}
      onExpand={() => setForceShowToolbar(true)}
      moveMode={moveMode}
      onToggleMove={() => setMoveMode((v) => !v)}
      drawMode={drawMode}
      onToggleDraw={toggleDrawMode}
      compact={compactView}
      onToggleCompact={toggleCompactView}
      emojiFirst={emojiFirst}
      onToggleEmojiFirst={toggleEmojiFirst}
      typeEmoji={typeEmoji}
      onTypeEmoji={setTypeEmoji}
      zoneLayout={zoneLayouts[MAP_ZONE_KEY] ?? "zones"}
      onPickZoneLayout={(layout) => setZoneLayout(MAP_ZONE_KEY, layout === "zones" ? null : layout)}
      background={map.background}
      onPickBackground={isOwner ? setMapBackground : undefined}
      nodes={visibleNodes}
      onLoadTexts={async () => {
        await ensureNodeText(visibleNodes.map((n) => n.nodeId));
      }}
      onSearchMatches={setSearchMatches}
      nodeTypeFilter={nodeTypeFilter}
      onNodeTypeFilter={setNodeTypeFilter}
      onPickSearchResult={(id) => {
        setSelectedId(id);
        centerOnNode(id);
      }}
      onToggleMapMode={toggleMapMode}
      finish={
        finish.isFinished || (!isOwner && finish.otherCount === 0)
          ? undefined
          : { title: finish.title, pressed: !isOwner && finish.iAgreed, muted: isOwner && !finish.allowed, onClick: finish.press }
      }
      onHistory={() => {
        setSelectedId(null);
        setSiegeOpen(false);
        setHistoryOpen(true);
      }}
      onOpponentTurn={finish.isFinished ? undefined : () => {
        setSelectedId(null);
        setHistoryOpen(false);
        setSiegeOpen(true);
      }}
      onExitDemo={exitDemo}
      onInvite={() => setShowInvite(true)}
      onCreateNode={startCreateNodeInView}
      onCreateCircle={createCircle}
      onCopyMap={copyWholeMap}
      onPaste={() => pasteClipboard()}
      onExportText={openExportText}
      onDeleteMap={deleteThisMap}
      canUndo={canUndo}
      onUndo={() => void undoMove()}
      onTimeLapse={startTimeLapse}
      onPresent={enterPresentation}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {notice && <MapBanner tone="success" message={notice} onDismiss={dismissNotice} />}
      {actionError && <MapBanner tone="danger" message={actionError} onDismiss={() => setActionError(null)} />}
      {finish.isFinished && !timeLapse && (
        <FinishedBanner {...battleTally(nodes)} onReplay={startTimeLapse} onReopen={finish.reopen} busy={finish.busy} />
      )}
      {mapId && !timeLapse && <CheckInPrompt key={mapId} mapId={mapId} checkIn={checkIn} finished={finish.isFinished} onSave={setCheckIn} />}

      <div className="flex min-h-0 flex-1">
        {desktopLayout && !presenting && renderToolbar(true)}
        {/* This extra wrapper exists purely so MiniMap has somewhere to sit
            that's positioned relative to the *viewport* (this flex cell)
            rather than the scrolling canvas itself — an absolutely
            positioned child of wrapRef would scroll away with the canvas
            content, same as everything else inside it. */}
        <div className="relative min-w-0 flex-1">
          <CanvasFrame
            wrapRef={wrapRef}
            canvasRef={canvasRef}
            zoom={zoom}
            hScrollMargin={hScrollMargin}
            vScrollMargin={vScrollMargin}
            vScrollMarginBottom={vScrollMarginBottom}
            background={canvasBackground}
            crosshair={chooseMode || packMode || reparentMode}
            // A tap on the blind zone around the canvas is outside the node
            // panel too — closes it, same as empty canvas.
            onBlindZoneClick={() => {
              if (!drawMode && !chooseMode && !packMode) setSelectedId(null);
            }}
            // Any press anywhere on the canvas cuts the entrance short.
            onAnyPress={skipEntrance}
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
              if (packMode || reparentMode) return;
              setSelectedId(null);
              setMultiSelectIds(new Set());
              releaseChosenCircleIfOutside();
            }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={drawMode ? onDrawPointerMove : undefined}
            onContextMenu={onCanvasContextMenu}
          >
            <CanvasBackdrop
              onZoneMenu={(rootId, x, y) => {
                setContextMenu(null);
                setCanvasContextMenu(null);
                setZoneMenu({ rootId, x, y });
              }}
              nodeGroups={nodeGroups}
              selectedCircle={map?.selectedCircle}
              focusedZones={activeFocusedZones}
              visibleNodes={visibleNodes}
              edges={edges}
              posFor={posFor}
              circleRootSentimentByNode={circleRootSentimentByNode}
              linkCycles={linkCycles}
              chosenNodeIds={chosenNodeIds}
              // The node whose parent is changing stays ringed while the new one is picked.
              pendingLink={reparentChild ? [reparentChild] : pendingLink}
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
                // With a node's panel open, a tap on a zone is a tap outside
                // the panel: it closes it, same as empty canvas, instead of
                // also stabilizing the zone underneath.
                if (selectedId) {
                  setSelectedId(null);
                  return;
                }
                handleCircleBackdropClick(rootId);
              }}
              lines={lines}
              canDeleteLine={canDeleteLine}
              // With a node's panel open, a tap on a separator line is a tap
              // outside the panel too: it closes it rather than offering to
              // delete the line.
              onLineClick={(line) => (selectedId ? setSelectedId(null) : handleLineClick(line))}
              interactive={!drawMode}
              compact={compactView || dotZoom}
              solvedZones={solvedZones}
              walls={isDiscussionMode}
              realmBorders
              cardBoard={cardBoard}
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

            {bursts.map((b) => (
              <NodeBurst key={b.id} x={b.x} y={b.y} boom={b.boom} />
            ))}

            {visibleNodes.map((node) => {
              const pos = posFor(node);
              const editingThis = inlineEditId === node.nodeId;
              // Weapon nodes only: fly in from away from their target — see
              // weaponFlightVector.
              let flightVector: { x: number; y: number } | undefined;
              if (node.isWeapon) {
                const targetId = nodeRefId(node.targetNodeId);
                const target = targetId ? nodeById.get(targetId) : undefined;
                if (target) flightVector = weaponFlightVector(pos, posFor(target));
              }
              return (
                <CanvasNodeCard
                  key={node.nodeId}
                  node={node}
                  emojiFirst={emojiFirst}
                  typeEmoji={typeEmoji}
                  flipToken={flipTokens.get(node.nodeId)}
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
                  inChosenCircle={!!spotlightedSet?.has(node.nodeId)}
                  indicator={indicatorByNode.get(node.nodeId)}
                  packedCount={packedCountByContainer.get(node.nodeId)}
                  foldedCount={fold.counts.get(node.nodeId)}
                  unsolved={unsolvedProblemIds.has(node.nodeId)}
                  triumphant={solved.successIds.has(node.nodeId)}
                  chooseModeActive={chooseMode}
                  readingMode={modeOf(node.nodeId)}
                  compact={compactView}
                  hiddenBranch={hiddenBranchIds.has(node.nodeId)}
                  discussionMode={isDiscussionMode}
                  celebrate={celebrateIds.has(node.nodeId)}
                  flightX={flightVector?.x}
                  flightY={flightVector?.y}
                  muted={
                    ((quickAddActive && !dotZoom && node.nodeId !== selectedId) ||
                      (!!spotlightedSet && !spotlightedSet.has(node.nodeId)) ||
                      (!chooseMode && multiSelectIds.size > 0 && !multiSelectIds.has(node.nodeId)) ||
                      (!!searchMatches && !searchMatches.has(node.nodeId)) ||
                      (nodeTypeFilter.length > 0 && !nodeTypeFilter.includes(node.type))) &&
                    !unmutedAttackNodeIds?.has(node.nodeId)
                  }
                  isParent={parentIds.has(node.nodeId)}
                  // Cards on the board all read alike, to be compared.
                  quiet={
                    !cardBoard.has(node.nodeId) &&
                    (childIsQuiet(node) || (zoneMutedIds.has(node.nodeId) && selectedId !== node.nodeId))
                  }
                  hideCaption={hiddenChildCaptionIds.has(node.nodeId) && inlineEditId !== node.nodeId}
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
                  actions={nodeActions}
                  canResize={canEditNode(node)}
                  cardFill={cardFills[node.nodeId]}
                  feeling={node.isWeapon ? undefined : feelings[node.nodeId]}
                  dotted={dotZoom || dottedByZone(node.nodeId)}
                  blockLocked={!!blockLocks[node.nodeId]}
                  canToggleLock={isOwnNode(node)}
                  canConnect={isOwnNode(node) && !drawMode}
                  canAddBranch={
                    node.nodeId === selectedId &&
                    isOwnNode(node) &&
                    onCardBoard(node) &&
                    !chooseMode &&
                    !packMode &&
                    !drawMode &&
                    !pendingCreate &&
                    !inlineEditId
                  }
                  canChomp={chompSpots.has(node.nodeId)}
                  chomp={chompMoves.get(node.nodeId)}
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

            {/* Hidden while a branch is being redirected: the finger is
                looking for a node, and a ghost under it would catch the drop. */}
            {quickAddActive && !dotZoom && selectedNode && !pendingCreate && !inlineEditId && (
              <QuickAddGhosts
                // A fresh round of ghosts for each node, and when the emoji-first order changes.
                key={`${selectedNode.nodeId}:${emojiFirst}`}
                anchorPos={posFor(selectedNode)}
                bounds={settledViewportBounds()}
                compact={compactView || !isDiscussionMode}
                zoom={zoom}
                emojiFirst={emojiFirst}
                onPick={(type, pos, text, emoji) => startQuickAdd(type, pos, selectedNode, text, emoji)}
                onSketch={canEditNode(selectedNode) ? (type, pos) => void sketchBranch(type, pos, selectedNode) : undefined}
              />
            )}

            {!loading && nodes.length === 0 && !pendingCreate && !drawMode && (
              <QuickAddGhosts
                key={`intro:${emojiFirst}`}
                intro
                compact={compactView || !isDiscussionMode}
                zoom={zoom}
                anchorPos={{ x: CANVAS_W / 2, y: CANVAS_H / 2 }}
                // No bounds to squeeze the ring into: the view opens centered
                // on this point, so a full round ring fits.
                bounds={{ minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity }}
                emojiFirst={emojiFirst}
                onPick={(type, pos, text, emoji) => {
                  setActionError(null);
                  setPendingCreate({ x: pos.x, y: pos.y, type, parentId: null, prompt: text, emoji: emojiFirst ? (emoji ?? "") : undefined });
                }}
              />
            )}

            {pendingCreate && pendingCreate.emoji === undefined && !dotZoom && (
              // The feelings, offered around the node being made — optional:
              // writing the text straight away makes it without one.
              <QuickAddGhosts
                key={`emoji:${pendingCreate.x}:${pendingCreate.y}`}
                anchorPos={{ x: pendingCreate.x, y: pendingCreate.y }}
                bounds={settledViewportBounds()}
                compact={compactView || !isDiscussionMode}
                zoom={zoom}
                onPick={() => {}}
                onPickEmoji={(emoji) => setPendingCreate((prev) => (prev ? { ...prev, emoji } : prev))}
              />
            )}

            {pendingCreate && (
              <PendingNodeCard
                // The text is written in NewNodePanel; this is its marker.
                iconOnly
                x={pendingCreate.x}
                y={pendingCreate.y}
                type={pendingCreate.type}
                emoji={pendingCreate.emoji || undefined}
                zoom={zoom}
                onConfirm={confirmPendingCreate}
                onCancel={() => setPendingCreate(null)}
                // Keeps pendingCreate.type in sync with whichever type is
                // currently armed in the card, live.
                onTypeChange={(draftType) =>
                  setPendingCreate((prev) => (prev ? { ...prev, type: draftType } : prev))
                }
              />
            )}

            {/* Rubber-band select rectangle — see useMarqueeSelect. */}
            {marquee && <MarqueeRect marquee={marquee} />}
          </CanvasFrame>
          {/* All of this is normal editing chrome — replaced outright by
              PresentationOverlay below while presenting, not just dimmed
              underneath it, same "swap the slot, don't hide-under" approach
              the pack/choose/draw bottom-sheet ternary just below already
              uses for NodePanel. */}
          {!presenting && (
            <>
              {!loading && <GestureHint />}
              <ViewCorner
                minimapShown={minimapShown}
                onToggleMinimap={toggleMinimap}
                view={view}
                onViewChange={chooseView}
                onLayCardsClose={layCardsClose}
              />
              {viewPromptOpen && (
                <ViewPrompt
                  view={view}
                  onChoose={chooseView}
                  onClose={closeViewPrompt}
                />
              )}
              {minimapShown && (
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
              )}

              <ZoneNames
                wrapRef={wrapRef}
                zones={zoneNameChips()}
                positions={positions}
                zoom={zoom}
                hScrollMargin={hScrollMargin}
                vScrollMargin={vScrollMargin}
                // Centers the view on the whole zone (zooming out only if it
                // doesn't fit), without selecting anything.
                modes={zoneDisplay}
                onSetMode={setZoneMode}
                layouts={zoneLayouts}
                onSetLayout={setZoneLayout}
                onSetStyle={setZoneStyle}
                onGo={(rootId) => {
                  const group = nodeGroups.find((g) => g.rootId === rootId);
                  if (!group) return;
                  const pts = [group.rootId, ...group.members.map((m) => m.nodeId)]
                    .map((id) => positions.get(id))
                    .filter((p): p is { x: number; y: number } => !!p);
                  showPoints(pts, { aboveSheet: false });
                }}
              />

              {!desktopLayout && renderToolbar(false)}

              <ZoomControls
                zoom={zoom}
                onZoomOut={() => zoomFromCenter(-ZOOM_STEP)}
                onZoomIn={() => zoomFromCenter(ZOOM_STEP)}
                onReset={() => zoomFromCenter(0, 1)}
                onFit={fitAll}
                minimapShown={minimapShown}
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
        {timeLapse && timeLapseStep !== null ? (
          <TimeLapseBar
            step={timeLapseStep}
            total={timeLapseNodes.length}
            playing={timeLapse.playing && timeLapseStep < timeLapseNodes.length}
            at={timeLapseNodes[timeLapseStep - 1]?.createdAt}
            onStep={onTimeLapseStep}
            onTogglePlay={togglePlay}
            onExit={() => setTimeLapse(null)}
          />
        ) : historyOpen && isDiscussionMode && mapId ? (
          <HistoryPanel
            mapId={mapId}
            liveIds={new Set(nodes.map((n) => n.nodeId))}
            onShow={centerOnNode}
            onExit={() => setHistoryOpen(false)}
          />
        ) : siegeOpen && isDiscussionMode && !finish.isFinished ? (
          <SiegePanel
            holds={holds}
            nodes={nodes}
            onAttacked={(res) => applyAttack(res.node, res.weaponNode, res.healedParent, res.protector)}
            onProtected={(res) => {
              upsertNode(res.protectionNode);
              upsertNode(res.healedNode);
            }}
            onFocus={centerOnNode}
            onStrikeBack={(id) => {
              setSiegeOpen(false);
              setSelectedId(id);
              centerOnNode(id);
            }}
            onExit={() => setSiegeOpen(false)}
          />
        ) : drawMode ? (
          <DrawLineBar
            pointCount={drawPoints.length}
            blocked={drawBlocked}
            saving={drawSaving}
            onUndo={undoDrawPoint}
            onFinish={finishLine}
            onExit={exitDrawMode}
          />
        ) : reparentChild ? (
          <ReparentBar
            childName={linkLabel(reparentChild.nodeId)}
            error={reparentError}
            onCancel={() => dispatchMode({ type: "reset" })}
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
            onCopyText={() => void copySelectionAsText()}
            onGroupCircle={groupSelectionIntoCircle}
            onDelete={() => void deleteSelection()}
            onDone={exitChooseMode}
          />
        ) : pendingCreate && !presenting ? (
          // A node being made is written in its own top sheet, text field first.
          <NewNodePanel
            key={`${pendingCreate.x}:${pendingCreate.y}`}
            type={pendingCreate.type}
            emoji={pendingCreate.emoji || undefined}
            prompt={pendingCreate.prompt}
            onTypeChange={(type) => setPendingCreate((prev) => (prev ? { ...prev, type } : prev))}
            onClearEmoji={() => setPendingCreate((prev) => (prev ? { ...prev, emoji: "" } : prev))}
            onCreate={(text, type, images, prompt) => confirmPendingCreate(text, type, images, prompt)}
            onCancel={() => setPendingCreate(null)}
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
                autoFocusText={focusTextNodeId === selectedNode.nodeId}
                onAutoFocused={() => setFocusTextNodeId(null)}
                onToggleLock={isOwnNode(selectedNode) ? () => toggleBlockLock(selectedNode.nodeId) : undefined}
                // The parent's magnet: calls its own far nodes back in (utils/parentMagnet.ts).
                // Change parent: pick the node to hang this one from (reparent mode).
                onChangeParent={isOwnNode(selectedNode) ? () => startReparent(selectedNode) : undefined}
                // Swap with parent: the child takes its parent's place as head of the zone.
                onSwapWithParent={
                  isOwnNode(selectedNode) && zoneParentId(selectedNode) ? () => void headZone(selectedNode) : undefined
                }
                // Move to a map: only on the Inbox, where quick notes wait to be sorted.
                onMoveToMap={
                  isInboxMap && isOwnNode(selectedNode) && !selectedNode.isWeapon && !selectedNode.isProtection
                    ? () => setMovingNote(selectedNode)
                    : undefined
                }
                onAutoPack={mapParents.has(selectedNode.nodeId) ? () => toggleFold(selectedNode.nodeId) : undefined}
                autoPacked={folded.has(selectedNode.nodeId)}
                ghostsHidden={ghostsHidden}
                onToggleGhosts={
                  isOwnNode(selectedNode) && !onCardBoard(selectedNode)
                    ? () => setGhostsHiddenFor(ghostsHidden ? null : selectedNode.nodeId)
                    : undefined
                }
                onMagnet={
                  nodes.some((n) => !n.isWeapon && zoneParentId(n) === selectedNode.nodeId && isOwnNode(n))
                    ? () => magnetize(selectedNode)
                    : undefined
                }
                feeling={
                  selectedNode.isWeapon
                    ? null
                    : { value: feelings[selectedNode.nodeId], onChange: (f) => setFeeling(selectedNode.nodeId, f) }
                }
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
                cardLook={
                  onCardBoard(selectedNode) && canEditNode(selectedNode)
                    ? {
                        font: selectedNode.cardFont ?? null,
                        shape: selectedNode.cardShape ?? null,
                        sized: selectedNode.cardW != null || selectedNode.cardH != null,
                        onChange: (patch) => void saveCardLook(selectedNode, patch),
                      }
                    : null
                }
                nodes={nodes}
                edges={edges}
                currentUserId={user._id}
                discussionMode={isDiscussionMode}
                isMapOwner={isOwner}
                onApplyTemplate={(kind) => applyTemplate(kind, selectedNode)}
                onClose={() => setSelectedId(null)}
                onStepNode={stepReading}
                stepped={steppedToId === selectedNode.nodeId}
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
                onDelete={deleteNodeWithUndo}
                onUpdated={upsertNode}
                onAttacked={(updatedNode, weaponNode, _weapon, healedParent, _blocked, protector) =>
                  applyAttack(updatedNode, weaponNode, healedParent, protector)
                }
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

      {movingNote && map && (
        <MoveNoteModal
          inboxId={map.mapId}
          noteId={movingNote.nodeId}
          noteText={movingNote.text}
          onClose={() => setMovingNote(null)}
          onMoved={(target) => {
            const gone = new Set(noteBranch(nodes, movingNote.nodeId));
            setNodes((prev) => prev.filter((n) => !gone.has(n.nodeId)));
            setEdges((prev) => prev.filter((e) => !gone.has(nodeRefId(e.fromNodeId) ?? "") && !gone.has(nodeRefId(e.toNodeId) ?? "")));
            setSelectedId(null);
            setMovingNote(null);
            showNotice(t.ui.inbox.moved(target.name));
          }}
        />
      )}

      {pictureView && <PictureViewer key={pictureView.nodeId} images={pictureView.images} onClose={closePictureView} />}

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
          puzzle={
            isOwnNode(contextMenu.node) && drawnAsCard(contextMenu.node)
              ? {
                  detached: !!detachedPieces[contextMenu.node.nodeId],
                  assembled: puzzleClusterFor(contextMenu.node).length > 1,
                  onDetach: () => detachPieces([contextMenu.node.nodeId]),
                  onTakeApart: () => detachPieces(puzzleClusterFor(contextMenu.node)),
                  onAttach: () => attachPiece(contextMenu.node.nodeId),
                }
              : undefined
          }
          nodeType={contextMenu.node.type}
          links={isOwnNode(contextMenu.node) ? nodeLinkItems(contextMenu.node) : undefined}
          onRemoveAllLinks={() => void runUnlinks(nodeLinkActions(contextMenu.node))}
          zoneLayout={
            nodes.some((n) => nodeRefId(n.parentId) === contextMenu.node.nodeId)
              ? {
                  value: zoneLayouts[contextMenu.node.nodeId] ?? null,
                  onPick: (layout) => setZoneLayout(contextMenu.node.nodeId, layout),
                }
              : undefined
          }
          zoneStyle={
            zoneStyleFor(contextMenu.node.nodeId) && {
              ...zoneStyleFor(contextMenu.node.nodeId)!,
              onChange: (patch) => setZoneStyle(contextMenu.node.nodeId, patch),
            }
          }
          // A zone's parent: how this viewer reads its zone, same as the zone's own menu.
          zoneView={
            nodeGroups.some((g) => g.rootId === contextMenu.node.nodeId)
              ? { value: zoneDisplay[contextMenu.node.nodeId] ?? null, onPick: (m) => setZoneMode(contextMenu.node.nodeId, m) }
              : undefined
          }
          feeling={
            contextMenu.node.isWeapon
              ? undefined
              : { value: feelings[contextMenu.node.nodeId], onPick: (f) => setFeeling(contextMenu.node.nodeId, f) }
          }
          onClose={() => setContextMenu(null)}
          onCreate={() => {
            const anchor = contextMenu.node;
            setContextMenu(null);
            startBranchOf(anchor);
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

      {zoneMenu && nodeGroups.some((g) => g.rootId === zoneMenu.rootId) && (
        <ZoneMenu
          rootId={zoneMenu.rootId}
          x={zoneMenu.x}
          y={zoneMenu.y}
          view={{ value: zoneDisplay[zoneMenu.rootId] ?? null, onPick: (m) => setZoneMode(zoneMenu.rootId, m) }}
          layout={{ value: zoneLayouts[zoneMenu.rootId] ?? null, onPick: (l) => setZoneLayout(zoneMenu.rootId, l) }}
          style={
            zoneStyleFor(zoneMenu.rootId) && {
              ...zoneStyleFor(zoneMenu.rootId)!,
              onChange: (patch) => setZoneStyle(zoneMenu.rootId, patch),
            }
          }
          actions={zoneActionsFor(zoneMenu.rootId)}
          onClose={() => setZoneMenu(null)}
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
            // Where the user right-clicked.
            setCanvasContextMenu(null);
            startNodeAt({ x: canvasContextMenu.canvasX, y: canvasContextMenu.canvasY }, type);
          }}
          onGrow={(kind) => {
            const at = { x: canvasContextMenu.canvasX, y: canvasContextMenu.canvasY };
            setCanvasContextMenu(null);
            setInlineEditId(null);
            void growStructure(kind, at);
          }}
          onTextToNodes={() => {
            setCanvasContextMenu(null);
            setInlineEditId(null);
            setTextNodesAt({ x: canvasContextMenu.canvasX, y: canvasContextMenu.canvasY });
          }}
          onTextToMap={() => {
            setCanvasContextMenu(null);
            navigate("/split");
          }}
        />
      )}

      {textNodesAt && (
        <TextToNodesModal
          // The whole canvas counts, not just what's on screen — the question
          // is whether the map itself has room. New nodes keep the usual
          // spacing from everything already there (zones included) and the
          // tighter family spacing among themselves.
          findSpots={(count) =>
            findFreeSpots(
              textNodesAt,
              count,
              [...nodeObstacles(obstaclePoints()), ...bigNodeObstacles()],
              getCirclePackSpacing(),
            )
          }
          onCreate={createFromText}
          onClose={() => setTextNodesAt(null)}
          mapNodes={visibleNodes.filter((n) => !n.isWeapon).map((n) => ({ id: n.nodeId, label: linkLabel(n.nodeId) }))}
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
