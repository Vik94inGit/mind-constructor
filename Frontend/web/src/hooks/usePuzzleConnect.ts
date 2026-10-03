import { useState } from "react";
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import * as edgesApi from "../api/edges";
import { ApiRequestError } from "../api/client";
import { connectedPieces, findSnap } from "../utils/puzzleSnap";
import type { Snap, SnapPiece } from "../utils/puzzleSnap";
import type { PuzzleJoins } from "../utils/puzzleLinks";
import { pieceEdges } from "../map/PuzzleCard";
import { nodeRefId } from "../utils/nodeType";
import type { Pt } from "./useCanvasMode";
import type { EdgeDoc, NodeDoc } from "../types";

// How close (in screen pixels) a dragged puzzle piece has to come to a fitting
// one before it clicks in.
const SNAP_REACH_PX = 36;

interface Params {
  mapId: string | undefined;
  nodes: NodeDoc[];
  edges: EdgeDoc[];
  visibleNodes: NodeDoc[];
  zoom: number;
  /** The interlocking sides each piece shows — see utils/puzzleLinks.ts. */
  puzzleJoins: Map<string, PuzzleJoins>;
  isOwnNode: (node: NodeDoc) => boolean;
  /** Whether a node is drawn as a puzzle card right now — only those snap. */
  drawnAsCard: (node: NodeDoc) => boolean;
  posFor: (node: NodeDoc) => Pt;
  screenToCanvas: (clientX: number, clientY: number) => Pt;
  upsertEdge: (edge: EdgeDoc) => void;
  refreshInsights: (mapId: string) => void;
  setActionError: (message: string | null) => void;
  setContextMenu: (value: null) => void;
  /** Opens the link dialog for the two pieces a connect drag joined. */
  setPendingLink: Dispatch<SetStateAction<NodeDoc[] | null>>;
  linkFailedMessage: string;
}

export function usePuzzleConnect({
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
  linkFailedMessage,
}: Params) {
  // Connecting puzzle pieces: dragging out of a piece's tab (see PuzzleCard's
  // handles) draws a line to the pointer; letting go over another of your
  // own pieces opens the link dialog for the two, like the group bar's Link.
  // A link needs both ends to be yours (Backend's createEdgeAbl), and a pair
  // that's already linked can't be linked again.
  const [puzzleConnect, setPuzzleConnect] = useState<{
    fromId: string;
    to: { x: number; y: number };
    overId: string | null;
    valid: boolean;
  } | null>(null);
  function nodeIdAt(clientX: number, clientY: number): string | null {
    const el = document.elementFromPoint(clientX, clientY);
    return el?.closest("[data-reveal-node]")?.getAttribute("data-reveal-node") ?? null;
  }
  function canConnect(from: NodeDoc, to: NodeDoc | undefined): to is NodeDoc {
    if (!to || to.nodeId === from.nodeId || !isOwnNode(to)) return false;
    return !edges.some((e) => {
      const a = nodeRefId(e.fromNodeId);
      const b = nodeRefId(e.toNodeId);
      return (a === from.nodeId && b === to.nodeId) || (a === to.nodeId && b === from.nodeId);
    });
  }
  // Clicking pieces together (utils/puzzleSnap.ts): a puzzle card dragged
  // close to another one whose facing side has the opposite cut (a tab to a
  // blank) jumps flush into it. Measured off the cards as drawn, so the fit
  // matches what's on screen at any zoom. Only between pieces actually
  // drawn as cards (drawnAsCard) — not dots, not icons.
  function snapPiece(n: NodeDoc, at: { x: number; y: number }): SnapPiece | null {
    const el = document.querySelector(`[data-reveal-node="${CSS.escape(n.nodeId)}"] [data-puzzle-card]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      id: n.nodeId,
      x: at.x,
      y: at.y,
      w: r.width / zoom,
      h: r.height / zoom,
      edges: pieceEdges(n.nodeId, puzzleJoins.get(n.nodeId)),
    };
  }
  function puzzleSnapFor(node: NodeDoc, x: number, y: number): Snap | null {
    if (!drawnAsCard(node)) return null;
    const me = snapPiece(node, { x, y });
    if (!me) return null;
    // Only pieces near enough to possibly fit are measured.
    const near = (SNAP_REACH_PX + 600) / zoom;
    const others = visibleNodes.flatMap((n) => {
      if (n.nodeId === node.nodeId || !drawnAsCard(n)) return [];
      const p = posFor(n);
      if (Math.abs(p.x - x) > near || Math.abs(p.y - y) > near) return [];
      const piece = snapPiece(n, p);
      return piece ? [piece] : [];
    });
    return findSnap(me, others, SNAP_REACH_PX / zoom);
  }
  // An assembled puzzle moves as one: every piece clicked together with
  // `node` (linked to it, as a branch or a link, and sitting flush against it
  // — see connectedPieces), directly or through others: what drags as one,
  // and what locks and unlocks as one. A puzzle with any piece held in place
  // doesn't drag at all (see useNodeDragAndDrop).
  function puzzleClusterFor(node: NodeDoc): string[] {
    if (!drawnAsCard(node)) return [node.nodeId];
    const pieces = visibleNodes.flatMap((n) => {
      if (!drawnAsCard(n) || !isOwnNode(n)) return [];
      const piece = snapPiece(n, posFor(n));
      return piece ? [piece] : [];
    });
    const byId = new Map(nodes.map((n) => [n.nodeId, n]));
    const linked = (a: string, b: string) =>
      nodeRefId(byId.get(a)?.parentId) === b ||
      nodeRefId(byId.get(b)?.parentId) === a ||
      edges.some((e) => {
        const from = nodeRefId(e.fromNodeId);
        const to = nodeRefId(e.toNodeId);
        return (from === a && to === b) || (from === b && to === a);
      });
    return connectedPieces(node.nodeId, pieces, linked, 6);
  }
  // Pieces dropped clicked together are linked — from the piece whose tab
  // went in to the one whose blank took it, so the fit stays the way it's
  // drawn — when both are yours (a link needs both ends to be) and they
  // aren't linked yet.
  async function linkSnappedPieces(_node: NodeDoc, snap: Snap) {
    const from = nodes.find((n) => n.nodeId === snap.from);
    const to = nodes.find((n) => n.nodeId === snap.to);
    if (!from || !mapId || !isOwnNode(from) || !canConnect(from, to)) return;
    if (nodeRefId(from.parentId) === to.nodeId || nodeRefId(to.parentId) === from.nodeId) return;
    try {
      upsertEdge(await edgesApi.createEdge(mapId, { fromNodeId: from.nodeId, toNodeId: to.nodeId, sentiment: "neutral" }));
      refreshInsights(mapId);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : linkFailedMessage);
    }
  }

  function startPuzzleConnect(from: NodeDoc, e: ReactPointerEvent) {
    setContextMenu(null);
    const track = (clientX: number, clientY: number) => {
      const id = nodeIdAt(clientX, clientY);
      const overId = id && id !== from.nodeId ? id : null;
      setPuzzleConnect({
        fromId: from.nodeId,
        to: screenToCanvas(clientX, clientY),
        overId,
        valid: !!overId && canConnect(from, nodes.find((n) => n.nodeId === overId)),
      });
    };
    const onMove = (ev: PointerEvent) => track(ev.clientX, ev.clientY);
    const finish = (ev: PointerEvent, drop: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      setPuzzleConnect(null);
      // The release lands on whatever is under the pointer, which would
      // otherwise read as a click there (selecting a node, or closing the
      // panel on bare canvas).
      const swallow = (ce: MouseEvent) => ce.stopPropagation();
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      if (!drop) return;
      const to = nodes.find((n) => n.nodeId === nodeIdAt(ev.clientX, ev.clientY));
      if (canConnect(from, to)) setPendingLink([from, to]);
    };
    const onUp = (ev: PointerEvent) => finish(ev, true);
    const onCancel = (ev: PointerEvent) => finish(ev, false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    track(e.clientX, e.clientY);
  }

  return { puzzleConnect, puzzleSnapFor, puzzleClusterFor, linkSnappedPieces, startPuzzleConnect };
}
