import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import { deletedGroupOf, restoreDeletedGroup } from "../utils/restoreNode";
import type { DeletedGroup } from "../utils/restoreNode";
import { nodeRefId } from "../utils/nodeType";
import type { EdgeDoc, NodeDoc } from "../types";

// The map's "Deleted" list: everything deleted on this map since it was
// opened — one node, a group, a zone, a template taken back — each of which
// can be put back, in any order, until the map is closed (the list lives in
// this page visit only). Each deletion is also a step on the undo stack
// (useMoveUndo), so Ctrl+Z / Undo brings back the latest; putting one back
// from the list takes its step off the stack.

export interface DeletedEntry {
  id: number;
  /** The first node's words (title, text or question) — what the list shows. */
  label: string;
  count: number;
  group: DeletedGroup;
}

/** Taken just before a delete: the nodes as they were, with their full text. */
export interface DeleteCapture {
  full: NodeDoc[];
  nodes: NodeDoc[];
  edges: EdgeDoc[];
}

/** Your own thought (not an attack or a shield, whose damage doesn't replay) can come back. */
export function isRestorable(n: NodeDoc, isOwn: (n: NodeDoc) => boolean): boolean {
  return !n.isWeapon && !n.isProtection && isOwn(n);
}

export function deletedLabel(n: NodeDoc): string {
  const words = (n.title || n.text || n.prompt || "").trim().replace(/\s+/g, " ");
  return words.length > 40 ? `${words.slice(0, 39)}…` : words;
}

interface Params {
  mapId: string | undefined;
  nodes: NodeDoc[];
  edges: EdgeDoc[];
  isOwnNode: (node: NodeDoc) => boolean;
  setNodes: Dispatch<SetStateAction<NodeDoc[]>>;
  setEdges: Dispatch<SetStateAction<EdgeDoc[]>>;
  upsertNode: (node: NodeDoc) => void;
  setCelebrateIds: Dispatch<SetStateAction<Set<string>>>;
  setActionError: (message: string | null) => void;
  refreshInsights: (mapId: string) => void;
  recordUndo: (run: () => Promise<void>, failMessage: string) => object;
  forgetUndo: (step: object) => void;
  failMessage: string;
}

export function useDeletedNodes({
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
  failMessage,
}: Params) {
  const [entries, setEntries] = useState<DeletedEntry[]>([]);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const steps = useRef(new Map<number, object>());
  const nextId = useRef(1);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  // Another map, another list: what was deleted here isn't offered there.
  useEffect(() => {
    setEntries([]);
    steps.current.clear();
  }, [mapId]);

  /** Before deleting `ids`: their full text and pictures (the node list comes without) and the map round them. */
  const capture = useCallback(
    async (ids: string[]): Promise<DeleteCapture> => {
      const byId = new Map(nodesRef.current.map((n) => [n.nodeId, n]));
      const restorable = ids.map((id) => byId.get(id)).filter((n): n is NodeDoc => !!n && isRestorable(n, isOwnNode));
      // A ghost has no text to fetch; anything else does.
      const full = await Promise.all(
        restorable.map((n) => (n.ghost ? n : nodesApi.getNode(n.nodeId).then((f) => ({ ...n, ...f })).catch(() => n))),
      );
      return { full, nodes: nodesRef.current, edges: edgesRef.current };
    },
    [isOwnNode],
  );

  const restoreEntry = useCallback(
    async (id: number) => {
      const entry = entriesRef.current.find((e) => e.id === id);
      if (!entry || !mapId) return;
      setEntries((prev) => prev.filter((e) => e.id !== id));
      const step = steps.current.get(id);
      if (step) forgetUndo(step);
      steps.current.delete(id);
      setActionError(null);
      try {
        const back = await restoreDeletedGroup(mapId, entry.group, new Set(nodesRef.current.map((n) => n.nodeId)));
        back.nodes.forEach(upsertNode);
        back.children.forEach(upsertNode);
        setEdges((prev) => [...prev, ...back.edges]);
        setCelebrateIds((prev) => {
          const next = new Set(prev);
          back.nodes.forEach((n) => next.add(n.nodeId));
          return next;
        });
        refreshInsights(mapId);
      } catch {
        // Kept in the list so it can be tried again.
        setEntries((prev) => [entry, ...prev]);
        setActionError(failMessage);
      }
    },
    [mapId, forgetUndo, setActionError, upsertNode, setEdges, setCelebrateIds, refreshInsights, failMessage],
  );

  /** After the delete: of what was captured, what really went joins the list (and the undo stack). */
  const remember = useCallback(
    (cap: DeleteCapture, deletedIds: string[]) => {
      const gone = new Set(deletedIds);
      const full = cap.full.filter((n) => gone.has(n.nodeId));
      if (full.length === 0) return;
      const id = nextId.current++;
      const group = deletedGroupOf(full, cap.nodes, cap.edges, isOwnNode);
      const entry: DeletedEntry = { id, label: deletedLabel(full[0]), count: full.length, group };
      setEntries((prev) => [entry, ...prev]);
      // restoreEntry reads entriesRef, which the next render fills in.
      entriesRef.current = [entry, ...entriesRef.current];
      steps.current.set(id, recordUndo(() => restoreEntry(id), failMessage));
    },
    [isOwnNode, recordUndo, restoreEntry, failMessage],
  );

  /** Deletes these nodes (those that are yours), keeping them in the list to put back. Returns what went. */
  const deleteNodes = useCallback(
    async (ids: string[]): Promise<string[]> => {
      const cap = await capture(ids);
      const { deleted } = await nodesApi.deleteManyNodes(ids);
      const deletedIds = deleted.map((d) => d.deletedId);
      const gone = new Set(deletedIds);
      // A shield releases its banked damage onto what it defended (Backend's deleteNodeDao).
      deleted.forEach(({ damagedProtectedNode }) => damagedProtectedNode && upsertNode(damagedProtectedNode));
      setNodes((prev) => prev.filter((n) => !gone.has(n.nodeId)));
      setEdges((prev) => prev.filter((e) => !gone.has(nodeRefId(e.fromNodeId) ?? "") && !gone.has(nodeRefId(e.toNodeId) ?? "")));
      remember(cap, deletedIds);
      if (mapId) refreshInsights(mapId);
      return deletedIds;
    },
    [capture, remember, upsertNode, setNodes, setEdges, mapId, refreshInsights],
  );

  return { deletedEntries: entries, capture, remember, restoreEntry, deleteNodes };
}
