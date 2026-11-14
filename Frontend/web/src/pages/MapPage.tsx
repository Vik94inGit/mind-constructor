import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
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
import { useDesktopLayout, useMediaQuery } from "../hooks/useDesktopLayout";
import { closeOne, keepOpen, panelDevice, panelGrid, PANEL_LIMIT } from "../utils/openPanels";
import { useVisualViewportOffset } from "../hooks/useVisualViewportOffset";
import { isEditableTarget } from "../utils/editable";
import { canvasHoldAllowed, useCanvasHoldMenu } from "../hooks/useCanvasHoldMenu";
import { canvasDoubleTapAllowed, useCanvasDoubleTap } from "../hooks/useCanvasDoubleTap";
import { useMarqueeSelect } from "../hooks/useMarqueeSelect";
import { useChosenCircle } from "../hooks/useChosenCircle";
import { usePackMode } from "../hooks/usePackMode";
import type { PendingCreate } from "../hooks/useNodeCreation";
import { useCanvasViewport } from "../hooks/useCanvasViewport";
import { useCanvasMode } from "../hooks/useCanvasMode";
import { useCanvasMenu } from "../hooks/useCanvasMenu";
import { useZoneGroups } from "../hooks/useZoneGroups";
import { useWeaponReplay } from "../hooks/useWeaponReplay";
import { useNotice } from "../hooks/useNotice";
import { useStableActions } from "../hooks/useStableActions";
import { firstShownAs, getSyncStatus, subscribeSyncStatus } from "../offline/sync";
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
import { TextOverflowOffer } from "../components/TextOverflowOffer";
import { drawnBox } from "../utils/drawnBox";
import { canSplitText } from "../utils/textSplit";
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
import { PicturePicker } from "../map/PicturePicker";
import { PictureLayer } from "../map/PictureLayer";
import { PictureCaptions } from "../map/PictureCaptions";
import { usePictureEdit } from "../hooks/usePictureEdit";
import { pictureGroups } from "../utils/pictures";
import { MiniMap } from "../map/MiniMap";
import { TimeLapseBar, timeLapseOrder } from "../map/TimeLapseBar";
import { ViewCorner } from "../map/ViewCorner";
import { ViewPrompt } from "../map/ViewPrompt";
import { loadMinimapShown, saveMinimapShown } from "../utils/minimapPref";
import { creationOrder, readingOrder, stepAlong } from "../utils/nodeOrder";
import { useMoveUndo } from "../hooks/useMoveUndo";
import { useDeletedNodes } from "../hooks/useDeletedNodes";
import { CanvasBackdrop } from "../map/CanvasBackdrop";
import { CanvasFrame } from "../map/CanvasFrame";
import { DrawLineBar } from "../map/DrawLineBar";
import { SiegePanel } from "../map/SiegePanel";
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
import { firstParentPoint, showsAnyNode } from "../utils/openingFocus";
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
import { useMapControls } from "../hooks/useMapControls";
import { ZoneNames } from "../map/ZoneNames";
import { PresentationOverlay } from "../map/PresentationOverlay";
import { QuizOverlay } from "../map/QuizOverlay";
import { useQuiz } from "../hooks/useQuiz";
import {
  computeAttackPairIds,
  collectDescendants,
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
  computeNodeGroups,
  computeLinkCycles,
  getCirclePackSpacing,
  nodeObstacles,
  isMobileViewport,
} from "../utils/canvasLayout";
import type { ReadingMode } from "../utils/readingMode";
import { ATTACK_NODE_TYPES, NODE_TYPES } from "../types";
import type { AttackIndicator, MapAttack, NodeDoc, NodeType } from "../types";
import { battleTally, healthAt } from "../utils/finish";
import { FinishedBanner } from "../map/FinishedBanner";
import { HistoryPanel } from "../map/HistoryPanel";
import { NodeBurst } from "../map/NodeBurst";
import { mapBackgroundStyle } from "../utils/mapBackground";
import { autoNodeFade, nodeFadeStyle } from "../utils/nodeFade";
import { MoveNoteModal } from "../dashboard/MoveNoteModal";
import { MoveCardsModal } from "../map/MoveCardsModal";
import { CardFitBanner } from "../map/CardFitBanner";
import { TOP_ZONE, useCardFit } from "../hooks/useCardFit";
import { outlineNumbers, zoneMembers } from "../utils/cardFit";
import { findInbox, noteBranch } from "../utils/inbox";
import { feature } from "../utils/usage";
import { useLevelReveal } from "../hooks/useLevelReveal";

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
  // Wider than a phone: a tablet when not in the desktop layout (utils/openPanels.ts).
  const widerThanPhone = useMediaQuery("(min-width: 640px)");
  // A phone: the top-left toolbar folds to three buttons (see MapToolbar).
  const phoneToolbar = useMediaQuery("(max-width: 639.98px)");
  const viewportOffset = useVisualViewportOffset();
  // A back swipe / back button doesn't leave the map — only the toolbar's ←
  // does (see useBackGuard).
  useBackGuard();
  const { user, logout } = useAuth();
  const { t } = useI18n();

  // The canvas's interaction mode: at most one of choosing, packing, drawing a
  // line or changing a parent, one reducer (useCanvasMode). The flags below are
  // plain reads of it.
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
  // hides it for that node, and so does cancelling a node picked from it.
  // Opening another node brings them back.
  const [ghostsHiddenFor, setGhostsHiddenFor] = useState<string | null>(null);
  const ghostsHidden = !!selectedId && ghostsHiddenFor === selectedId;
  useEffect(() => {
    setGhostsHiddenFor((prev) => (prev === selectedId ? prev : null));
  }, [selectedId]);
  // The time-lapse (TimeLapseBar): how many nodes, oldest first, are shown,
  // and whether it's playing. `null` when it's off.
  const [timeLapse, setTimeLapse] = useState<{ step: number; playing: boolean } | null>(null);
  // The discussion's side panel: its history of changes (HistoryPanel) or the
  // opponent's turn (SiegePanel), discussion mode only. One value, so opening
  // one closes the other.
  const [sidePanel, setSidePanel] = useState<"history" | "siege" | null>(null);
  const closeSiege = () => setSidePanel((p) => (p === "siege" ? null : p));
  // Every attack on the map, fetched when a replay starts, so the replay can
  // show health as it was at each step (utils/finish.ts healthAt).
  const [replayAttacks, setReplayAttacks] = useState<MapAttack[]>([]);
  // Off by default, so a mouse click never moves a node by accident; the
  // toolbar's Move turns it on. A finger drags either way once it really
  // travels, and a multi-selection always drags.
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
    // How strongly quiet nodes fade — see utils/nodeFade.ts.
    nodeFade,
    setNodeFade,
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
    quizMarks,
    setQuizMark,
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
  // Nodes waiting on the link dialog, in the order chosen: 2 make one edge,
  // 3+ a closed loop (which then colors in as a figure).
  const [pendingLink, setPendingLink] = useState<NodeDoc[] | null>(null);
  // A failed action shows as a dismissible banner over the live canvas, not
  // the full-page error view.
  const [actionError, setActionError] = useState<string | null>(null);
  const { notice, noticeAction, showNotice, dismissNotice } = useNotice();

  // A node not yet created, still being typed into the inline input — see
  // PendingCreate (hooks/useNodeCreation.ts).
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  // While the quick-add ring is up on a phone the toolbar folds to one "⋮"
  // (it floats above the ghosts and would hide one); this re-shows it until quick-add
  // starts again.
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
  // The node, zone and canvas menus: one open at a time (hooks/useCanvasMenu.ts).
  const { nodeMenu, zoneMenu, canvasMenu, openMenu, closeMenu } = useCanvasMenu();
  // Which node currently has its caption swapped for an inline text input —
  // see startInlineEdit. Null means no node is being edited.
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  // Text pasted into a node's inline editor past its limit: what didn't fit,
  // offered for new nodes carrying on from it (the banner at the top).
  const [textOverflow, setTextOverflow] = useState<{ nodeId: string; rest: string } | null>(null);
  const [carryingText, setCarryingText] = useState(false);
  // Group selection (marquee, shift+click, choose mode): dashed rings; with 2+
  // the panel gives way to the selection bar and other links dim.
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

  // Pointer capture sends the browser's trailing click to the dragged node too,
  // after onUp has already handled the press; this swallows that one click.
  const suppressNextClick = useRef(false);

  // A leveled template's later rounds: locked, and kept off the canvas, until
  // the earlier ones are answered; the user is told when one opens.
  const { locks: levelLockById, hidden: levelHidden } = useLevelReveal(nodes, ({ level, count }) =>
    showNotice(t.ui.templates.unlocked(level, count)),
  );
  // Packed-away members are left off the canvas (NodePanel still gets every
  // node, for the container's Packed list), and so is a round not yet open.
  const unpackedNodes = useMemo(
    () => nodes.filter((n) => !n.packedIntoNodeId && !levelHidden.has(n.nodeId)),
    [nodes, levelHidden],
  );
  // Parents that tuck their branch in, and the overview — see hooks/useAutoPack.ts.
  const { folded, setFolded, fold, mapParents, toggleFold, overviewOn, setOverview, packAll, unpackAll } = useAutoPack(mapId, unpackedNodes);
  // Whether the minimap shows (the view corner's menu) — see utils/minimapPref.ts.
  const [minimapShown, setMinimapShown] = useState<boolean>(loadMinimapShown);
  function toggleMinimap() {
    feature("minimap");
    setMinimapShown((v) => {
      saveMinimapShown(!v);
      return !v;
    });
  }
  // The cards view showing one zone at a time when its cards don't fit the
  // screen (hooks/useCardFit.ts): TOP_ZONE, a parent's id, or null.
  const [cardZone, setCardZone] = useState<string | null>(null);
  const cardZoneIds = useMemo(
    () => (cardZone === null || cardZone === TOP_ZONE ? null : zoneMembers(unpackedNodes, cardZone)),
    [unpackedNodes, cardZone],
  );
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
    if (cardZoneIds) return unpackedNodes.filter((n) => cardZoneIds.has(n.nodeId));
    return fold.hidden.size === 0
      ? unpackedNodes
      : unpackedNodes.filter((n) => n.nodeId === selectedId || !fold.hidden.has(n.nodeId));
  }, [unpackedNodes, selectedId, timeLapseNodes, timeLapseStep, replayAttacks, fold, cardZoneIds]);
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
  // A tap or click on a node opens its panel (docs/gestures/tap-opens-node.md).
  // Only the node's right-click / hold menu picks it without opening it; the
  // menu's Edit opens it then.
  const [panelHiddenFor, setPanelHiddenFor] = useState<string | null>(null);
  useEffect(() => {
    setPanelHiddenFor((prev) => (prev === selectedId ? prev : null));
  }, [selectedId]);
  const panelNode = selectedNode && panelHiddenFor !== selectedNode.nodeId ? selectedNode : null;
  // Several panels open at once (docs/gestures/several-panels.md): the
  // active one is selectedId's; `otherPanels` are kept open beside it, oldest
  // first, up to the device's limit (utils/openPanels.ts).
  const [otherPanels, setOtherPanels] = useState<string[]>([]);
  const panelDev = panelDevice(widerThanPhone, desktopLayout);
  const panelLimit = PANEL_LIMIT[panelDev];
  useEffect(() => {
    if (selectedId === null) setOtherPanels([]);
  }, [selectedId]);
  useEffect(() => setOtherPanels([]), [mapId]);
  // The device turned (or the window shrank): keep only what fits now.
  useEffect(() => {
    setOtherPanels((prev) => (prev.length > panelLimit - 1 ? prev.slice(prev.length - (panelLimit - 1)) : prev));
  }, [panelLimit]);
  // Tiles keep the order they were opened in, so bringing one forward
  // doesn't shuffle them.
  const panelOpenedAt = useRef(new Map<string, number>());
  const openPanelNodes = useMemo(() => {
    const ids = [...otherPanels.filter((id) => id !== selectedId), ...(panelNode ? [panelNode.nodeId] : [])];
    const seen = panelOpenedAt.current;
    for (const id of ids) if (!seen.has(id)) seen.set(id, seen.size + Date.now());
    for (const id of [...seen.keys()]) if (!ids.includes(id)) seen.delete(id);
    return ids
      .map((id) => nodes.find((n) => n.nodeId === id))
      .filter((n): n is NodeDoc => !!n)
      .sort((a, b) => (seen.get(a.nodeId) ?? 0) - (seen.get(b.nodeId) ?? 0));
  }, [otherPanels, selectedId, panelNode, nodes]);
  // A tap opening `nextId`: the panel open now stays open beside it.
  function keepPanelOpenFor(nextId: string) {
    if (panelNode) setOtherPanels((prev) => keepOpen(prev, panelNode.nodeId, nextId, panelLimit));
    else setOtherPanels((prev) => prev.filter((id) => id !== nextId));
  }
  // One panel's ✕: the others stay; closing the active one hands its place
  // to the most recent other.
  function closePanel(id: string) {
    const { others, active } = closeOne(otherPanels, panelNode?.nodeId ?? null, id);
    setOtherPanels(others);
    if (active !== (panelNode?.nodeId ?? null)) {
      setSelectedId(active);
      if (active) centerOnNode(active);
    }
  }
  // ?node=<id> (a search result on the dashboard): the map opens on that node.
  const [searchParams] = useSearchParams();
  const focusNodeId = searchParams.get("node");
  // NodePanel/PackPickerPanel's bottom sheet physically covers the bottom
  // third (half on mobile) of the screen while it's open. Skipped for the
  // group-selection footer (multiSelectIds), which is a slim bar, not a tall
  // sheet.
  const sheetOpen = chooseMode || packMode || reparentMode || !!pendingCreate || (openPanelNodes.length > 0 && multiSelectIds.size === 0);
  // Where the map opens: back at the spot left last time when that spot
  // shows a node, else on the map's first parent (utils/openingFocus.ts),
  // never on empty canvas.
  const firstParent = useMemo(() => firstParentPoint(visibleNodes, positions), [visibleNodes, positions]);
  const restoreCenter = useMemo(() => {
    const center = savedView?.center;
    if (!center) return null;
    return showsAnyNode(center, positions, window.innerWidth / 2, window.innerHeight / 2) ? center : null;
  }, [savedView?.center, positions]);
  const restoreView = useMemo(
    () => (savedView ? { ...savedView, center: restoreCenter } : null),
    [savedView, restoreCenter],
  );
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
    openAt: focusNodeId ? null : (restoreCenter ?? firstParent),
  });

  // Picking up where you left off — see hooks/useRestoreView.ts.
  useRestoreView({
    mapId,
    loading,
    focusNodeId,
    savedView: restoreView,
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

  // What's chosen right now (a multi-select wins over the single selection);
  // null when nothing is, the one case every link stays fully lit.
  const chosenNodeIds = multiSelectIds.size > 0 ? multiSelectIds : selectedId ? new Set([selectedId]) : null;
  // A chosen circle spotlights its members, from the snapshot taken when it
  // was chosen (Map.selectedCircle.nodeIds), so it can't disagree with what's locked.
  const spotlightedNodeIds = map?.selectedCircle?.nodeIds;
  const spotlightedSet = useMemo(() => (spotlightedNodeIds ? new Set(spotlightedNodeIds) : null), [spotlightedNodeIds]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.nodeId, n])), [nodes]);

  // Selecting either end of an attack keeps that pair visible even under a
  // spotlighted circle (an attack is never in one), for as long as it stays selected.
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
    // A card on the board stays at its own spot among the other cards.
    const radial = cardSpace.has(node.nodeId) ? undefined : radialBlend.map?.get(node.nodeId);
    if (!radial) return own;
    const b = radialBlend.blend;
    return { x: own.x + (radial.x - own.x) * b, y: own.y + (radial.y - own.y) * b };
  }

  // Presentation mode: the map's own nodes as slides in a full-screen
  // overlay — see hooks/usePresentation.ts.
  const {
    presenting,
    slideIndex,
    setSlideIndex,
    slideGroups,
    summaryNodes,
    typeFilter,
    setTypeFilter,
    enterPresentation,
    presentZone,
    exitPresentation,
  } = usePresentation({
    visibleNodes,
    hiddenBranchIds,
    multiSelectIds,
    selectedCircleNodeIds: map?.selectedCircle?.nodeIds,
    ensureNodeText,
    setMultiSelectIds,
    setSelectedId,
    dispatchMode,
    setActionError,
    emptyMessage: t.ui.presentation.empty,
  });
  // Quiz me — the map asks, the viewer marks what they know (hooks/useQuiz.ts).
  const { quizCards, startQuiz, exitQuiz } = useQuiz({
    visibleNodes,
    hiddenBranchIds,
    ensureNodeText,
    setActionError,
    emptyMessage: t.ui.quiz.empty,
  });

  // How many nodes are currently packed into each container — NodeCard's
  // own corner badge reads this by nodeId.
  const packedCountByContainer = useMemo(() => countPackedByContainer(nodes), [nodes]);

  // Nodes that leave the map pop where they stood — see hooks/useNodeBursts.ts.
  const bursts = useNodeBursts(mapId, nodes, positions);

  // The zones, their realm reading and sentiments — see hooks/useZoneGroups.ts.
  const { nodeGroups, holds, groupSentimentByNode, circleRootSentimentByNode } = useZoneGroups({
    visibleNodes,
    nodes,
    positions,
    zoneLayouts,
    selectedCircleRootId: map?.selectedCircle?.rootId,
    centerOnPoint,
  });

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

  // The cards view kept to what fits the screen: shown one zone at a time,
  // numbered like an outline, when its cards don't; the top cards past what
  // fits can go to another map (hooks/useCardFit.ts).
  const fitNodes = useMemo(() => unpackedNodes.filter((n) => !n.isWeapon && !n.isProtection), [unpackedNodes]);
  const cardNumbers = useMemo(() => (cardZone === null ? null : outlineNumbers(fitNodes)), [cardZone, fitNodes]);
  const {
    warning: cardFitWarning,
    dismissWarning: dismissCardFit,
    openBranch,
    stepAt: cardStepAt,
    stepCount: cardStepCount,
    step: cardStep,
  } = useCardFit({
    active: view === "cards",
    ready: !loading && !entranceActive && !timeLapse && !presenting,
    nodes: fitNodes,
    folded,
    setFolded,
    toggleFold,
    viewportRef: wrapRef,
    // Once the cards left are drawn, they're laid close again (and the
    // camera takes them in), from the newest render's cards.
    onRefolded: () => setTimeout(() => layCardsCloseLatest.current(), 120),
    zone: cardZone,
    setZone: setCardZone,
  });
  const [movingExtraCards, setMovingExtraCards] = useState<string[] | null>(null);
  // Only your own cards can be moved off the map.
  function movableExtra(ids: string[]): string[] {
    const byId = new Map(nodes.map((n) => [n.nodeId, n]));
    return ids.filter((id) => {
      const n = byId.get(id);
      return !!n && isOwnNode(n);
    });
  }

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
    closeMenu,
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
  const layCardsCloseLatest = useRef(layCardsClose);
  layCardsCloseLatest.current = layCardsClose;
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
  const { recordMove, recordUndo, forgetUndo, undo: undoMove, canUndo } = useMoveUndo({
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
      openMenu({ kind: "node", node, x: clientX, y: clientY });
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
    closeMenu,
    setSelectedId,
    setMultiSelectIds,
    t,
  });

  // The quick-add ghost ring (and the dimming around it) waits until
  // centerOnNode's pan has landed (selectionSettled), and never shows round a
  // card on the board.
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

  // "Mine" gates dragging, linking, branching and editing, attack nodes
  // included (UI only; the API checks for itself).
  // This map is the user's Inbox (utils/inbox.ts): its notes offer "Move to a map".
  const isInboxMap = !!map && !!user && findInbox([map], user._id, t.dashboard.quickNote.inboxName)?.mapId === map.mapId;

  function isOwnNode(node: NodeDoc) {
    return idOf(node.userId) === user?._id;
  }

  // Your own thought with at least two words in it can be cut into smaller nodes hanging from it.
  function canSplitNode(node: NodeDoc) {
    return isOwnNode(node) && !node.isWeapon && !node.isProtection && canSplitText(node.text ?? "");
  }

  // Pasted text that ran past a node's limit can go on into new nodes from
  // your own thoughts (not an attack or a shield).
  function canCarryText(node: NodeDoc) {
    return isOwnNode(node) && !node.isWeapon && !node.isProtection;
  }

  async function carryOverflow() {
    if (!textOverflow) return;
    const from = nodes.find((n) => n.nodeId === textOverflow.nodeId);
    if (!from) return setTextOverflow(null);
    setCarryingText(true);
    const ok = await carryText(from, textOverflow.rest);
    setCarryingText(false);
    if (ok) setTextOverflow(null);
  }

  function openSplit(node: NodeDoc, text = node.text) {
    setInlineEditId(null);
    setSplitNode({ nodeId: node.nodeId, text });
    setTextNodesAt(positions.get(node.nodeId) ?? { x: node.x ?? 0, y: node.y ?? 0 });
  }

  // Owner-only — text/type editing isn't otherwise restricted (an earlier
  // version locked it once a node had taken any damage, but that blocked
  // ordinary corrections too aggressively; see NodePanel.tsx's own canEdit).
  // What a locked ghost of a leveled template tells its reader (utils/templateLevels.ts).
  function levelLockFor(nodeId: string): string | undefined {
    const lock = levelLockById.get(nodeId);
    return lock ? t.ui.templates.locked(lock.waitFor, lock.left) : undefined;
  }

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

  // Changing your mind about a new node: the ring it was picked from stays
  // down for that node (its panel's 👻 brings it back), rather than popping
  // straight back up around it as if asking again.
  function cancelPendingCreate() {
    if (pendingCreate?.parentId) setGhostsHiddenFor(pendingCreate.parentId);
    setPendingCreate(null);
  }

  // Editing always selects the node (so the panel shows, with the locked
  // message if needed) and, when allowed, opens it on its text field
  // (NodePanel's autoFocusText). From a double-click or the panel's Edit.
  async function startInlineEdit(node: NodeDoc) {
    closeMenu();
    setPendingCreate(null);
    if (multiSelectIds.size > 0) setMultiSelectIds(new Set());
    setSelectedId(node.nodeId);
    setPanelHiddenFor(null);
    centerOnNode(node.nodeId);
    if (!canEditNode(node) || levelLockById.has(node.nodeId)) return;
    await ensureNodeText([node.nodeId]);
    setFocusTextNodeId(node.nodeId);
  }

  function handleNodeClick(node: NodeDoc, shiftKey = false) {
    closeMenu();
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
      // Select mode (docs/gestures/select-mode.md): a tap picks or drops just
      // that one node, of any kind and anyone's; it never opens or moves it.
      setMultiSelectIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.nodeId)) next.delete(node.nodeId);
        else next.add(node.nodeId);
        return next;
      });
      return;
    }
    // Shift+click toggles the node in the group selection (own nodes only),
    // leaving the single selection and camera alone.
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
    // A tap or click on any node opens its panel on the Info tab: a weapon,
    // a node under attack, a card in the cards view, one with pictures (they
    // show in the Info tab) — docs/gestures/tap-opens-node.md. The panel open
    // now stays open beside it (docs/gestures/several-panels.md).
    keepPanelOpenFor(node.nodeId);
    selectNodeFromClick(node);
    setPanelHiddenFor(null);
  }

  // The toolbar's ☑: Select mode on with nothing picked yet, or off again.
  function toggleSelectMode() {
    closeMenu();
    if (chooseMode) {
      exitChooseMode();
      return;
    }
    if (drawMode) toggleDrawMode();
    setMoveMode(false);
    setPendingCreate(null);
    setSelectedId(null);
    setMultiSelectIds(new Set());
    dispatchMode({ type: "chooseStart" });
  }

  // Opens a node's panel on purpose (its menu's Edit), not just picking it.
  function openNode(node: NodeDoc) {
    closeMenu();
    if (multiSelectIds.size > 0) setMultiSelectIds(new Set());
    keepPanelOpenFor(node.nodeId);
    selectNodeFromClick(node);
    setPanelHiddenFor(null);
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
      closeSiege();
    },
  });

  // Reads the map node by node (utils/nodeOrder.ts readingOrder): from the
  // open node to the one before or after it, or, with none open, from the
  // first (→) or last (←) node. With a zone chosen, the arrows stay inside it
  // and go by when each thought was written, newest first (creationOrder
  // reversed), so → walks back into how that thinking grew. The panel's arrows and the
  // keyboard's ← / → both land here; only the text field's own arrows move
  // focus into the next node's text.
  function stepReading(dir: -1 | 1, focusText = true) {
    if (timeLapse) {
      // In the time-lapse the arrows step it instead, one node at a time.
      stepTimeLapse(dir);
      return;
    }
    const zoneIds = map?.selectedCircle?.nodeIds;
    let order: NodeDoc[];
    if (zoneIds?.length) {
      const inZone = collectDescendants(new Set(zoneIds), visibleNodes);
      order = creationOrder(visibleNodes.filter((n) => inZone.has(n.nodeId))).reverse();
    } else {
      order = readingOrder(visibleNodes);
    }
    const next = stepAlong(order, selectedId, dir);
    if (!next) return;
    setSteppedToId(next);
    setSelectedId(next);
    centerOnNode(next);
    if (focusText) setFocusTextNodeId(next);
  }


  // One node's panel; several sit side by side (docs/gestures/several-panels.md).
  function renderNodePanel(panelFor: NodeDoc, active: boolean, tiled: boolean) {
    if (!user) return null;
    return (
    <NodePanel
      key={panelFor.nodeId}
      node={panelFor}
      tiled={tiled}
      active={active}
      onActivate={() => {
        keepPanelOpenFor(panelFor.nodeId);
        setSelectedId(panelFor.nodeId);
        centerOnNode(panelFor.nodeId);
      }}
      textLocked={!!blockLocks[panelFor.nodeId]}
      levelLock={levelLockFor(panelFor.nodeId)}
      autoFocusText={focusTextNodeId === panelFor.nodeId}
      onAutoFocused={() => setFocusTextNodeId(null)}
      onToggleLock={isOwnNode(panelFor) ? () => toggleBlockLock(panelFor.nodeId) : undefined}
      // The parent's magnet: calls its own far nodes back in (utils/parentMagnet.ts).
      // Change parent: pick the node to hang this one from (reparent mode).
      onChangeParent={isOwnNode(panelFor) ? () => startReparent(panelFor) : undefined}
      // Swap with parent: the child takes its parent's place as head of the zone.
      onSwapWithParent={
        isOwnNode(panelFor) && zoneParentId(panelFor) ? () => void headZone(panelFor) : undefined
      }
      // Move to a map: only on the Inbox, where quick notes wait to be sorted.
      onMoveToMap={
        isInboxMap && isOwnNode(panelFor) && !panelFor.isWeapon && !panelFor.isProtection
          ? () => setMovingNote(panelFor)
          : undefined
      }
      onAutoPack={mapParents.has(panelFor.nodeId) ? () => toggleFold(panelFor.nodeId) : undefined}
      autoPacked={folded.has(panelFor.nodeId)}
      ghostsHidden={ghostsHidden}
      onToggleGhosts={
        isOwnNode(panelFor) && !onCardBoard(panelFor)
          ? () => setGhostsHiddenFor(ghostsHidden ? null : panelFor.nodeId)
          : undefined
      }
      onMagnet={
        nodes.some((n) => !n.isWeapon && zoneParentId(n) === panelFor.nodeId && isOwnNode(n))
          ? () => magnetize(panelFor)
          : undefined
      }
      feeling={
        panelFor.isWeapon
          ? null
          : { value: feelings[panelFor.nodeId], onChange: (f) => setFeeling(panelFor.nodeId, f) }
      }
      cardFill={(() => {
        const mode = modeOf(panelFor.nodeId);
        const isCard =
          mode === "puzzle" || (mode === "mixed" && circleRootSentimentByNode.has(panelFor.nodeId));
        return isCard
          ? {
              value: cardFills[panelFor.nodeId],
              onChange: (c: string | null) => setCardFill(panelFor.nodeId, c),
            }
          : null;
      })()}
      cardLook={
        onCardBoard(panelFor) && canEditNode(panelFor)
          ? {
              font: panelFor.cardFont ?? null,
              shape: panelFor.cardShape ?? null,
              sized: panelFor.cardW != null || panelFor.cardH != null,
              onChange: (patch) => void saveCardLook(panelFor, patch),
            }
          : null
      }
      nodes={nodes}
      edges={edges}
      currentUserId={user._id}
      discussionMode={isDiscussionMode}
      isMapOwner={isOwner}
      onApplyTemplate={(kind) => applyTemplate(kind, panelFor)}
      onClose={() => closePanel(panelFor.nodeId)}
      onStepNode={active ? stepReading : undefined}
      onSelectNode={(id) => {
        setSelectedId(id);
        // Same "chosen node is always centered" rule handleNodeClick
        // applies on the canvas — this is the panel's own path to
        // choosing a different node (its "Points at" link).
        centerOnNode(id);
        // Panel's own "Points at" link is only ever shown on a
        // weapon node's panel — same click-either-end replay the
        // canvas gets, just reached from here instead.
        if (panelFor.isWeapon) triggerWeaponShot(panelFor.nodeId);
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
      onStartChoose={() => startChooseFrom(panelFor.nodeId)}
      onEdit={() => startInlineEdit(panelFor)}
      onProtected={(protectionNode, healedNode) => {
        upsertNode(protectionNode);
        upsertNode(healedNode);
      }}
      onStartPack={() => startPackFrom(panelFor.nodeId)}
      onUnpacked={(unpacked) => upsertNode(unpacked)}
      isClusterParent={circleRootSentimentByNode.has(panelFor.nodeId)}
      onExtractText={() => extractClusterText(panelFor.nodeId)}
      onSplitText={canSplitNode(panelFor) ? (text) => openSplit(panelFor, text) : undefined}
      onCarryText={canCarryText(panelFor) ? (rest) => carryText(panelFor, rest) : undefined}
    />
    );
  }

  function selectNodeFromClick(node: NodeDoc) {
    setSelectedId(node.nodeId);
    releaseChosenCircleIfOutside(node.nodeId);
    // Center on what was just clicked, rather than on an attack's far end.
    centerOnNode(node.nodeId);
    // Clicking either end of an attack replays its arrow (the latest one landed on it).
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

  // Right-click on empty canvas: close what's open and offer a new node right
  // there (a node's own right-click stops before reaching this).
  // Touch has no right-click: holding a finger still on empty canvas opens
  // the canvas menu instead (hooks/useCanvasHoldMenu.ts). A quick tap only
  // closes what's open, as before.
  const canvasHold = useCanvasHoldMenu((clientX, clientY) => {
    setSelectedId(null);
    setMultiSelectIds(new Set());
    const at = screenToCanvas(clientX, clientY);
    openMenu({ kind: "canvas", screenX: clientX, screenY: clientY, canvasX: at.x, canvasY: at.y });
  });
  function onCanvasPointerDownWithHold(e: ReactPointerEvent<HTMLDivElement>) {
    canvasHold.start(
      e,
      canvasHoldAllowed({
        pointerType: e.pointerType,
        busyMode: drawMode || chooseMode || packMode || reparentMode || !!pendingCreate || !!inlineEditId,
        entranceActive,
        canEdit: !timeLapse && !presenting,
      }),
    );
    onCanvasPointerDown(e);
  }

  // Double-click / double-tap on empty canvas, or inside a zone, saves a
  // blank new node right there and opens it (docs/gestures/double-tap-new-node.md). Inside
  // a zone whose parent is the user's own, the node joins that zone. Returns
  // true when this tap was the second of a pair and made the node.
  const canvasDoubleTap = useCanvasDoubleTap();
  function doubleTapNewNode(clientX: number, clientY: number, timeStamp: number, zoneRootId: string | null): boolean {
    if (!canvasDoubleTap.tap({ x: clientX, y: clientY, t: timeStamp, target: zoneRootId ?? "" })) return false;
    const allowed = canvasDoubleTapAllowed({
      busyMode: drawMode || chooseMode || packMode || reparentMode || !!pendingCreate || !!inlineEditId,
      entranceActive,
      canEdit: !timeLapse && !presenting,
    });
    if (!allowed) return false;
    const root = zoneRootId ? nodes.find((n) => n.nodeId === zoneRootId) : undefined;
    setSelectedId(null);
    setMultiSelectIds(new Set());
    closeMenu();
    // Saved straight away and opened (panel + ring of ghosts), with no
    // text field, so a phone's keyboard stays down.
    void createBlankNodeAt(screenToCanvas(clientX, clientY), root && isOwnNode(root) ? root.nodeId : null).then((node) => {
      if (node) setSelectedId(node.nodeId);
    });
    return true;
  }

  function onCanvasContextMenu(e: ReactMouseEvent<HTMLDivElement>) {
    // A long press in a text field on the canvas (a new node's name) is the
    // tablet's own Paste/Select bubble: left to the browser.
    if (isEditableTarget(e.target)) return;
    e.preventDefault();
    // While drawing, a right-click takes back the last point.
    if (drawMode) {
      undoDrawPoint();
      return;
    }
    setSelectedId(null);
    setMultiSelectIds(new Set());
    const canvasPos = screenToCanvas(e.clientX, e.clientY);
    openMenu({ kind: "canvas", screenX: e.clientX, screenY: e.clientY, canvasX: canvasPos.x, canvasY: canvasPos.y });
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
    // The menu picks the node without opening its panel; the menu's Edit
    // opens it (and a node with no menu just opens).
    if (!own && !canAttackNode(node)) {
      closeMenu();
      setSelectedId(node.nodeId);
      return;
    }
    if (node.nodeId !== selectedId) setPanelHiddenFor(node.nodeId);
    keepPanelOpenFor(node.nodeId);
    setSelectedId(node.nodeId);
    openMenu({ kind: "node", node, x: e.clientX, y: e.clientY });
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

  // Everything deleted on this map since it was opened, each to put back
  // until the map is closed (the toolbar's 🗑, and Undo) — see hooks/useDeletedNodes.ts.
  const { deletedEntries, capture, remember, restoreEntry, deleteNodes } = useDeletedNodes({
    mapId,
    nodes,
    edges,
    isOwnNode,
    setNodes,
    setEdges,
    upsertNode,
    setCelebrateIds,
    setActionError,
    refreshInsights,
    recordUndo,
    forgetUndo,
    failMessage: t.ui.errors.restoreNode,
  });

  // A template or picture just grown (or a new map's starter questions):
  // Undo, or the notice's own button, takes all of it away in one step. What
  // it takes goes into the Deleted list, so even that can be put back.
  function offerStructureUndo(ids: string[], message: string) {
    const takeBack = async () => {
      await deleteNodes(ids);
    };
    const step = recordUndo(takeBack, t.ui.errors.delete);
    showNotice(message, {
      label: t.ui.templates.undo,
      run: () => {
        forgetUndo(step);
        setActionError(null);
        takeBack().catch(() => setActionError(t.ui.errors.delete));
      },
    });
  }

  // A map just made from a kind (the dashboard's New map) opens with its
  // starter questions on it: offered back once, while none is answered yet.
  const location = useLocation();
  const seededOffered = useRef(false);
  useEffect(() => {
    if (loading || seededOffered.current) return;
    seededOffered.current = true;
    if (!(location.state as { seeded?: boolean } | null)?.seeded) return;
    if (nodes.length === 0 || !nodes.every((n) => n.ghost && isOwnNode(n))) return;
    offerStructureUndo(
      nodes.map((n) => n.nodeId),
      t.ui.templates.seeded,
    );
    // Only the first time the map has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Deleting a node, undoable — see hooks/useNodeDelete.ts.
  const { deleteNodeWithUndo, handleDeleteNode } = useNodeDelete({
    mapId,
    nodes,
    isOwnNode,
    setNodes,
    setEdges,
    upsertNode,
    setSelectedId,
    setActionError,
    showNotice,
    refreshInsights,
    capture,
    remember,
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
  const { startQuickAdd, addBranchFromCard, sketchBranch, startBranchOf, startNodeAt, startCreateNodeInView, createBlankNodeAt } = useQuickAdd({
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
    closeMenu,
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
    deleteNodes,
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
  // The node the ← / → arrows last stepped to (useChompRuns reads it).
  const [steppedToId, setSteppedToId] = useState<string | null>(null);
  // A node being made is brought to the middle of the screen below its panel,
  // with the emoji ring around it.
  useEffect(() => {
    if (pendingCreate) centerOnPoint(pendingCreate.x, pendingCreate.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCreate?.x, pendingCreate?.y]);
  // "Text → nodes" (canvas right-click menu): where on the canvas it was asked for.
  const [textNodesAt, setTextNodesAt] = useState<{ x: number; y: number } | null>(null);
  // "Split into nodes": the node whose text the Text → nodes dialog cuts up (null: a fresh text).
  const [splitNode, setSplitNode] = useState<{ nodeId: string; text: string } | null>(null);
  // "Draw a picture" is choosing a picture: where it goes, or "view" for the
  // middle of what's on screen (the "+" menu).
  const [picturePickerAt, setPicturePickerAt] = useState<{ x: number; y: number } | "view" | null>(null);
  // Every picture on the map (utils/pictures.ts), drawn on the canvas and the minimap.
  const pictures = useMemo(() => pictureGroups(visibleNodes), [visibleNodes]);
  // A tap on a picture's caption opens its bar: bigger, smaller, or pick it up
  // and move it as one (hooks/usePictureEdit.ts, docs/gestures/picture-resize.md).
  const pictureEdit = usePictureEdit({
    pictures: view === "cards" || timeLapse || presenting ? [] : pictures,
    posFor,
    upsertNode,
    recordMove,
    setMultiSelectIds,
    setSelectedId,
    setMoveMode,
    setActionError,
    errorMessage: t.ui.pictures.edit.resizeFailed,
  });
  const { confirmPendingCreate, carryText, applyTemplate, createCircle, growStructure, createFromText, drawPicture } = useNodeCreation({
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
    showPoints,
    showNotice,
    onCreated: () => {
      setMultiSelectIds(new Set());
      setSelectedId(null);
    },
    replaceNode: (draftId, saved) =>
      setNodes((prev) => {
        if (!saved) return prev.filter((n) => n.nodeId !== draftId);
        // The socket's echo of the create may have brought the saved node in first.
        if (prev.some((n) => n.nodeId === saved.nodeId)) return prev.filter((n) => n.nodeId !== draftId);
        if (!prev.some((n) => n.nodeId === draftId)) return [...prev, saved];
        return prev.map((n) => (n.nodeId === draftId ? saved : n));
      }),
    onStructureMade: offerStructureUndo,
    drawnBoxOf: (nodeId) => drawnBox(nodeId, screenToCanvas),
    t,
  });

  // The map's mode and background, finishing the discussion, deleting the map
  // — see hooks/useMapControls.ts.
  const { isOwner, toggleMapMode, setMapBackground, setMapBackgroundColor, setMapBackgroundImage, setMapBackgroundShade, deleteThisMap, exitDemo, finish } = useMapControls({
    map,
    setMap,
    nodes,
    userId: user?._id,
    online,
    discussionOn,
    setActionError,
    closeSiege,
    logout,
    t,
  });

  // The map's keyboard shortcuts — presentation stepping, line drawing,
  // finishing a choice, copy/paste. See hooks/useMapKeyboard.ts.
  useMapKeyboard({
    presenting,
    exitPresentation,
    setSlideIndex,
    slideCount: slideGroups.length,
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
    textOverflow: (node, rest) => {
      if (canCarryText(node)) setTextOverflow({ nodeId: node.nodeId, rest });
    },
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
    unfold: (nodeId) => openBranch(nodeId),
    fold: (nodeId) => toggleFold(nodeId),
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
  const pictureBackground = mapBackgroundStyle(map.background, map.backgroundColor, map.backgroundImage, map.backgroundShade);
  const canvasBackground = { ...pictureBackground, style: { ...pictureBackground.style, ...nodeFadeStyle(nodeFade) } };
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
      // A phone folds the cluster to three buttons, the rest behind "⋯".
      phone={phoneToolbar}
      viewportOffset={viewportOffset}
      isDemo={!!user?.isDemo}
      isOwner={isOwner}
      isDiscussionMode={isDiscussionMode}
      offline={!online}
      // Only a phone folds it: on a tablet or wider the ring round the
      // centred node never reaches the top-left corner, and folding it there
      // read as the toolbar disappearing whenever a node was open.
      expanded={!quickAddActive || forceShowToolbar || !isMobileViewport()}
      onExpand={() => setForceShowToolbar(true)}
      moveMode={moveMode}
      onToggleMove={() => setMoveMode((v) => !v)}
      selectMode={chooseMode}
      onToggleSelect={toggleSelectMode}
      drawMode={drawMode}
      onToggleDraw={toggleDrawMode}
      compact={compactView}
      onToggleCompact={toggleCompactView}
      emojiFirst={emojiFirst}
      onToggleEmojiFirst={toggleEmojiFirst}
      nodeFade={nodeFade ?? autoNodeFade(!!map.backgroundImage)}
      onNodeFade={setNodeFade}
      typeEmoji={typeEmoji}
      onTypeEmoji={setTypeEmoji}
      zoneLayout={zoneLayouts[MAP_ZONE_KEY] ?? "zones"}
      onPickZoneLayout={(layout) => setZoneLayout(MAP_ZONE_KEY, layout === "zones" ? null : layout)}
      background={map.background}
      onPickBackground={isOwner ? setMapBackground : undefined}
      backgroundColor={map.backgroundColor}
      onPickBackgroundColor={isOwner ? setMapBackgroundColor : undefined}
      backgroundImage={map.backgroundImage}
      onPickBackgroundImage={isOwner ? (file) => void setMapBackgroundImage(file) : undefined}
      backgroundShade={map.backgroundShade}
      onPickBackgroundShade={isOwner ? (shade, save) => void setMapBackgroundShade(shade, save) : undefined}
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
        setSidePanel("history");
      }}
      onOpponentTurn={finish.isFinished ? undefined : () => {
        setSelectedId(null);
        setSidePanel("siege");
      }}
      onExitDemo={exitDemo}
      onInvite={() => setShowInvite(true)}
      onCreateNode={startCreateNodeInView}
      onCreateCircle={createCircle}
      onDrawPicture={() => setPicturePickerAt("view")}
      onCopyMap={copyWholeMap}
      onPaste={() => pasteClipboard()}
      onExportText={openExportText}
      onDeleteMap={deleteThisMap}
      canUndo={canUndo}
      onUndo={() => void undoMove()}
      deletedEntries={deletedEntries}
      onRestoreDeleted={(id) => void restoreEntry(id)}
      onTimeLapse={startTimeLapse}
      onPresent={enterPresentation}
      onQuiz={startQuiz}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {notice && <MapBanner tone="success" message={notice} action={noticeAction ?? undefined} onDismiss={dismissNotice} />}
      {textOverflow && (
        <TextOverflowOffer
          className="mx-4 mt-[0.6rem]"
          rest={textOverflow.rest}
          busy={carryingText}
          onCarry={() => void carryOverflow()}
          onLeave={() => setTextOverflow(null)}
        />
      )}
      {cardFitWarning && (
        <CardFitBanner
          warning={cardFitWarning}
          movable={cardFitWarning.kind === "tooMany" ? movableExtra(cardFitWarning.extraRootIds) : []}
          onMove={(ids) => setMovingExtraCards(ids)}
          onDismiss={dismissCardFit}
          steps={
            cardZone !== null && cardStepCount > 1
              ? {
                  at: cardStepAt,
                  count: cardStepCount,
                  label: cardZone === TOP_ZONE ? null : (cardNumbers?.get(cardZone) ?? null),
                  onStep: cardStep,
                }
              : null
          }
        />
      )}
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
        {/* overflow-clip: nothing in here (a long menu, a chip) can make the
            page itself taller than the screen, so a tablet's keyboard has no
            page to scroll and the floating toolbar stays put. Clip, not
            hidden, so this isn't a scroller either. */}
        <div className="relative min-w-0 flex-1 overflow-clip">
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
              // Lifting the finger after a hold opened the canvas menu.
              if (canvasHold.swallowClick()) return;
              // Drawing a line: a click places a point (if the spot is free).
              if (drawMode) {
                addDrawPoint(screenToCanvas(e.clientX, e.clientY));
                return;
              }
              // Select mode is left only by its Done or ☑: a tap on empty
              // canvas does nothing, so a slip never loses the selection.
              if (chooseMode) return;
              if (packMode || reparentMode) return;
              if (doubleTapNewNode(e.clientX, e.clientY, e.timeStamp, null)) return;
              setSelectedId(null);
              setMultiSelectIds(new Set());
              releaseChosenCircleIfOutside();
            }}
            onPointerDown={onCanvasPointerDownWithHold}
            onPointerMove={drawMode ? onDrawPointerMove : undefined}
            onContextMenu={onCanvasContextMenu}
          >
            {view !== "cards" && <PictureLayer pictures={pictures} posFor={posFor} />}
            <CanvasBackdrop
              replaying={!!timeLapse}
              onZoneMenu={(rootId, x, y) => openMenu({ kind: "zone", rootId, x, y })}
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
              onCircleClick={(rootId, at) => {
                // Select mode: a tap on a zone does nothing either (see the
                // canvas's own onClick); only Done or ☑ leaves it.
                if (chooseMode) return;
                // With a node's panel open, a tap on a zone is a tap outside
                // the panel: it closes it, same as empty canvas, instead of
                // also stabilizing the zone underneath.
                // A second quick tap on the zone adds a node to it.
                if (at && !packMode && !reparentMode && doubleTapNewNode(at.clientX, at.clientY, at.timeStamp, rootId)) return;
                if (selectedId) {
                  setSelectedId(null);
                  return;
                }
                handleCircleBackdropClick(rootId);
              }}
              // The cards view is a board of its own: the mind map's
              // separator lines and realm border stay with the map.
              lines={view === "cards" ? [] : lines}
              canDeleteLine={canDeleteLine}
              // With a node's panel open, a tap on a separator line is a tap
              // outside the panel too: it closes it rather than offering to
              // delete the line.
              onLineClick={(line) => (selectedId ? setSelectedId(null) : handleLineClick(line))}
              interactive={!drawMode}
              compact={compactView || dotZoom}
              solvedZones={solvedZones}
              walls={isDiscussionMode}
              realmBorders={view !== "cards"}
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
                  // A node written here keeps the card it was drawn with as a draft (useNodeCreation).
                  key={firstShownAs(node.nodeId) ?? node.nodeId}
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
                  // Keeps the grab cursor honest: only nodes that will really drag.
                  canDrag={
                    isOwnNode(node) &&
                    !node.locked &&
                    !blockLocks[node.nodeId] &&
                    (chooseMode
                      ? moveMode && multiSelectIds.has(node.nodeId)
                      : moveMode || (multiSelectIds.size > 1 && multiSelectIds.has(node.nodeId)))
                  }
                  groupSentiment={groupSentimentByNode.get(node.nodeId)}
                  parentCrownSentiment={circleRootSentimentByNode.get(node.nodeId)}
                  inChosenCircle={!!spotlightedSet?.has(node.nodeId)}
                  indicator={indicatorByNode.get(node.nodeId)}
                  packedCount={packedCountByContainer.get(node.nodeId)}
                  foldedCount={fold.counts.get(node.nodeId)}
                  seqLabel={view === "cards" ? cardNumbers?.get(node.nodeId) : undefined}
                  canFold={view !== "cards" && mapParents.has(node.nodeId) && !folded.has(node.nodeId)}
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
                  // The time-lapse's newest node reads up to 5 rows at its icon.
                  replayCaption={timeLapseStep !== null && timeLapseNodes[timeLapseStep - 1]?.nodeId === node.nodeId}
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
                  inlineEditing={editingThis && !levelLockById.has(node.nodeId)}
                  levelLocked={levelLockById.has(node.nodeId)}
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

            {view !== "cards" && (
              <PictureCaptions
                pictures={pictures}
                posFor={posFor}
                zoom={zoom}
                canEdit={(g) => !timeLapse && !presenting && [...g.byDot.values()].every(canEditNode)}
                openId={pictureEdit.openPicture?.id ?? null}
                onOpen={pictureEdit.openPictureBar}
                onClose={pictureEdit.closePictureBar}
                canGrow={pictureEdit.canGrow}
                canShrink={pictureEdit.canShrink}
                onResize={(direction) => void pictureEdit.resizePicture(direction)}
                onMove={pictureEdit.movePicture}
                onColor={(color) => void pictureEdit.setPictureColor(color)}
              />
            )}

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
                currentType={selectedNode.type}
                changeTypes={selectedNode.isWeapon || selectedNode.isProtection ? ATTACK_NODE_TYPES : NODE_TYPES}
                onChangeType={canEditNode(selectedNode) ? (type) => void handleChangeNodeType(selectedNode, type) : undefined}
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
                onCancel={cancelPendingCreate}
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
                onPackAll={mapParents.size > 0 ? (folded.size > 0 ? unpackAll : packAll) : undefined}
                somePacked={folded.size > 0}
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
                pictures={pictures}
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

              {view !== "cards" && <ZoneNames
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
                onPresent={presentZone}
                onGo={(rootId) => {
                  const group = nodeGroups.find((g) => g.rootId === rootId);
                  if (!group) return;
                  const pts = [group.rootId, ...group.members.map((m) => m.nodeId)]
                    .map((id) => positions.get(id))
                    .filter((p): p is { x: number; y: number } => !!p);
                  showPoints(pts, { aboveSheet: false });
                }}
              />}

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

          {quizCards && (
            <QuizOverlay cards={quizCards} marks={quizMarks} onMark={setQuizMark} onExit={exitQuiz} />
          )}
          {presenting && (
            <PresentationOverlay
              slides={slideGroups}
              summaryNodes={summaryNodes}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              index={Math.min(slideIndex, Math.max(0, slideGroups.length - 1))}
              onIndexChange={setSlideIndex}
              onExit={exitPresentation}
              onOpenNode={(id) => {
                exitPresentation();
                setSelectedId(id);
                centerOnNode(id);
              }}
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
            current={timeLapseNodes[timeLapseStep - 1]}
            at={timeLapseNodes[timeLapseStep - 1]?.createdAt}
            onStep={onTimeLapseStep}
            onTogglePlay={togglePlay}
            onStepBy={stepTimeLapse}
            onExit={() => setTimeLapse(null)}
          />
        ) : sidePanel === "history" && isDiscussionMode && mapId ? (
          <HistoryPanel
            mapId={mapId}
            liveIds={new Set(nodes.map((n) => n.nodeId))}
            onShow={centerOnNode}
            onExit={() => setSidePanel(null)}
          />
        ) : sidePanel === "siege" && isDiscussionMode && !finish.isFinished ? (
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
              closeSiege();
              setSelectedId(id);
              centerOnNode(id);
            }}
            onExit={() => setSidePanel(null)}
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
            moveMode={moveMode}
            onLink={linkSelection}
            onNumber={() => numberSelection(false)}
            onDisplay={setDisplayForChosen}
            onClearNumbers={() => numberSelection(true)}
            onCopy={copySelection}
            onCopyText={() => void copySelectionAsText()}
            onGroupCircle={groupSelectionIntoCircle}
            // Select mode picks anyone's nodes; only your own can be deleted.
            onDelete={() => void deleteSelection(nodes.filter((n) => multiSelectIds.has(n.nodeId) && isOwnNode(n)).map((n) => n.nodeId))}
            onDone={exitChooseMode}
          />
        ) : pendingCreate && !presenting ? (
          // A node being made is written in its own top sheet, text field first.
          <NewNodePanel
            key={`${pendingCreate.x}:${pendingCreate.y}`}
            type={pendingCreate.type}
            emoji={pendingCreate.emoji || undefined}
            prompt={pendingCreate.prompt}
            onClearEmoji={() => setPendingCreate((prev) => (prev ? { ...prev, emoji: "" } : prev))}
            onCreate={(text, type, images, prompt, overflow) => confirmPendingCreate(text, type, images, prompt, overflow)}
            onCancel={cancelPendingCreate}
          />
        ) : (
          // !presenting: NodePanel already only renders when a node is
          // selected, and enterPresentation clears selectedId — but this
          // guard stays defensive rather than relying on that alone, in
          // case anything else (e.g. a queued search-result pick) ever
          // re-selects a node while presenting.
          !presenting &&
          user &&
          openPanelNodes.length > 0 &&
          // No dimming backdrop behind the panels: the canvas's own onClick
          // already deselects on a tap that reaches empty canvas directly.
          (openPanelNodes.length === 1 ? (
            renderNodePanel(openPanelNodes[0], openPanelNodes[0].nodeId === panelNode?.nodeId, false)
          ) : (
            // Several open: tiles sharing the bottom half, never overlapping
            // (docs/gestures/several-panels.md, utils/openPanels.ts).
            <div
              className="fixed inset-x-0 bottom-0 z-[46] grid h-[50dvh] gap-1 p-1"
              data-node-panels
              style={(() => {
                const grid = panelGrid(openPanelNodes.length, panelDev);
                return {
                  gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
                };
              })()}
            >
              {openPanelNodes.map((n) => renderNodePanel(n, n.nodeId === panelNode?.nodeId, true))}
            </div>
          ))
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

      {movingExtraCards && map && (
        <MoveCardsModal
          map={map}
          rootIds={movingExtraCards}
          onClose={() => setMovingExtraCards(null)}
          onMoved={(moved, target) => {
            const gone = new Set(moved.flatMap((id) => noteBranch(nodes, id)));
            setNodes((prev) => prev.filter((n) => !gone.has(n.nodeId)));
            setEdges((prev) => prev.filter((e) => !gone.has(nodeRefId(e.fromNodeId) ?? "") && !gone.has(nodeRefId(e.toNodeId) ?? "")));
            setSelectedId(null);
            setMovingExtraCards(null);
            showNotice(t.ui.cardFit.moved(moved.length, target.name));
          }}
        />
      )}


      {nodeMenu && (
        <NodeContextMenu
          // Remounts fresh (back to the root menu, not stuck on whatever
          // submenu the previous node's menu was showing) whenever the
          // target node changes.
          key={nodeMenu.node.nodeId}
          x={nodeMenu.x}
          y={nodeMenu.y}
          isOwner={isOwnNode(nodeMenu.node)}
          canAttack={canAttackNode(nodeMenu.node)}
          blockLocked={!!blockLocks[nodeMenu.node.nodeId]}
          onToggleBlockLock={isOwnNode(nodeMenu.node) ? () => toggleBlockLock(nodeMenu.node.nodeId) : undefined}
          puzzle={
            isOwnNode(nodeMenu.node) && drawnAsCard(nodeMenu.node)
              ? {
                  detached: !!detachedPieces[nodeMenu.node.nodeId],
                  assembled: puzzleClusterFor(nodeMenu.node).length > 1,
                  onDetach: () => detachPieces([nodeMenu.node.nodeId]),
                  onTakeApart: () => detachPieces(puzzleClusterFor(nodeMenu.node)),
                  onAttach: () => attachPiece(nodeMenu.node.nodeId),
                }
              : undefined
          }
          nodeType={nodeMenu.node.type}
          links={isOwnNode(nodeMenu.node) ? nodeLinkItems(nodeMenu.node) : undefined}
          onRemoveAllLinks={() => void runUnlinks(nodeLinkActions(nodeMenu.node))}
          zoneLayout={
            nodes.some((n) => nodeRefId(n.parentId) === nodeMenu.node.nodeId)
              ? {
                  value: zoneLayouts[nodeMenu.node.nodeId] ?? null,
                  onPick: (layout) => setZoneLayout(nodeMenu.node.nodeId, layout),
                }
              : undefined
          }
          zoneStyle={
            zoneStyleFor(nodeMenu.node.nodeId) && {
              ...zoneStyleFor(nodeMenu.node.nodeId)!,
              onChange: (patch) => setZoneStyle(nodeMenu.node.nodeId, patch),
            }
          }
          // A zone's parent: how this viewer reads its zone, same as the zone's own menu.
          zoneView={
            nodeGroups.some((g) => g.rootId === nodeMenu.node.nodeId)
              ? { value: zoneDisplay[nodeMenu.node.nodeId] ?? null, onPick: (m) => setZoneMode(nodeMenu.node.nodeId, m) }
              : undefined
          }
          feeling={
            nodeMenu.node.isWeapon
              ? undefined
              : { value: feelings[nodeMenu.node.nodeId], onPick: (f) => setFeeling(nodeMenu.node.nodeId, f) }
          }
          onClose={closeMenu}
          onCreate={() => {
            const anchor = nodeMenu.node;
            closeMenu();
            startBranchOf(anchor);
          }}
          onEdit={() => openNode(nodeMenu.node)}
          onChangeType={(type) => handleChangeNodeType(nodeMenu.node, type)}
          onDelete={() => {
            const node = nodeMenu.node;
            closeMenu();
            handleDeleteNode(node);
          }}
          onChoose={() => {
            const anchor = nodeMenu.node;
            closeMenu();
            startChooseFrom(anchor.nodeId);
          }}
          onAttack={closeMenu}
          onSplit={canSplitNode(nodeMenu.node) ? () => openSplit(nodeMenu.node) : undefined}
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
          actions={(() => {
            const actions = zoneActionsFor(zoneMenu.rootId);
            const rootId = zoneMenu.rootId;
            return actions && { ...actions, onExtractText: () => void extractClusterText(rootId) };
          })()}
          onPresent={() => presentZone(zoneMenu.rootId)}
          onClose={closeMenu}
        />
      )}
      {canvasMenu && (
        <CanvasContextMenu
          x={canvasMenu.screenX}
          y={canvasMenu.screenY}
          onClose={closeMenu}
          pasteCount={nodeClipboardSize()}
          onPasteHere={() => {
            const at = { x: canvasMenu.canvasX, y: canvasMenu.canvasY };
            closeMenu();
            pasteClipboard(at);
          }}
          onPick={(type) => {
            // Where the user right-clicked.
            closeMenu();
            startNodeAt({ x: canvasMenu.canvasX, y: canvasMenu.canvasY }, type);
          }}
          onGrow={(kind) => {
            const at = { x: canvasMenu.canvasX, y: canvasMenu.canvasY };
            closeMenu();
            setInlineEditId(null);
            void growStructure(kind, at);
          }}
          onQuiz={() => {
            closeMenu();
            startQuiz();
          }}
          onDrawPicture={() => {
            closeMenu();
            setInlineEditId(null);
            setPicturePickerAt({ x: canvasMenu.canvasX, y: canvasMenu.canvasY });
          }}
          onTextToNodes={() => {
            closeMenu();
            setInlineEditId(null);
            setSplitNode(null);
            setTextNodesAt({ x: canvasMenu.canvasX, y: canvasMenu.canvasY });
          }}
          onTextToMap={() => {
            closeMenu();
            navigate("/split");
          }}
        />
      )}

      {picturePickerAt && (
        <PicturePicker
          onClose={() => setPicturePickerAt(null)}
          onPick={(kind) => {
            const view = viewportBounds();
            const at =
              picturePickerAt === "view"
                ? { x: (view.minX + view.maxX) / 2, y: (view.minY + view.maxY) / 2 }
                : picturePickerAt;
            setPicturePickerAt(null);
            void drawPicture(kind, at);
          }}
        />
      )}

      {textNodesAt && (
        <TextToNodesModal
          key={splitNode?.nodeId ?? "text"}
          splitNode={splitNode ?? undefined}
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
          onClose={() => {
            setTextNodesAt(null);
            setSplitNode(null);
          }}
          mapNodes={visibleNodes.filter((n) => !n.isWeapon && n.nodeId !== splitNode?.nodeId).map((n) => ({ id: n.nodeId, label: linkLabel(n.nodeId) }))}
        />
      )}


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
          // The same export, scoped to this cluster's subtree, titled after its root.
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
