import { NODE_FOOTPRINT, avoidOverlap, getZoneReach, zoneMemberships, zoneShape } from "./canvasLayout";
import type { Obstacle, ViewportBounds, ZoneMembership } from "./canvasLayout";
import type { ZoneLayouts } from "./zoneLayout";
import { pointInPolygon } from "./drawLine";
import { idOf, zoneParentId } from "./nodeType";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

// The rules every node placement on the map follows: a drop, a group drag, a
// quick-add, a new node. A zone is the polygon through a root and its direct
// children (see computeNodeGroups).
//
//  1. Nothing sits in a zone it doesn't belong to. A node from another zone,
//     or one in no zone at all, stays outside the zone's outline and clear of
//     its lines. This also holds for the zone itself: moving one of its
//     members can't stretch the outline over a node that isn't in it.
//  2. Zones don't overlap. Two zones only touch at a node they share (a child
//     zone hanging off a member of its parent zone): their lines don't cross
//     and neither holds a corner of the other. A zone wrapping a whole branch
//     (ZoneLayout "nested") is the one exception, it holds its sub-zones.
//     This one holds for a drag the person aimed too (free mode): a dropped
//     node never stretches its zone over another one.
//  3. No wasted space. A placed node ends up no more than MAX_ZONE_GAP from
//     the nearest node or zone line, and never closer than MIN_NODE_GAP to
//     another node.
//
// Only the nodes being placed move. Everything else stays where it is, so a
// rule the rest of the map already breaks doesn't block the placement: it's
// tried strictest first and relaxed only when no spot satisfies it (see
// placeByZoneRules).

/** ≈ 2 cm on screen at 100% zoom (CSS px are 96 per inch). */
export const MAX_ZONE_GAP = 76;
/** Empty space always kept between two nodes' footprints — small, so nodes can sit close without touching. */
export const MIN_NODE_GAP = 4;
/** How far a node from outside a zone keeps from the zone's lines. */
export const ZONE_LINE_CLEARANCE = NODE_FOOTPRINT.h / 2;

/** Stand-in id for a node that doesn't exist yet (the pending-node input). */
export const NEW_NODE_ID = "__new_node__";

export interface MovingNode {
  nodeId: string;
  /** Where this node sits relative to the placed point. Default: on it. */
  offset?: Pt;
  /** The parent it will have once placed. Default: unchanged. */
  parentId?: string | null;
}

/** A node that isn't in `nodes` yet but already sits on the map, e.g. a circle's just-created root. */
export interface ExtraNode {
  nodeId: string;
  parentId: string | null;
  pos: Pt;
}

export interface ZoneRule {
  /** Rules 1 and 2 (only 2 when free), plus moving nodes not landing on other nodes. */
  fits(p: Pt): boolean;
  /** Rule 3's upper bound. */
  compact(p: Pt): boolean;
}

interface Zone {
  rootId: string;
  memberIds: Set<string>;
  outline: Pt[];
  /** The node at each corner of `outline`. */
  outlineIds: string[];
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distToOutline(p: Pt, poly: Pt[]): number {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  return d;
}

/** In the zone, or too close to its lines. */
function intrudes(p: Pt, zone: Zone): boolean {
  return pointInPolygon(p, zone.outline) || distToOutline(p, zone.outline) < ZONE_LINE_CLEARANCE;
}

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function outlinesCross(a: Pt[], b: Pt[]): boolean {
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) if (segmentsCross(a1, a2, b[j], b[(j + 1) % b.length])) return true;
  }
  return false;
}

/** Empty space between the footprints of two nodes centered on `a` and `b`. */
function footprintGap(a: Pt, b: Pt): number {
  const gx = Math.max(0, Math.abs(a.x - b.x) - NODE_FOOTPRINT.w);
  const gy = Math.max(0, Math.abs(a.y - b.y) - NODE_FOOTPRINT.h);
  return Math.hypot(gx, gy);
}

function footprintsOverlap(a: Pt, b: Pt): boolean {
  return Math.abs(a.x - b.x) < NODE_FOOTPRINT.w && Math.abs(a.y - b.y) < NODE_FOOTPRINT.h;
}

function holdsAll(big: Zone, small: Zone): boolean {
  for (const id of small.memberIds) if (!big.memberIds.has(id)) return false;
  return true;
}

/** One zone's corner inside the other or right on its line, a node they share aside. */
function cornerInside(a: Zone, b: Zone): boolean {
  return a.outline.some((p, i) => !b.memberIds.has(a.outlineIds[i]) && intrudes(p, b));
}

/**
 * Rule 2: whether two zones cover any of the same ground, past the node they
 * may share, or a corner of one sits on the other's line (so they never read
 * as one shape). A nested zone and a sub-zone it wraps never count.
 */
function zonesOverlap(a: Zone, b: Zone): boolean {
  if (holdsAll(a, b) || holdsAll(b, a)) return false;
  return outlinesCross(a.outline, b.outline) || cornerInside(a, b) || cornerInside(b, a);
}

/**
 * The rules for placing `moving` (one node, or a group moved rigidly) on a
 * map of `nodes` (the visible ones) at `positions`. The returned checks take
 * the point the first moving node lands on; every other one lands at its own
 * offset from it.
 */
export function makeZoneRule(
  nodes: NodeDoc[],
  positions: Map<string, Pt>,
  moving: MovingNode[],
  extra: ExtraNode[] = [],
  reach: number = getZoneReach(),
  layouts: ZoneLayouts = {},
  /** A drag the person aimed: keep the moving nodes off other nodes and zones off each other (rule 2), nothing else. */
  free = false,
  /** Zones the moving nodes may never enter, free or not: another player's castles in a discussion. */
  offLimits?: (zoneRootId: string) => boolean,
): ZoneRule {
  const offsetOf = new Map(moving.map((m) => [m.nodeId, m.offset ?? { x: 0, y: 0 }]));
  const parentOf = new Map<string, string | null>();
  const fixedPos = new Map<string, Pt>();
  // Attacks don't block other nodes, and belong to no zone, so rule 1 keeps
  // a dragged attack out of every castle, its target's included.
  const weapons = new Set<string>();
  for (const n of nodes) {
    parentOf.set(n.nodeId, zoneParentId(n));
    if (n.isWeapon) weapons.add(n.nodeId);
    const p = positions.get(n.nodeId);
    if (p && !offsetOf.has(n.nodeId)) fixedPos.set(n.nodeId, p);
  }
  for (const e of extra) {
    parentOf.set(e.nodeId, e.parentId);
    if (!offsetOf.has(e.nodeId)) fixedPos.set(e.nodeId, e.pos);
  }
  for (const m of moving) {
    if (m.parentId !== undefined) parentOf.set(m.nodeId, m.parentId);
    else if (!parentOf.has(m.nodeId)) parentOf.set(m.nodeId, null);
  }

  const childrenOf = new Map<string, string[]>();
  for (const [id, parentId] of parentOf) {
    // An attack stays outside the castle it hits (zoneParentId is null for it).
    if (!parentId) continue;
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
    childrenOf.get(parentId)!.push(id);
  }
  // Same membership computeNodeGroups draws.
  const zoneMembers = zoneMemberships(childrenOf, (id) => parentOf.has(id), (id) => parentOf.get(id), layouts);

  const zoneAt = (zone: ZoneMembership, memberIds: Set<string>, posOf: (id: string) => Pt | undefined): Zone | null => {
    const pts: Pt[] = [];
    for (const id of zone.ids) {
      const p = posOf(id);
      if (!p) return null;
      pts.push(p);
    }
    // ids[0] is the root. Same shape the map draws (see zoneShape).
    const order = zoneShape(zone, pts, reach);
    if (!order.length) return null;
    return { rootId: zone.rootId, memberIds, outline: order.map((i) => pts[i]), outlineIds: order.map((i) => zone.ids[i]) };
  };

  // Zones none of the moving nodes are in keep their shape wherever they go.
  const fixedZones: Zone[] = [];
  const movingZones: { zone: ZoneMembership; memberIds: Set<string> }[] = [];
  for (const z of zoneMembers) {
    const memberIds = new Set(z.ids);
    if (z.ids.some((id) => offsetOf.has(id))) {
      movingZones.push({ zone: z, memberIds });
    } else {
      const fixed = zoneAt(z, memberIds, (id) => fixedPos.get(id));
      if (fixed) fixedZones.push(fixed);
    }
  }
  // Zones a moving one already overlaps where it stands now: the map broke
  // rule 2 before this move, so that pair alone doesn't block it (moving them
  // apart stays possible, and the rest of the rule still holds).
  const overlappedBefore = new Map<string, Set<string>>();
  const rejoining = new Set(moving.filter((m) => m.parentId !== undefined).map((m) => m.nodeId));
  for (const mz of movingZones) {
    // A node joining or leaving this zone: its shape now says nothing about before.
    if (mz.zone.ids.some((id) => rejoining.has(id))) continue;
    const now = zoneAt(mz.zone, mz.memberIds, (id) => positions.get(id) ?? extra.find((e) => e.nodeId === id)?.pos);
    if (!now) continue;
    overlappedBefore.set(mz.zone.rootId, new Set(fixedZones.filter((z) => zonesOverlap(now, z)).map((z) => z.rootId)));
  }
  const fixedPoints = Array.from(fixedPos, ([id, p]) => ({ id, p })).filter((e) => !weapons.has(e.id));
  const fixedLines = fixedZones.map((z) => z.outline);

  // A moving node that is part of a zone (its parent, or a member), and the
  // zones it already sits in where it stands now (an overlap the map had
  // before this move, which doesn't block it).
  const inZone = new Set<string>();
  for (const mz of movingZones) for (const id of mz.memberIds) if (offsetOf.has(id)) inZone.add(id);
  const insideBefore = new Map<string, Set<string>>();
  for (const id of inZone) {
    const p = positions.get(id);
    if (p) insideBefore.set(id, new Set(fixedZones.filter((z) => intrudes(p, z)).map((z) => z.rootId)));
  }

  const movingAt = (p: Pt) => moving.map((m) => {
    const o = offsetOf.get(m.nodeId)!;
    return { id: m.nodeId, p: { x: p.x + o.x, y: p.y + o.y } };
  });

  function fits(p: Pt): boolean {
    const placed = movingAt(p);
    const posOf = (id: string) => {
      const o = offsetOf.get(id);
      return o ? { x: p.x + o.x, y: p.y + o.y } : fixedPos.get(id);
    };
    for (const m of placed) {
      // A follower in a group can't land on a node outside it either (the
      // first moving node is held to that by the caller's own obstacles).
      for (const f of fixedPoints) if (footprintsOverlap(m.p, f.p)) return false;
      if (offLimits) for (const z of fixedZones) if (!z.memberIds.has(m.id) && offLimits(z.rootId) && intrudes(m.p, z)) return false;
      if (free) {
        // Rule 2 for a node of a zone: it doesn't carry its zone into
        // another one, not even by reaching so far its own outline lets go.
        if (inZone.has(m.id))
          for (const z of fixedZones) if (!z.memberIds.has(m.id) && !insideBefore.get(m.id)?.has(z.rootId) && intrudes(m.p, z)) return false;
        continue;
      }
      // Rule 1: not in a zone it isn't part of.
      for (const z of fixedZones) if (!z.memberIds.has(m.id) && intrudes(m.p, z)) return false;
    }
    for (const mz of movingZones) {
      const zone = zoneAt(mz.zone, mz.memberIds, posOf);
      if (!zone) continue;
      if (!free) {
        // Rule 1, the other way round: the reshaped zone doesn't swallow anyone.
        for (const f of fixedPoints) if (!zone.memberIds.has(f.id) && intrudes(f.p, zone)) return false;
        for (const m of placed) if (!zone.memberIds.has(m.id) && intrudes(m.p, zone)) return false;
      }
      // Rule 2, free or not: no zone laid over another one.
      const before = overlappedBefore.get(zone.rootId);
      for (const z of fixedZones) if (!before?.has(z.rootId) && zonesOverlap(zone, z)) return false;
    }
    return true;
  }

  function compact(p: Pt): boolean {
    if (free || (fixedPoints.length === 0 && fixedLines.length === 0)) return true;
    for (const m of movingAt(p)) {
      for (const f of fixedPoints) if (footprintGap(m.p, f.p) <= MAX_ZONE_GAP) return true;
      for (const line of fixedLines) if (distToOutline(m.p, line) - NODE_FOOTPRINT.h / 2 <= MAX_ZONE_GAP) return true;
    }
    return false;
  }

  return { fits, compact };
}

/**
 * In a discussion every player's castles are their own territory: a zone whose
 * parent someone else created is off limits to `userId`'s nodes.
 */
export function othersTerritory(nodes: NodeDoc[], userId: string | undefined): (zoneRootId: string) => boolean {
  const owner = new Map(nodes.map((n) => [n.nodeId, idOf(n.userId)]));
  return (rootId) => {
    const by = owner.get(rootId);
    return !!by && by !== userId;
  };
}

/**
 * Where a placement wanted at `desired` lands under the zone rules: the
 * nearest spot clear of `obstacles` that follows all of them, else one that
 * at least stays out of other zones, else just a clear spot.
 */
export function placeByZoneRules(
  desired: Pt,
  obstacles: Obstacle[],
  bounds: ViewportBounds,
  rule: ZoneRule,
): Pt {
  return avoidOverlap(desired, obstacles, bounds, [(p) => rule.fits(p) && rule.compact(p), rule.fits]);
}
