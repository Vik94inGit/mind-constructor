import { isDescendant } from "./canvasLayout";
import { nodeRefId, zoneParentId } from "./nodeType";
import type { EdgeDoc, NodeDoc } from "../types";

type Pt = { x: number; y: number };

// Changing a node's parent (MapPage's change-parent mode): the node tapped
// becomes the parent. The child keeps its own branch; the zones it leaves and
// joins redraw from the new parentId (computeNodeGroups), and the child moves
// in next to its new parent when it sits too far out for the zone to reach it
// without stretching across the map (see redirectSpot).

/** Why `target` can't become the child's parent, or null when it can. */
export type RedirectRefusal = "same" | "ownBranch" | "notOwn" | "attack";

export function redirectRefusal(
  child: NodeDoc,
  target: NodeDoc | undefined,
  nodes: NodeDoc[],
  isOwnNode: (node: NodeDoc) => boolean,
): RedirectRefusal | null {
  if (!target || target.nodeId === child.nodeId || target.nodeId === nodeRefId(child.parentId)) return "same";
  // A parent link is the child's own field, and the backend takes only a
  // parent of the caller's own (updateNodeAbl's ParentNotOwnedError).
  if (!isOwnNode(child) || !isOwnNode(target)) return "notOwn";
  // Under its own descendant the branch would close into a loop.
  if (isDescendant(target.nodeId, child.nodeId, nodes)) return "ownBranch";
  // An attack stays tied to what it hit: it only hangs from another attack,
  // the same rule as dropping one (useNodeDragAndDrop's findDropTarget).
  if (child.isWeapon && !target.isWeapon) return "attack";
  return null;
}

// How far from its new parent, in zone reaches (getZoneReach), a child may
// sit and stay where it is. Past it the child is brought in to this fraction
// of a reach, on the side it already sits, so the new zone keeps its shape.
export const REDIRECT_KEEP_FACTOR = 1.5;
export const REDIRECT_BRING_FACTOR = 0.9;

/** Where the redirected child should sit before the zone rules settle it: where it is, or in toward its new parent. */
export function redirectSpot(child: Pt, parent: Pt, reach: number): Pt {
  const dx = child.x - parent.x;
  const dy = child.y - parent.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= reach * REDIRECT_KEEP_FACTOR) return child;
  if (dist === 0) return { x: parent.x + reach * REDIRECT_BRING_FACTOR, y: parent.y };
  const k = (reach * REDIRECT_BRING_FACTOR) / dist;
  return { x: parent.x + dx * k, y: parent.y + dy * k };
}

/**
 * The links (Edge documents) tying `childId` to its old parent, which move
 * with it to the new one: each is taken off and put back to the new parent,
 * same direction and feeling, unless the child is already linked to it.
 */
export function linksToMove(
  childId: string,
  oldParentId: string | null,
  newParentId: string,
  edges: EdgeDoc[],
): { remove: EdgeDoc[]; create: { fromNodeId: string; toNodeId: string; sentiment: EdgeDoc["sentiment"] }[] } {
  if (!oldParentId) return { remove: [], create: [] };
  const joins = (e: EdgeDoc, a: string, b: string) => {
    const x = nodeRefId(e.fromNodeId);
    const y = nodeRefId(e.toNodeId);
    return (x === a && y === b) || (x === b && y === a);
  };
  const remove = edges.filter((e) => joins(e, childId, oldParentId));
  // One link between two nodes is all there can be (Backend's createEdgeAbl).
  if (remove.length === 0 || edges.some((e) => joins(e, childId, newParentId))) return { remove, create: [] };
  const first = remove[0];
  const childFirst = nodeRefId(first.fromNodeId) === childId;
  return {
    remove,
    create: [
      {
        fromNodeId: childFirst ? childId : newParentId,
        toNodeId: childFirst ? newParentId : childId,
        sentiment: first.sentiment,
      },
    ],
  };
}

/** A node's spot and parent after it, or its old parent, changes places (see takeParentPlace). */
export interface HeadPatch {
  nodeId: string;
  parentId: string | null;
  x: number;
  y: number;
}

export interface HeadPlan {
  /** In the order to save them: the child first (so the others never hang from a node under them), the old parent last. */
  patches: HeadPatch[];
  remove: EdgeDoc[];
  create: { fromNodeId: string; toNodeId: string; sentiment: EdgeDoc["sentiment"] }[];
}

/**
 * A child swapped with its parent (Swap with parent): the child becomes the head of
 * the zone. It takes the parent's place (spot and parent, so it hangs where
 * the zone hung from another zone), every other node of the zone hangs from
 * it, and so does the old parent, which takes the child's spot. The old
 * parent's links go with the place — to the zone's nodes and to nodes in other
 * zones alike — except the one between the two of them, and any the child
 * already has. Refused (with the same reasons as redirectRefusal) when a node
 * that would change isn't yours, or an attack would head or lose its zone.
 */
export function takeParentPlace(
  child: NodeDoc,
  nodes: NodeDoc[],
  edges: EdgeDoc[],
  isOwnNode: (node: NodeDoc) => boolean,
  posFor: (node: NodeDoc) => Pt,
): HeadPlan | Exclude<RedirectRefusal, "same" | "ownBranch"> | null {
  const parentId = zoneParentId(child);
  const parent = parentId ? nodes.find((n) => n.nodeId === parentId) : undefined;
  if (!parent) return null;
  if (child.isWeapon || parent.isWeapon) return "attack";
  const zone = nodes.filter((n) => n.nodeId !== child.nodeId && zoneParentId(n) === parent.nodeId);
  const grandId = nodeRefId(parent.parentId) ?? null;
  const grand = grandId ? nodes.find((n) => n.nodeId === grandId) : undefined;
  // The backend takes only a parent of the caller's own, and changes only the caller's nodes.
  if (![child, parent, ...zone].every(isOwnNode) || (grand && !isOwnNode(grand))) return "notOwn";
  const at = posFor(child);
  const was = posFor(parent);
  const patches: HeadPatch[] = [
    { nodeId: child.nodeId, parentId: grandId, x: was.x, y: was.y },
    ...zone.map((n) => ({ nodeId: n.nodeId, parentId: child.nodeId, ...posFor(n) })),
    { nodeId: parent.nodeId, parentId: child.nodeId, x: at.x, y: at.y },
  ];
  const other = (e: EdgeDoc, id: string) => {
    const a = nodeRefId(e.fromNodeId);
    const b = nodeRefId(e.toNodeId);
    return a === id ? b : b === id ? a : null;
  };
  const childLinked = new Set(edges.map((e) => other(e, child.nodeId)).filter((id): id is string => !!id));
  const remove: EdgeDoc[] = [];
  const create: HeadPlan["create"] = [];
  for (const e of edges) {
    const far = other(e, parent.nodeId);
    if (!far || far === child.nodeId) continue;
    remove.push(e);
    // One link between two nodes is all there can be (Backend's createEdgeAbl).
    if (childLinked.has(far)) continue;
    childLinked.add(far);
    const parentFirst = nodeRefId(e.fromNodeId) === parent.nodeId;
    create.push({
      fromNodeId: parentFirst ? child.nodeId : far,
      toNodeId: parentFirst ? far : child.nodeId,
      sentiment: e.sentiment,
    });
  }
  return { patches, remove, create };
}
