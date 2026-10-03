import type { Dispatch, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import { ApiRequestError } from "../api/client";
import { CANVAS_W, CANVAS_H, isDescendant } from "../utils/canvasLayout";
import { closestToCentroidIndex } from "../utils/mapGraph";
import { nodeRefId } from "../utils/nodeType";
import type { Translation } from "../i18n/translations";
import type { EdgeDoc, NodeDoc } from "../types";

type Pt = { x: number; y: number };

interface Params {
  mapId: string | undefined;
  nodes: NodeDoc[];
  positions: Map<string, Pt>;
  multiSelectIds: Set<string>;
  isOwnNode: (node: NodeDoc) => boolean;
  upsertNode: (node: NodeDoc) => void;
  setNodes: Dispatch<SetStateAction<NodeDoc[]>>;
  setEdges: Dispatch<SetStateAction<EdgeDoc[]>>;
  setMultiSelectIds: Dispatch<SetStateAction<Set<string>>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  showNodes: (ids: string[]) => void;
  setActionError: (message: string | null) => void;
  refreshInsights: (mapId: string) => void;
  t: Translation;
}

// The group bar's bulk actions on the chosen nodes (multiSelectIds): delete
// them, group them into a circle, or number them in order.
export function useSelectionActions({
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
}: Params) {
  // SelectionMenu's "Delete N nodes" — one bulk DELETE /api/nodes request
  // (Backend's deleteManyNodesDao) instead of N parallel single-node
  // DELETEs. Confirms once for the whole batch rather than once per node
  // (the single-node handleDeleteNode's own confirm() would be absurd N
  // times in a row here). The backend silently skips any id the caller
  // doesn't own instead of failing the whole batch, so `deleted` can be a
  // strict subset of `ids` — local state is reconciled against `deleted`,
  // not the original selection, so a partial delete doesn't drop nodes that
  // were never actually removed.
  async function deleteSelection() {
    const ids = Array.from(multiSelectIds);
    if (ids.length === 0) return;
    if (!confirm(t.ui.selection.deleteConfirm(ids.length))) return;
    setActionError(null);
    try {
      const { deleted } = await nodesApi.deleteManyNodes(ids);
      const deletedIds = new Set(deleted.map((d) => d.deletedId));
      // Any protection node in the batch releases its own banked damage
      // onto whatever it was defending — see Backend's deleteNodeDao.
      deleted.forEach(({ damagedProtectedNode }) => {
        if (damagedProtectedNode) upsertNode(damagedProtectedNode);
      });
      setNodes((prev) => prev.filter((n) => !deletedIds.has(n.nodeId)));
      setEdges((prev) =>
        prev.filter(
          (e) => !deletedIds.has(nodeRefId(e.fromNodeId) ?? "") && !deletedIds.has(nodeRefId(e.toNodeId) ?? ""),
        ),
      );
      setMultiSelectIds(new Set());
      if (mapId) refreshInsights(mapId);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.deleteSelected);
    }
  }

  // SelectionMenu's "Group into circle" — turns the current multi-selection
  // into a circle (see circleAbl.ts / the app's own parentId-star mechanism,
  // same as dragging one node onto another to join its circle): every
  // selected node except one gets its parentId set to that one, so with
  // 3+ selected the result is immediately a real circle (nodeGroups needs
  // 2+ direct children); with exactly 2, it's just a plain branch link
  // until a third node joins later. The root is picked automatically —
  // whichever selected node sits closest to the group's own centroid —
  // since there's no per-node "make this the root" control on this pill.
  // isDescendant guards each reparent the same way findDropTarget's own
  // drag-to-join path already does: skip (don't create) a link that would
  // close the parentId chain into a loop, rather than silently corrupting
  // the tree.
  async function groupSelectionIntoCircle() {
    const selectedNodes = Array.from(multiSelectIds)
      .map((id) => nodes.find((n) => n.nodeId === id))
      .filter((n): n is NodeDoc => !!n);
    if (selectedNodes.length < 2) return;
    const pts = selectedNodes.map((n) => positions.get(n.nodeId) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 });
    const root = selectedNodes[closestToCentroidIndex(pts)];
    const others = selectedNodes.filter((n) => n.nodeId !== root.nodeId);
    setActionError(null);
    try {
      const results = await Promise.all(
        others.map(async (n) => {
          if (isDescendant(root.nodeId, n.nodeId, nodes)) return null;
          return nodesApi.updateNode(n.nodeId, { parentId: root.nodeId });
        }),
      );
      results.forEach((n) => {
        if (n) upsertNode(n);
      });
      const skipped = results.filter((r) => r === null).length;
      if (skipped > 0) {
        setActionError(t.ui.errors.groupPartial(results.length - skipped, others.length, skipped));
      }
      setMultiSelectIds(new Set());
      setSelectedId(root.nodeId);
      showNodes(selectedNodes.map((n) => n.nodeId));
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.groupCircle);
    }
  }

  // The chosen own nodes, numbered 1, 2, 3… in the order they were chosen (or
  // with the numbers taken off) — a quick way to label a process's steps.
  async function numberSelection(clear: boolean) {
    const picks = Array.from(multiSelectIds)
      .map((id) => nodes.find((n) => n.nodeId === id))
      .filter((n): n is NodeDoc => !!n && isOwnNode(n));
    if (picks.length === 0) return;
    setActionError(null);
    try {
      const updated = await Promise.all(
        picks.map((n, i) => nodesApi.updateNode(n.nodeId, { order: clear ? null : i + 1 })),
      );
      updated.forEach(upsertNode);
      showNodes(picks.map((n) => n.nodeId));
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.numberNodes);
    }
  }

  return { deleteSelection, groupSelectionIntoCircle, numberSelection };
}
