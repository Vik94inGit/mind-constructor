import type { Dispatch, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import { ApiRequestError } from "../api/client";
import { nodeRefId } from "../utils/nodeType";
import type { Translation } from "../i18n/translations";
import type { NodeLinkItem } from "../map/NodeContextMenu";
import type { EdgeDoc, NodeDoc } from "../types";

export interface LinkAction {
  key: string;
  label: string;
  run: () => Promise<void>;
}

interface Params {
  mapId: string | undefined;
  nodes: NodeDoc[];
  edges: EdgeDoc[];
  isOwnNode: (node: NodeDoc) => boolean;
  upsertNode: (node: NodeDoc) => void;
  setEdges: Dispatch<SetStateAction<EdgeDoc[]>>;
  setActionError: (message: string | null) => void;
  refreshInsights: (mapId: string) => void;
  t: Translation;
}

// Taking links apart from a node's right-click menu ("Remove links ›"): its
// own tie to its parent, each of its children's ties to it (only the
// children that are yours — a parent link is the child's own field), and
// every link edge it's on. Unhooking a parent link leaves the node where
// it is, just with no parent.
export function useNodeLinks({ mapId, nodes, edges, isOwnNode, upsertNode, setEdges, setActionError, refreshInsights, t }: Params) {
  async function unhook(child: NodeDoc) {
    const updated = await nodesApi.updateNode(child.nodeId, { parentId: null });
    upsertNode(updated);
  }
  async function removeEdge(edgeId: string) {
    await edgesApi.deleteEdge(edgeId);
    setEdges((prev) => prev.filter((e) => e.edgeId !== edgeId));
  }
  // A node's name in a menu or a bar: its title or text on one line, cut short.
  function linkLabel(id: string | null | undefined): string {
    const n = id ? nodes.find((x) => x.nodeId === id) : undefined;
    if (!n) return "…";
    const text = (n.title || n.text || t.ui.types[n.type]).replace(/\s+/g, " ").trim();
    return text.length > 28 ? `${text.slice(0, 27)}…` : text;
  }
  function nodeLinkActions(node: NodeDoc): LinkAction[] {
    const out: LinkAction[] = [];
    const parentId = nodeRefId(node.parentId);
    if (parentId) {
      out.push({ key: `p-${parentId}`, label: t.ui.contextMenu.unlinkFromParent(linkLabel(parentId)), run: () => unhook(node) });
    }
    for (const child of nodes) {
      if (nodeRefId(child.parentId) !== node.nodeId || child.isWeapon || !isOwnNode(child)) continue;
      out.push({ key: `c-${child.nodeId}`, label: t.ui.contextMenu.unlinkChild(linkLabel(child.nodeId)), run: () => unhook(child) });
    }
    for (const e of edges) {
      const from = nodeRefId(e.fromNodeId);
      const to = nodeRefId(e.toNodeId);
      if (from !== node.nodeId && to !== node.nodeId) continue;
      const other = from === node.nodeId ? to : from;
      out.push({ key: `e-${e.edgeId}`, label: t.ui.contextMenu.unlinkEdge(linkLabel(other)), run: () => removeEdge(e.edgeId) });
    }
    return out;
  }
  async function runUnlinks(actions: { run: () => Promise<void> }[]) {
    setActionError(null);
    try {
      for (const a of actions) await a.run();
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.removeLink);
    } finally {
      if (mapId) refreshInsights(mapId);
    }
  }
  function nodeLinkItems(node: NodeDoc): NodeLinkItem[] {
    return nodeLinkActions(node).map((a) => ({ key: a.key, label: a.label, onRemove: () => void runUnlinks([a]) }));
  }
  return { linkLabel, nodeLinkActions, runUnlinks, nodeLinkItems };
}
