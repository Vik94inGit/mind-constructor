import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import { nodeRefId } from "./nodeType";
import type { EdgeDoc, NodeDoc } from "../types";

// Bringing deleted nodes back. Deleting drops the nodes, their link edges
// and their children's tie to them (see Backend's deleteNodeDao); deleting
// one node also takes along its leaf children (leafChildrenOf: your own
// children that are no parent themselves). What's kept here is enough to put
// it all back: the nodes themselves (with their full text and pictures),
// which of your own nodes that stayed hung from them, and the edges any of
// them were on. Everything comes back as new nodes (new ids) in the same
// spots, parents first so the ones hanging from each other hang again.
export interface DeletedGroup {
  /** The deleted nodes, the one the person deleted first. */
  nodes: NodeDoc[];
  /** Your own nodes that stayed (outside the group) and hung from one in it: re-hung on restore. */
  children: { nodeId: string; parentId: string }[];
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

/** What it takes to bring `gone` back, read off the map as it was just before they went. */
export function deletedGroupOf(
  gone: NodeDoc[],
  nodes: NodeDoc[],
  edges: EdgeDoc[],
  isOwn: (n: NodeDoc) => boolean,
): DeletedGroup {
  const goneIds = new Set(gone.map((n) => n.nodeId));
  return {
    nodes: gone,
    // Only your own children: re-hanging a node is its owner's edit.
    children: nodes
      .filter((n) => !goneIds.has(n.nodeId) && goneIds.has(nodeRefId(n.parentId) ?? "") && !n.isWeapon && isOwn(n))
      .map((n) => ({ nodeId: n.nodeId, parentId: nodeRefId(n.parentId)! })),
    edges: edges.filter((e) => goneIds.has(nodeRefId(e.fromNodeId) ?? "") || goneIds.has(nodeRefId(e.toNodeId) ?? "")),
  };
}

/** The group's nodes ordered so each comes after the one in the group it hangs from. */
export function parentsFirst(nodes: NodeDoc[]): NodeDoc[] {
  const ids = new Set(nodes.map((n) => n.nodeId));
  const out: NodeDoc[] = [];
  const done = new Set<string>();
  let left = nodes;
  while (left.length) {
    const ready = left.filter((n) => {
      const p = nodeRefId(n.parentId) ?? "";
      return !ids.has(p) || done.has(p);
    });
    // A loop can't happen in a tree, but never spin forever on bad data.
    const next = ready.length ? ready : [left[0]];
    next.forEach((n) => {
      out.push(n);
      done.add(n.nodeId);
    });
    left = left.filter((n) => !done.has(n.nodeId));
  }
  return out;
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

/**
 * Puts a deleted group back. `onMap`: the ids on the map now — a parent or a
 * linked node that has gone since isn't hung from or linked to, and the
 * children and edges that can't come back are skipped rather than failing it all.
 */
export async function restoreDeletedGroup(
  mapId: string,
  deleted: DeletedGroup,
  onMap: Set<string>,
): Promise<{ nodes: NodeDoc[]; children: NodeDoc[]; edges: EdgeDoc[] }> {
  const newIds = new Map<string, string>();
  const byOldId = new Map<string, NodeDoc>();
  for (const n of parentsFirst(deleted.nodes)) {
    const p = nodeRefId(n.parentId) ?? null;
    const parentId = p === null ? null : (newIds.get(p) ?? (onMap.has(p) ? p : null));
    const back = await recreate(mapId, n, parentId);
    newIds.set(n.nodeId, back.nodeId);
    byOldId.set(n.nodeId, back);
  }
  // In the group's own order: the one deleted first leads.
  const nodes = deleted.nodes.map((n) => byOldId.get(n.nodeId)!);
  const fulfilled = <T>(r: PromiseSettledResult<T>[]) =>
    r.flatMap((x) => (x.status === "fulfilled" ? [x.value] : []));
  const children = fulfilled(
    await Promise.allSettled(
      deleted.children
        .filter((c) => onMap.has(c.nodeId) && newIds.has(c.parentId))
        .map((c) => nodesApi.updateNode(c.nodeId, { parentId: newIds.get(c.parentId)! })),
    ),
  );
  const swap = (id: string) => newIds.get(id) ?? (onMap.has(id) ? id : null);
  const edges = fulfilled(
    await Promise.allSettled(
      deleted.edges.flatMap((e) => {
        const from = swap(nodeRefId(e.fromNodeId) ?? "");
        const to = swap(nodeRefId(e.toNodeId) ?? "");
        return from && to ? [edgesApi.createEdge(mapId, { fromNodeId: from, toNodeId: to, sentiment: e.sentiment })] : [];
      }),
    ),
  );
  return { nodes, children, edges };
}
