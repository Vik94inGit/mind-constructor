import { avoidOverlap, footprintObstacles, getZoneReach } from "./canvasLayout";
import type { ViewportBounds } from "./canvasLayout";
import { MIN_NODE_GAP } from "./zoneRules";
import { zoneParentId } from "./nodeType";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

// A parent keeps its own nodes close, like a magnet: once it has moved, a
// child left farther than MAGNET_FAR_FACTOR zone reaches (getZoneReach) away
// is pulled back towards it, keeping the side it was on, to MAGNET_PULL_FACTOR
// reaches out. If something already sits there it moves on to the nearest
// spot that covers nothing and is still inside the zone's reach, so no node
// ends up on top of another. A pulled child is a parent too: its own far
// children follow it the same way. The map glides every node to its new spot
// (see usePositionGlide), so the pull reads as the children being drawn in.
// The parent's magnet button calls them in on demand, everything outside the
// zone's reach (MAGNET_BUTTON_FAR_FACTOR) and not just the ones left far.

/** Past this many zone reaches from its parent a child counts as too far. Same distance a dragged member leaves its zone at. */
export const MAGNET_FAR_FACTOR = 1.5;
/** The magnet button pulls in every child past this many zone reaches: anything outside the zone. */
export const MAGNET_BUTTON_FAR_FACTOR = 1;
/** How far out, in zone reaches, a pulled child lands. */
export const MAGNET_PULL_FACTOR = 0.6;

/**
 * Where the children of the nodes in `moved` (just moved, at their new spots)
 * get pulled to. Only nodes `canPull` allows move: your own, not held in
 * place. `obstaclePoints(exclude)` gives every other visible node's spot,
 * minus `exclude`. Nodes that stay put aren't in the result.
 */
export function magnetPulls(
  moved: Map<string, Pt>,
  nodes: NodeDoc[],
  positions: Map<string, Pt>,
  canPull: (node: NodeDoc) => boolean,
  obstaclePoints: (exclude: Set<string>) => Pt[],
  bounds: ViewportBounds,
  reach: number = getZoneReach(),
  footprintScale = 1,
  farFactor = MAGNET_FAR_FACTOR,
): Map<string, Pt> {
  const childrenOf = new Map<string, NodeDoc[]>();
  for (const n of nodes) {
    const parentId = zoneParentId(n);
    if (!parentId || n.isWeapon) continue;
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
    childrenOf.get(parentId)!.push(n);
  }

  const pulls = new Map<string, Pt>();
  const spotOf = (id: string) => pulls.get(id) ?? moved.get(id) ?? positions.get(id);
  const queue = Array.from(moved.keys());
  while (queue.length) {
    const parentId = queue.shift()!;
    const parentPos = spotOf(parentId);
    if (!parentPos) continue;
    for (const child of childrenOf.get(parentId) ?? []) {
      const id = child.nodeId;
      // Each node moves once: what the person moved stays where they put it.
      if (moved.has(id) || pulls.has(id) || !canPull(child)) continue;
      const pos = positions.get(id);
      if (!pos) continue;
      const dx = pos.x - parentPos.x;
      const dy = pos.y - parentPos.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= reach * farFactor) continue;
      const desired = {
        x: parentPos.x + (dx / dist) * reach * MAGNET_PULL_FACTOR,
        y: parentPos.y + (dy / dist) * reach * MAGNET_PULL_FACTOR,
      };
      // Clear of every node as it will stand: the moved and pulled ones at
      // their new spots, the rest where they are.
      const shifted = new Set([...moved.keys(), ...pulls.keys(), id]);
      const taken = [...obstaclePoints(shifted), ...moved.values(), ...pulls.values()];
      const spot = avoidOverlap(
        desired,
        footprintObstacles(taken, MIN_NODE_GAP, footprintScale),
        bounds,
        (p) => Math.hypot(p.x - parentPos.x, p.y - parentPos.y) <= reach,
      );
      pulls.set(id, spot);
      queue.push(id);
    }
  }
  return pulls;
}
