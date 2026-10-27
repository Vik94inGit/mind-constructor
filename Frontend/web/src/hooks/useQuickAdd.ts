import type { Dispatch, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import { ApiRequestError } from "../api/client";
import { NEW_NODE_ID } from "../utils/zoneRules";
import type { ExtraNode, MovingNode } from "../utils/zoneRules";
import type { ViewportBounds } from "../utils/canvasLayout";
import type { Translation } from "../i18n/translations";
import type { PendingCreate } from "./useNodeCreation";
import type { NodeDoc, NodeType } from "../types";

type Pt = { x: number; y: number };

interface Params {
  mapId: string | undefined;
  /** "Emoji first" (eye menu): the feeling is picked on the ring before the type. */
  emojiFirst: boolean;
  /** Where `moving` lands when put at `desired`, under the zone rules (MapPage's placeNode). */
  placeNode: (desired: Pt, moving: MovingNode[], extra?: ExtraNode[], opts?: { free?: boolean }) => Pt;
  posFor: (node: NodeDoc) => Pt;
  /** The spot just under a card, for a branch made from it (usePuzzleConnect). */
  cardBranchSpot: (parent: NodeDoc) => Pt | null;
  viewportBounds: () => ViewportBounds;
  setInlineEditId: Dispatch<SetStateAction<string | null>>;
  setPendingCreate: Dispatch<SetStateAction<PendingCreate | null>>;
  upsertNode: (node: NodeDoc) => void;
  setCelebrateIds: Dispatch<SetStateAction<Set<string>>>;
  setActionError: (message: string | null) => void;
  t: Translation;
}

// Starting a new node from the canvas: a quick-add ghost, a card's + button,
// a ghost dragged out of the ring, the "+" menu and the right-click menus.
// Each opens the pending-node input (PendingCreate) at a spot the zone rules
// allow; useNodeCreation makes the node once it's written.
export function useQuickAdd({
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
}: Params) {
  // Quick-add: clicking one of the half-visible type ghosts fanned around
  // the selected node opens the inline pending-node input at the ghost's
  // spot, pre-set to that type and already branching off the anchor via
  // parentId (a tree-lineage arrow, not a sentiment Edge/"link" — those
  // stay reserved for the explicit "Link nodes" flow). Nothing is created
  // until confirmPendingCreate actually fires.
  function startQuickAdd(type: NodeType, pos: Pt, parent: NodeDoc, text?: string, emoji?: string) {
    setActionError(null);
    // The ghost's slot is a fixed angle around the anchor — it doesn't know
    // about anything else on the canvas, so a crowded area can still land
    // it on top of another node or inside a zone the new node won't be in.
    // Nudge it to the nearest spot the zone rules allow (see placeNode)
    // before opening the input.
    const placed = placeNode(pos, [{ nodeId: NEW_NODE_ID, parentId: parent.nodeId }]);
    setInlineEditId(null);
    // Emoji first: the feeling was already picked (or skipped, "") on the
    // ring before the types. Otherwise it's offered around the new node.
    setPendingCreate({ x: placed.x, y: placed.y, type, parentId: parent.nodeId, prompt: text, emoji: emojiFirst ? (emoji ?? "") : undefined });
  }

  // A card has no quick-add ring (it would sit on top of the cards around
  // it), so the selected card's own + button branches from it instead: the
  // new node starts just under the card, and its type and feeling are picked
  // as it's written, like the right-click menu's Create branch.
  function addBranchFromCard(parent: NodeDoc) {
    setActionError(null);
    const pos = cardBranchSpot(parent) ?? placeNode(posFor(parent), [{ nodeId: NEW_NODE_ID, parentId: parent.nodeId }]);
    setInlineEditId(null);
    setPendingCreate({ x: pos.x, y: pos.y, type: "unknown", parentId: parent.nodeId });
  }

  // Draw first, write later: a type ghost dragged out of the selected node's
  // ring drops an empty node of that type where it was let go (nudged only
  // clear of other nodes, placeNode's free mode: the person aimed it there). The parent stays selected, so its ring
  // stays up for the next branch; the new node's text is written whenever
  // it's opened.
  async function sketchBranch(type: NodeType, pos: Pt, parent: NodeDoc) {
    if (!mapId) return;
    setActionError(null);
    const placed = placeNode(pos, [{ nodeId: NEW_NODE_ID, parentId: parent.nodeId }], [], { free: true });
    try {
      const node = await nodesApi.createNode(mapId, { text: "", type, x: placed.x, y: placed.y, parentId: parent.nodeId });
      upsertNode(node);
      setCelebrateIds((prev) => new Set(prev).add(node.nodeId));
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.createNode);
    }
  }

  // The right-click menu's Create branch: starts on the anchor itself;
  // placeNode moves it just clear of it (and of anything else the zone rules
  // keep it from), so the new child appears right beside its parent.
  function startBranchOf(anchor: NodeDoc) {
    const pos = placeNode(posFor(anchor), [{ nodeId: NEW_NODE_ID, parentId: anchor.nodeId }]);
    setInlineEditId(null);
    setPendingCreate({ x: pos.x, y: pos.y, type: "unknown", parentId: anchor.nodeId });
  }

  // A parent-less node of `type` at `at` (the empty canvas's right-click
  // menu) — nudged only if it would cover another node or break a zone rule.
  function startNodeAt(at: Pt, type: NodeType) {
    const pos = placeNode(at, [{ nodeId: NEW_NODE_ID, parentId: null }]);
    setInlineEditId(null);
    setPendingCreate({ x: pos.x, y: pos.y, type, parentId: null });
  }

  // "+" menu > Create node: a blank node input at a free spot in view, as
  // close to the middle of the view as the zone rules allow — next to
  // what's already there rather than somewhere random in the empty space.
  function startCreateNodeInView() {
    const view = viewportBounds();
    startNodeAt({ x: (view.minX + view.maxX) / 2, y: (view.minY + view.maxY) / 2 }, "unknown");
  }

  return { startQuickAdd, addBranchFromCard, sketchBranch, startBranchOf, startNodeAt, startCreateNodeInView };
}
