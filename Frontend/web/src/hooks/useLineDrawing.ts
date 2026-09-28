import { useRef } from "react";
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import * as linesApi from "../api/lines";
import { ApiRequestError } from "../api/client";
import { isPointFree, isSegmentFree, snapToLines } from "../utils/drawLine";
import type { DrawObstacles } from "../utils/drawLine";
import { idOf } from "../utils/nodeType";
import type { CanvasModeAction, DrawBlockReason, Pt } from "./useCanvasMode";
import type { NodeGroup } from "../utils/canvasLayout";
import type { ReadingMode } from "../utils/readingMode";
import type { LineDoc, NodeDoc } from "../types";

interface Params {
  drawMode: boolean;
  drawPoints: Pt[];
  drawSaving: boolean;
  dispatchMode: Dispatch<CanvasModeAction>;
  visibleNodes: NodeDoc[];
  nodeGroups: NodeGroup[];
  linkCycles: string[][];
  posFor: (node: NodeDoc) => Pt;
  readingMode: ReadingMode;
  lines: LineDoc[];
  setLines: Dispatch<SetStateAction<LineDoc[]>>;
  upsertLine: (line: LineDoc) => void;
  mapId: string | undefined;
  setActionError: (message: string | null) => void;
  screenToCanvas: (clientX: number, clientY: number) => Pt;
  // Everything toggleDrawMode clears when drawing starts — same "close
  // whatever's open first" contract every other mode-entry point in
  // MapPage follows.
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setMultiSelectIds: Dispatch<SetStateAction<Set<string>>>;
  setContextMenu: (value: null) => void;
  setCanvasContextMenu: (value: null) => void;
  setPendingCreate: (value: null) => void;
  currentUserId: string | undefined;
  mapOwnerId: string | undefined;
  createFailedMessage: string;
  deleteConfirmMessage: string;
  deleteFailedMessage: string;
}

// Draw mode: a separator line a member draws on the map (see
// Backend/CLAUDE.md's own Line section) — takes over the canvas clicks and
// the bottom sheet, so anything else in progress steps aside first (see
// toggleDrawMode below).
export function useLineDrawing({
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
  currentUserId,
  mapOwnerId,
  createFailedMessage,
  deleteConfirmMessage,
  deleteFailedMessage,
}: Params) {
  // A blocked-spot/crossing flash (see addDrawPoint) clears itself after a
  // beat — this timer, and the hover ring's own rAF throttle below, are only
  // ever touched from within this hook, so they live here rather than in
  // MapPage.
  const drawBlockedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawHoverFrameRef = useRef<number | null>(null);

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
  function drawObstacles(): DrawObstacles {
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
  function drawRefusal(p: Pt): DrawBlockReason | null {
    const obstacles = drawObstacles();
    if (!isPointFree(p, obstacles)) return "spot";
    const last = drawPoints[drawPoints.length - 1];
    if (last && !isSegmentFree(last, p, obstacles)) return "crossing";
    return null;
  }

  function addDrawPoint(raw: Pt) {
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
      setActionError(err instanceof ApiRequestError ? err.message : createFailedMessage);
    } finally {
      dispatchMode({ type: "drawSetSaving", saving: false });
    }
  }

  // Whoever drew a line may delete it, and so may the map's owner.
  function canDeleteLine(line: LineDoc) {
    return idOf(line.userId as any) === currentUserId || mapOwnerId === currentUserId;
  }

  async function handleLineClick(line: LineDoc) {
    if (!canDeleteLine(line)) return;
    if (!confirm(deleteConfirmMessage)) return;
    setActionError(null);
    try {
      await linesApi.deleteLine(line.lineId);
      setLines((prev) => prev.filter((l) => l.lineId !== line.lineId));
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : deleteFailedMessage);
    }
  }

  return {
    toggleDrawMode,
    exitDrawMode,
    drawRefusal,
    addDrawPoint,
    undoDrawPoint,
    onDrawPointerMove,
    finishLine,
    canDeleteLine,
    handleLineClick,
  };
}
