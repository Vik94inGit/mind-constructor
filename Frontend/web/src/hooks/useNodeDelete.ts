import type { Dispatch, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import { ApiRequestError } from "../api/client";
import { useConfirm } from "../context/ConfirmContext";
import { leafChildrenOf } from "../utils/restoreNode";
import type { DeleteCapture } from "./useDeletedNodes";
import { nodeRefId } from "../utils/nodeType";
import type { Translation } from "../i18n/translations";
import type { EdgeDoc, NodeDoc } from "../types";

interface Params {
  mapId: string | undefined;
  nodes: NodeDoc[];
  isOwnNode: (node: NodeDoc) => boolean;
  setNodes: Dispatch<SetStateAction<NodeDoc[]>>;
  setEdges: Dispatch<SetStateAction<EdgeDoc[]>>;
  upsertNode: (node: NodeDoc) => void;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setActionError: (message: string | null) => void;
  showNotice: (message: string) => void;
  refreshInsights: (mapId: string) => void;
  /** useDeletedNodes: what's deleted goes into the map's Deleted list (and on the undo stack). */
  capture: (ids: string[]) => Promise<DeleteCapture>;
  remember: (cap: DeleteCapture, deletedIds: string[]) => void;
  t: Translation;
}

// Deleting a node, from its panel, its right-click menu or the keyboard.
export function useNodeDelete({
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
}: Params) {
  const confirm = useConfirm();

  // Shared by the side panel's own Delete button and the context menu's —
  // whichever surface the delete was actually requested from, the local
  // state cleanup (and the resulting deselect) is identical.
  function applyNodeDeleted(id: string) {
    setNodes((prev) => prev.filter((n) => n.nodeId !== id));
    setEdges((prev) => prev.filter((e) => nodeRefId(e.fromNodeId) !== id && nodeRefId(e.toNodeId) !== id));
    setSelectedId(null);
    if (mapId) refreshInsights(mapId);
  }

  // An ordinary node can be brought back with undo (see utils/restoreNode.ts),
  // so it goes without a confirm; a weapon or protection node can't (its
  // damage and shields don't replay), so that one still asks first. Resolves
  // false when the person changed their mind. Throws when the delete fails.
  async function deleteNodeWithUndo(node: NodeDoc): Promise<boolean> {
    const undoable = !node.isWeapon && !node.isProtection;
    if (!undoable && !(await confirm(t.ui.node.deleteConfirm, { confirmLabel: t.ui.common.delete, danger: true }))) return false;
    // Its leaf children go with it (one generation down, never a child that
    // is a parent itself — see leafChildrenOf).
    const leaves = undoable ? leafChildrenOf(node, nodes, isOwnNode) : [];
    // Taken before it goes: its full text and pictures, and the map round it.
    const cap = undoable ? await capture([node.nodeId, ...leaves.map((l) => l.nodeId)]) : null;
    const res = await nodesApi.deleteNode(node.nodeId);
    applyNodeDeleted(node.nodeId);
    const gone = [node.nodeId];
    if (leaves.length) {
      const { deleted } = await nodesApi.deleteManyNodes(leaves.map((l) => l.nodeId));
      deleted.forEach((g) => {
        applyNodeDeleted(g.deletedId);
        gone.push(g.deletedId);
      });
    }
    // Deleting a protection node with banked damage releases the whole
    // total onto whatever it was defending — see Backend's deleteNodeDao.
    if (res.damagedProtectedNode) upsertNode(res.damagedProtectedNode);
    if (cap?.full.length) {
      remember(cap, gone);
      showNotice(t.ui.node.deletedUndo);
    }
    return true;
  }

  // The context menu's and the keyboard's delete: a failure shows in the banner.
  async function handleDeleteNode(node: NodeDoc) {
    try {
      await deleteNodeWithUndo(node);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.delete);
    }
  }

  return { deleteNodeWithUndo, handleDeleteNode };
}
