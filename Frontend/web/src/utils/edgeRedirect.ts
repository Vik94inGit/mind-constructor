import { isDescendant } from "./canvasLayout";
import { nodeRefId } from "./nodeType";
import type { EdgeDoc, NodeDoc } from "../types";

type Pt = { x: number; y: number };

// Changing a node's parent by redirecting its branch arrow: the arrow's
// parent end is dragged off its parent and let go over another node, which
// becomes the parent. The child keeps its own branch; the zones it leaves and
// joins redraw from the new parentId (computeNodeGroups), and the child moves
// in next to its new parent when it sits too far out for the zone to reach it
// without stretching across the map (see redirectSpot).

/** Why the arrow can't be redirected onto `target`, or null when it can. */
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
 * Where a branch's knob sits: on the branch from the opened node `from`
 * toward the node at its other end `to`, `clear` away from `from` (past the
 * ring of ghosts around it), so the ghosts never cover it. A branch too short
 * for that gets it halfway, and the knob, drawn above the ghosts, still takes
 * the touch.
 */
export function knobSpot(from: Pt, to: Pt, clear: number): Pt {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  // Leave room for the far node's own icon (about half a ring) past the knob.
  const at = len > clear * 1.5 ? clear / len : 0.5;
  return { x: from.x + dx * at, y: from.y + dy * at };
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
