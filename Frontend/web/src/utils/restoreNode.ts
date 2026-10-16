import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import { nodeRefId } from "./nodeType";
import type { EdgeDoc, NodeDoc } from "../types";

// Undo for deleting a node. Deleting drops the node, its link edges and its
// children's tie to it (see Backend's deleteNodeDao), so what's kept here is
// enough to put all three back: the node itself (with its full text and
// pictures), which of your own nodes hung from it, and the edges it was on.
// The node comes back as a new node (a new id) in the same spot.
export interface DeletedNode {
  node: NodeDoc;
  childIds: string[];
  edges: EdgeDoc[];
}

export function deletedNodeOf(
  node: NodeDoc,
  nodes: NodeDoc[],
  edges: EdgeDoc[],
  isOwn: (n: NodeDoc) => boolean,
): DeletedNode {
  return {
    node,
    // Only your own children: re-hanging a node is its owner's edit.
    childIds: nodes.filter((n) => nodeRefId(n.parentId) === node.nodeId && !n.isWeapon && isOwn(n)).map((n) => n.nodeId),
    edges: edges.filter((e) => nodeRefId(e.fromNodeId) === node.nodeId || nodeRefId(e.toNodeId) === node.nodeId),
  };
}

// Fields createNode doesn't take, put back with one PATCH when the node had them.
const AFTER_CREATE = ["zoneName", "shape", "zonePattern", "zoneColor", "cardX", "cardY", "iconImage", "cardImage"] as const;

export async function restoreDeletedNode(
  mapId: string,
  deleted: DeletedNode,
): Promise<{ node: NodeDoc; children: NodeDoc[]; edges: EdgeDoc[] }> {
  const n = deleted.node;
  let node = await nodesApi.createNode(mapId, {
    text: n.text ?? "",
    title: n.title || undefined,
    prompt: n.prompt || undefined,
    emoji: n.emoji || undefined,
    order: n.order ?? null,
    type: n.type,
    x: n.x,
    y: n.y,
    color: n.color,
    parentId: nodeRefId(n.parentId) ?? null,
    symbolOverride: n.symbolOverride ?? null,
    sizeTier: n.sizeTier ?? null,
    manualZone: n.manualZone ?? null,
  });
  const extra: Partial<NodeDoc> = {};
  for (const key of AFTER_CREATE) {
    const v = n[key];
    if (v !== undefined && v !== null && v !== "") Object.assign(extra, { [key]: v });
  }
  if (n.images?.length) extra.images = n.images;
  if (Object.keys(extra).length) node = await nodesApi.updateNode(node.nodeId, extra);

  const children = await Promise.all(deleted.childIds.map((id) => nodesApi.updateNode(id, { parentId: node.nodeId })));
  const swap = (id: string | null | undefined) => (id === n.nodeId ? node.nodeId : (id ?? ""));
  const edges = await Promise.all(
    deleted.edges.map((e) =>
      edgesApi.createEdge(mapId, {
        fromNodeId: swap(nodeRefId(e.fromNodeId)),
        toNodeId: swap(nodeRefId(e.toNodeId)),
        sentiment: e.sentiment,
      }),
    ),
  );
  return { node, children, edges };
}
