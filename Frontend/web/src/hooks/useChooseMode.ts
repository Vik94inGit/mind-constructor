import type { Dispatch, SetStateAction } from "react";
import { collectBranchIds } from "../utils/mapGraph";
import type { CanvasModeAction } from "./useCanvasMode";
import type { NodeDoc } from "../types";

interface Params {
  nodes: NodeDoc[];
  visibleNodes: NodeDoc[];
  isOwnNode: (node: NodeDoc) => boolean;
  multiSelectIds: Set<string>;
  setMultiSelectIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  dispatchMode: Dispatch<CanvasModeAction>;
  /** Opens the sentiment modal that links the chosen nodes. */
  setPendingLink: (nodes: NodeDoc[]) => void;
}

// Choose mode: a tap on one of your own nodes adds it to / drops it from the
// group selection (multiSelectIds — the same one shift+click and the marquee
// build), instead of opening that node's panel. The group bar then offers
// what to do with the chosen nodes: link, copy or delete them.
export function useChooseMode({
  nodes,
  visibleNodes,
  isOwnNode,
  multiSelectIds,
  setMultiSelectIds,
  setSelectedId,
  dispatchMode,
  setPendingLink,
}: Params) {
  // Every own node below `rootId` in the branch tree, in reading order — see
  // collectBranchIds.
  function branchIds(rootId: string): string[] {
    return collectBranchIds(rootId, visibleNodes, isOwnNode);
  }

  // Enters choose mode with `nodeId` already chosen — from a node's own
  // "Choose…" (its panel or right-click menu). Drops the single selection: the
  // group bar takes over the bottom sheet, and NodePanel can't share it.
  function startChooseFrom(nodeId: string) {
    setSelectedId(null);
    dispatchMode({ type: "chooseStart" });
    setMultiSelectIds(new Set([nodeId, ...branchIds(nodeId)]));
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

  return { branchIds, startChooseFrom, exitChooseMode, linkSelection };
}
