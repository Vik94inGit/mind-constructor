import type { Dispatch, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import { ApiRequestError } from "../api/client";
import type { CanvasModeAction } from "./useCanvasMode";
import type { NodeDoc } from "../types";

interface Params {
  /** The pack mode's own anchor and picks — see useCanvasMode. */
  packContainerId: string | null;
  packSelection: Set<string>;
  nodes: NodeDoc[];
  selectedId: string | null;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setMultiSelectIds: Dispatch<SetStateAction<Set<string>>>;
  dispatchMode: Dispatch<CanvasModeAction>;
  upsertNode: (node: NodeDoc) => void;
  setActionError: (message: string | null) => void;
  packFailedMessage: string;
}

// Pack mode: picking linked nodes to tuck away inside a container node (see
// packAbl.ts), from its panel's "Pack" through the pack picker's confirm.
export function usePackMode({
  packContainerId,
  packSelection,
  nodes,
  selectedId,
  setSelectedId,
  setMultiSelectIds,
  dispatchMode,
  upsertNode,
  setActionError,
  packFailedMessage,
}: Params) {
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
      dispatchMode({ type: "packSetError", error: err instanceof ApiRequestError ? err.message : packFailedMessage });
    }
  }

  return { startPackFrom, exitPackMode, packContainer, packPicks, confirmPackSelection };
}
