import { isDescendant } from "./canvasLayout";
import { nodeRefId } from "./nodeType";
import type { NodeDoc } from "../types";

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
