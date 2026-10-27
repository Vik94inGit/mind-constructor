import { CANVAS_W, CANVAS_H, footprintObstacles, freeFootprintScale } from "../utils/canvasLayout";
import type { NodeGroup, Obstacle, ViewportBounds } from "../utils/canvasLayout";
import { MIN_NODE_GAP, makeZoneRule, othersTerritory, placeByZoneRules } from "../utils/zoneRules";
import type { ExtraNode, MovingNode } from "../utils/zoneRules";
import type { ZoneLayout } from "../utils/zoneLayout";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

interface Params {
  visibleNodes: NodeDoc[];
  positions: Map<string, Pt>;
  nodeGroups: NodeGroup[];
  zoom: number;
  viewportBounds: () => ViewportBounds;
  zoneLayouts: Record<string, ZoneLayout>;
  /** In a discussion no drop lands inside another player's castle. */
  discussionOn: boolean;
  userId: string | undefined;
}

// Where a new or moved node may go on the canvas — see utils/zoneRules.ts.
export function usePlacement({ visibleNodes, positions, nodeGroups, zoom, viewportBounds, zoneLayouts, discussionOn, userId }: Params) {
  // The points a new or moved node has to stay clear of: every *visible*
  // node's position, minus `exclude` (the thing being placed). Only visible
  // ones — a node packed out of sight still has an entry in `positions`;
  // counting it here would push new placements away from a spot that looks
  // empty to the user.
  function obstaclePoints(exclude?: Set<string>) {
    return visibleNodes
      .filter((n) => !exclude?.has(n.nodeId))
      .map((n) => positions.get(n.nodeId) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 });
  }

  // Where `moving` (one node, or a group moved as one) lands when put at
  // `desired`: the nearest spot that covers no other node and follows the
  // zone rules — out of zones it isn't in, zones not crossing, and no more
  // than ~2 cm from the nearest node or zone line. See utils/zoneRules.ts.
  // `free` (a node the person dragged there themselves) keeps only the first
  // part: nothing on top of another node or its text. In a discussion no drop
  // lands inside another player's castle either.
  // Only the moving nodes move; nothing else on the map is pushed around.
  function placeNode(desired: Pt, moving: MovingNode[], extra: ExtraNode[] = [], opts: { free?: boolean } = {}) {
    // A drag the person aimed keeps clear of nodes as they look right now,
    // at this zoom: zoomed out, each one covers more of the canvas.
    const obstacles = footprintObstacles(
      [...obstaclePoints(new Set(moving.map((m) => m.nodeId))), ...extra.map((e) => e.pos)],
      MIN_NODE_GAP,
      opts.free ? freeFootprintScale(zoom) : 1,
    );
    return placeByZoneRules(
      desired,
      obstacles,
      viewportBounds(),
      makeZoneRule(
        visibleNodes,
        positions,
        moving,
        extra,
        undefined,
        zoneLayouts,
        opts.free,
        discussionOn ? othersTerritory(visibleNodes, userId) : undefined,
      ),
    );
  }

  // What any node creation/drag has to steer clear of so it never lands
  // inside a big group backdrop — the group's own members are exempt
  // (excludeRootIds), since they belong there and are what the backdrop is
  // even drawn around. Clearance is the backdrop's own radius plus a small
  // fixed buffer (not a fraction of getNodeMinDist() any more — that put a
  // ~150px empty ring of dead space around every zone on top of the radius'
  // own +70 built-in padding, reading as an overly spread-out, uncompact
  // map instead of a clear-but-tight boundary; even the first cut down to
  // +40 still read as a single-node drag landing surprisingly far from
  // where it was actually dropped). Just enough for a node's own icon to
  // clear the backdrop's edge, not its full caption-width spacing margin.
  function bigNodeObstacles(excludeRootIds: Set<string> = new Set()): Obstacle[] {
    return nodeGroups
      .filter((g) => !excludeRootIds.has(g.rootId))
      .map((g) => ({ x: g.cx, y: g.cy, minDist: g.r + 20 }));
  }

  return { obstaclePoints, placeNode, bigNodeObstacles };
}
