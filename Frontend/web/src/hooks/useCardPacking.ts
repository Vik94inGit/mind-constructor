import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import { cardsOverlap, DESKTOP_ASPECT, PACK_GAP, packCardsAround, packNewCards } from "../utils/cardPack";
import type { PackItem } from "../utils/cardPack";
import { hasCardSpot, storedSpots } from "../utils/cardSpace";
import { readingOrder } from "../utils/nodeOrder";
import type { Pt } from "./useCanvasMode";
import type { NodeDoc } from "../types";

// The most moves one request may carry (the backend's MAX_MOVED_NODES).
const MOVES_PER_REQUEST = 500;

interface Params {
  visibleNodes: NodeDoc[];
  /** Whether a node is a card on the board right now (the cards view). */
  onCardBoard: (node: NodeDoc) => boolean;
  isOwnNode: (node: NodeDoc) => boolean;
  /** Where a node rests on the canvas now (no glide or opening drift). */
  restingSpot: (node: NodeDoc) => Pt;
  /** False while cards can't be measured as they'll be drawn (the map's entrance grows them in). */
  ready: boolean;
  /** Someone else's cards laid out for this viewer only — MapPage holds it, since its positions read it. */
  packed: Map<string, Pt>;
  setPacked: Dispatch<SetStateAction<Map<string, Pt>>>;
  setNodes: Dispatch<SetStateAction<NodeDoc[]>>;
  upsertNode: (node: NodeDoc) => void;
  setActionError: (message: string | null) => void;
  moveFailedMessage: string;
  /** Several cards were laid out at once: the camera can take them all in. */
  onLaidOut?: () => void;
}

/**
 * The cards view keeps its cards close together (utils/cardPack.ts). A card
 * shown there for the first time, with no card spot yet, is packed in with
 * the others: under the cards already laid out, or round where the map is
 * when none is. "Lay the cards close" packs every card again, in reading
 * order. Your own cards' spots are saved (Node.cardX/cardY) like a drag, so
 * they stay put; someone else's are only laid out for you (`packed`).
 */
export function useCardPacking({
  visibleNodes,
  onCardBoard,
  isOwnNode,
  restingSpot,
  ready,
  packed,
  setPacked,
  setNodes,
  upsertNode,
  setActionError,
  moveFailedMessage,
  onLaidOut,
}: Params) {
  // Cards whose save failed: laid out locally from then on, not tried again.
  const failed = useRef(new Set<string>());

  // Measured off the cards as laid out: a card on the board is drawn in the
  // canvas's own units (NodeCard's canvasCard, no counter-scale), so its
  // layout size is its size on the board. Not the on-screen box divided by
  // the zoom: while the camera is still gliding (the entrance stepping back
  // to the whole map) the two disagree, and cards measured too small were
  // packed on top of each other.
  function measure(n: NodeDoc): PackItem | null {
    const el = document.querySelector<HTMLElement>(`[data-reveal-node="${CSS.escape(n.nodeId)}"] [data-puzzle-card]`);
    if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return null;
    return { id: n.nodeId, w: el.offsetWidth, h: el.offsetHeight };
  }

  // The block takes the screen's shape: wide on a desktop, tall on a phone.
  function aspect(): number {
    return typeof window === "undefined" || !window.innerHeight ? DESKTOP_ASPECT : window.innerWidth / window.innerHeight;
  }

  function centroid(ns: NodeDoc[]): Pt {
    const pts = ns.map(restingSpot);
    return {
      x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    };
  }

  async function place(cards: NodeDoc[], at: Map<string, Pt>) {
    const mine = cards.filter((n) => isOwnNode(n) && !failed.current.has(n.nodeId) && at.has(n.nodeId));
    const theirs = cards.filter((n) => !mine.includes(n) && at.has(n.nodeId));
    const mineIds = new Set(mine.map((n) => n.nodeId));
    setPacked((prev) => {
      const next = new Map(prev);
      for (const n of mine) next.delete(n.nodeId);
      for (const n of theirs) next.set(n.nodeId, at.get(n.nodeId)!);
      return next;
    });
    if (mine.length === 0) return;
    const before = new Map(mine.map((n) => [n.nodeId, storedSpots(n)]));
    setNodes((prev) =>
      prev.map((n) => (mineIds.has(n.nodeId) ? { ...n, cardX: at.get(n.nodeId)!.x, cardY: at.get(n.nodeId)!.y } : n)),
    );
    const moves = mine.map((n) => ({ nodeId: n.nodeId, cardX: at.get(n.nodeId)!.x, cardY: at.get(n.nodeId)!.y }));
    try {
      for (let i = 0; i < moves.length; i += MOVES_PER_REQUEST) {
        (await nodesApi.moveNodes(moves.slice(i, i + MOVES_PER_REQUEST))).forEach(upsertNode);
      }
    } catch {
      // Put back what didn't save, and keep it laid out just for this viewer.
      for (const id of mineIds) failed.current.add(id);
      setNodes((prev) => prev.map((n) => (before.has(n.nodeId) ? { ...n, ...before.get(n.nodeId)! } : n)));
      setPacked((prev) => {
        const next = new Map(prev);
        for (const id of mineIds) next.set(id, at.get(id)!);
        return next;
      });
      setActionError(moveFailedMessage);
    }
  }

  // Whether the board has been checked for cards lying on each other since
  // the cards view opened (see below).
  const overlapChecked = useRef(false);

  // New to the board: packed in once every card is drawn and measurable.
  // After each render, since a card's size is only known once it's drawn.
  useEffect(() => {
    const board = visibleNodes.filter(onCardBoard);
    if (board.length === 0) overlapChecked.current = false;
    if (!ready || board.length === 0) return;
    const fresh = board.filter((n) => !hasCardSpot(n) && !packed.has(n.nodeId));
    if (fresh.length === 0 && overlapChecked.current) return;
    const items = new Map<string, PackItem>();
    for (const n of board) {
      const box = measure(n);
      if (!box) return;
      items.set(n.nodeId, box);
    }
    // Opening the cards view: cards whose saved spots lie on each other
    // (from before cards kept clear of each other, or moved by someone else
    // meanwhile) are all laid close again, once.
    if (!overlapChecked.current) {
      overlapChecked.current = true;
      const spotted = board.filter((n) => hasCardSpot(n) || packed.has(n.nodeId));
      const at = new Map(spotted.map((n) => [n.nodeId, restingSpot(n)]));
      if (cardsOverlap(spotted.map((n) => items.get(n.nodeId)!), at)) {
        const all = readingOrder(board).map((n) => items.get(n.nodeId)!);
        void place(board, packCardsAround(all, centroid(board), PACK_GAP, aspect()));
        onLaidOut?.();
        return;
      }
      if (fresh.length === 0) return;
    }
    const freshIds = new Set(fresh.map((n) => n.nodeId));
    const placed = board.filter((n) => !freshIds.has(n.nodeId));
    const at = packNewCards(
      readingOrder(fresh).map((n) => items.get(n.nodeId)!),
      placed.map((n) => items.get(n.nodeId)!),
      new Map(placed.map((n) => [n.nodeId, restingSpot(n)])),
      centroid(fresh),
      PACK_GAP,
      aspect(),
    );
    void place(fresh, at);
    if (fresh.length > 1) onLaidOut?.();
  });

  /** Packs every card on the board again, close together in reading order, round where they are now. */
  function layCardsClose() {
    const board = visibleNodes.filter(onCardBoard);
    if (board.length === 0) return;
    const items: PackItem[] = [];
    for (const n of readingOrder(board)) {
      const box = measure(n);
      if (box) items.push(box);
    }
    void place(board, packCardsAround(items, centroid(board), PACK_GAP, aspect()));
    onLaidOut?.();
  }

  return { layCardsClose };
}
