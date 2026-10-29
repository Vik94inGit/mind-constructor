import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import { nodeRefId } from "./nodeType";
import type { EdgeDoc, NodeDoc } from "../types";

// Undo for deleting a node. Deleting drops the node, its link edges and its
// children's tie to it (see Backend's deleteNodeDao), and takes along its
// leaf children (leafChildrenOf: your own children that are no parent
// themselves). What's kept here is enough to put it all back: the node itself
// (with its full text and pictures), the leaves deleted with it, which of
// your own nodes hung from it, and the edges any of them were on. Everything
// comes back as new nodes (new ids) in the same spots.
export interface DeletedNode {
  node: NodeDoc;
  /** Children that stayed (they're parents themselves), re-hung on undo. */
  childIds: string[];
  /** Children deleted along with it. */
  leaves: NodeDoc[];
  edges: EdgeDoc[];
}

/**
 * The children that go when `node` is deleted: one generation down, your own
 * children that have no children of their own. A child that is itself a
 * parent stays, with its own branch, and just loses its tie to `node`.
 * Attacks and shields aren't children here (the server handles those).
 */
export function leafChildrenOf(node: NodeDoc, nodes: NodeDoc[], isOwn: (n: NodeDoc) => boolean): NodeDoc[] {
  const parents = new Set(nodes.filter((n) => !n.isWeapon).map((n) => nodeRefId(n.parentId)));
  return nodes.filter(
    (n) =>
      nodeRefId(n.parentId) === node.nodeId &&
      !n.isWeapon &&
      !n.isProtection &&
      isOwn(n) &&
      !parents.has(n.nodeId),
  );
}

export function deletedNodeOf(
  node: NodeDoc,
  nodes: NodeDoc[],
  edges: EdgeDoc[],
  isOwn: (n: NodeDoc) => boolean,
  leaves: NodeDoc[] = [],
): DeletedNode {
  const leafIds = new Set(leaves.map((l) => l.nodeId));
  const gone = new Set([node.nodeId, ...leafIds]);
  return {
    node,
    // Only your own children: re-hanging a node is its owner's edit.
    childIds: nodes
      .filter((n) => nodeRefId(n.parentId) === node.nodeId && !n.isWeapon && isOwn(n) && !leafIds.has(n.nodeId))
      .map((n) => n.nodeId),
    leaves,
    edges: edges.filter((e) => gone.has(nodeRefId(e.fromNodeId) ?? "") || gone.has(nodeRefId(e.toNodeId) ?? "")),
  };
}

// Fields createNode doesn't take, put back with one PATCH when the node had them.
const AFTER_CREATE = ["zoneName", "shape", "zonePattern", "zoneColor", "cardX", "cardY", "iconImage", "cardImage"] as const;

async function recreate(mapId: string, n: NodeDoc, parentId: string | null): Promise<NodeDoc> {
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
    parentId,
    symbolOverride: n.symbolOverride ?? null,
    sizeTier: n.sizeTier ?? null,
    manualZone: n.manualZone ?? null,
    picture: n.picture ?? null,
  });
  const extra: Partial<NodeDoc> = {};
  for (const key of AFTER_CREATE) {
    const v = n[key];
    if (v !== undefined && v !== null && v !== "") Object.assign(extra, { [key]: v });
  }
  if (n.images?.length) extra.images = n.images;
  if (Object.keys(extra).length) node = await nodesApi.updateNode(node.nodeId, extra);
  return node;
}

export async function restoreDeletedNode(
  mapId: string,
  deleted: DeletedNode,
): Promise<{ node: NodeDoc; leaves: NodeDoc[]; children: NodeDoc[]; edges: EdgeDoc[] }> {
  const n = deleted.node;
  const node = await recreate(mapId, n, nodeRefId(n.parentId) ?? null);
  const newIds = new Map<string, string>([[n.nodeId, node.nodeId]]);
  const leaves = await Promise.all(
    deleted.leaves.map(async (leaf) => {
      const back = await recreate(mapId, leaf, node.nodeId);
      newIds.set(leaf.nodeId, back.nodeId);
      return back;
    }),
  );
  const children = await Promise.all(deleted.childIds.map((id) => nodesApi.updateNode(id, { parentId: node.nodeId })));
  const swap = (id: string | null | undefined) => newIds.get(id ?? "") ?? id ?? "";
  const edges = await Promise.all(
    deleted.edges.map((e) =>
      edgesApi.createEdge(mapId, {
        fromNodeId: swap(nodeRefId(e.fromNodeId)),
        toNodeId: swap(nodeRefId(e.toNodeId)),
        sentiment: e.sentiment,
      }),
    ),
  );
  return { node, leaves, children, edges };
}
