import { useState } from "react";
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import * as edgesApi from "../api/edges";
import { ApiRequestError } from "../api/client";
import { clearOfCards, connectedPieces, findSnap } from "../utils/cardGlue";
import type { CardBox, Snap } from "../utils/cardGlue";
import { nodeRefId } from "../utils/nodeType";
import type { Pt } from "./useCanvasMode";
import type { EdgeDoc, NodeDoc } from "../types";

// How close (in screen pixels) a dragged card has to come to another before
// it glues on.
const SNAP_REACH_PX = 36;

interface Params {
  mapId: string | undefined;
  nodes: NodeDoc[];
  edges: EdgeDoc[];
  visibleNodes: NodeDoc[];
  zoom: number;
  isOwnNode: (node: NodeDoc) => boolean;
  /** Whether a node is a card on the board right now — only those glue and keep apart. */
  drawnAsCard: (node: NodeDoc) => boolean;
  posFor: (node: NodeDoc) => Pt;
  screenToCanvas: (clientX: number, clientY: number) => Pt;
  upsertEdge: (edge: EdgeDoc) => void;
  refreshInsights: (mapId: string) => void;
  setActionError: (message: string | null) => void;
  setContextMenu: (value: null) => void;
  /** Opens the link dialog for the two cards a connect drag joined. */
  setPendingLink: Dispatch<SetStateAction<NodeDoc[] | null>>;
  linkFailedMessage: string;
  /** Cards unglued on demand (see MapPage's detachedPieces): they stand alone until glued back. */
  isDetached?: (nodeId: string) => boolean;
}

export function usePuzzleConnect({
  mapId,
  nodes,
  edges,
  visibleNodes,
  zoom,
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
  isDetached = () => false,
}: Params) {
  // Linking cards: dragging out of a card's link handle (see StickerCard)
  // draws a line to the pointer; letting go over another of your own cards
  // opens the link dialog for the two, like the group bar's Link.
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
  // Gluing cards (utils/cardGlue.ts): a card dragged close to another jumps
  // flush against its nearest side. Measured off the cards as drawn, so the
  // fit matches what's on screen at any zoom. Only between cards on the
  // board (drawnAsCard) — not dots, not icons.
  function cardBox(n: NodeDoc, at: { x: number; y: number }): CardBox | null {
    const el = document.querySelector(`[data-reveal-node="${CSS.escape(n.nodeId)}"] [data-puzzle-card]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { id: n.nodeId, x: at.x, y: at.y, w: r.width / zoom, h: r.height / zoom };
  }
  // The board's other cards near (x, y), measured where they're drawn.
  function cardsNear(node: NodeDoc, x: number, y: number, skip: (n: NodeDoc) => boolean): CardBox[] {
    const near = (SNAP_REACH_PX + 900) / zoom;
    return visibleNodes.flatMap((n) => {
      if (n.nodeId === node.nodeId || !drawnAsCard(n) || skip(n)) return [];
      const p = posFor(n);
      if (Math.abs(p.x - x) > near || Math.abs(p.y - y) > near) return [];
      const box = cardBox(n, p);
      return box ? [box] : [];
    });
  }
  function puzzleSnapFor(node: NodeDoc, x: number, y: number): Snap | null {
    if (!drawnAsCard(node)) return null;
    const me = cardBox(node, { x, y });
    if (!me) return null;
    // An unglued card is no place to glue onto; the dragged card may be one,
    // though — gluing it to a card is how it rejoins.
    const others = cardsNear(node, x, y, (n) => isDetached(n.nodeId));
    const snap = findSnap(me, others, SNAP_REACH_PX / zoom);
    // A glue that would land on a third card isn't one.
    if (!snap) return null;
    const clear = clearOfCards({ ...me, x: snap.x, y: snap.y }, cardsNear(node, snap.x, snap.y, () => false));
    return clear.x === snap.x && clear.y === snap.y ? snap : null;
  }
  // Where a card let go at (x, y) can sit without covering another card:
  // the spot itself, or the nearest one clear of them (utils/cardGlue.ts).
  // null when `node` isn't a card on the board, so the usual placement applies.
  function cardClearSpot(node: NodeDoc, x: number, y: number): { x: number; y: number } | null {
    if (!drawnAsCard(node)) return null;
    const me = cardBox(node, { x, y });
    if (!me) return null;
    return clearOfCards(me, cardsNear(node, x, y, () => false));
  }
  // A glued block moves as one: every card glued to
  // `node` (linked to it, as a branch or a link, and sitting flush against it
  // — see connectedPieces), directly or through others: what drags as one,
  // and what locks and unlocks as one. A block with any card held in place
  // doesn't drag at all (see useNodeDragAndDrop).
  function puzzleClusterFor(node: NodeDoc): string[] {
    // An unglued card moves on its own, and the block it left moves without it.
    if (!drawnAsCard(node) || isDetached(node.nodeId)) return [node.nodeId];
    const pieces = visibleNodes.flatMap((n) => {
      if (!drawnAsCard(n) || !isOwnNode(n) || isDetached(n.nodeId)) return [];
      const box = cardBox(n, posFor(n));
      return box ? [box] : [];
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
  // Cards dropped glued together are linked — from the card glued onto to the
  // one brought to it — when both are yours (a link needs both ends to be)
  // and they aren't linked yet.
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

  return { puzzleConnect, puzzleSnapFor, puzzleClusterFor, linkSnappedPieces, startPuzzleConnect, cardClearSpot };
}
