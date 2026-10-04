import { NODE_FOOTPRINT, avoidOverlap, outlineOrder } from "./canvasLayout";
import type { Obstacle, ViewportBounds } from "./canvasLayout";
import { nodeRefId } from "./nodeType";
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
//  2. Zones don't cross. Two zones only touch at a node they share (a child
//     zone hanging off a member of its parent zone).
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
/** Empty space always kept between two nodes' footprints. */
export const MIN_NODE_GAP = 12;
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
  /** Rules 1 and 2, plus moving nodes not landing on other nodes. */
  fits(p: Pt): boolean;
  /** Rule 3's upper bound. */
  compact(p: Pt): boolean;
}

interface Zone {
  rootId: string;
  memberIds: Set<string>;
  outline: Pt[];
}

function insidePolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
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
  return insidePolygon(p, zone.outline) || distToOutline(p, zone.outline) < ZONE_LINE_CLEARANCE;
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

function shareMember(a: Zone, b: Zone): boolean {
  for (const id of a.memberIds) if (b.memberIds.has(id)) return true;
  return false;
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
): ZoneRule {
  const offsetOf = new Map(moving.map((m) => [m.nodeId, m.offset ?? { x: 0, y: 0 }]));
  const parentOf = new Map<string, string | null>();
  const fixedPos = new Map<string, Pt>();
  // Weapon marks are drawn off to the side of their target (see WeaponLayer),
  // not as nodes on the map, so they neither block nor get blocked.
  const weapons = new Set<string>();
  for (const n of nodes) {
    parentOf.set(n.nodeId, nodeRefId(n.parentId) ?? null);
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
    if (!parentId) continue;
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
    childrenOf.get(parentId)!.push(id);
  }
  // Same membership computeNodeGroups draws: a root with 2+ children.
  const zoneMembers: { rootId: string; ids: string[] }[] = [];
  for (const [rootId, children] of childrenOf) {
    if (children.length >= 2 && parentOf.has(rootId)) zoneMembers.push({ rootId, ids: [rootId, ...children] });
  }

  const outlineOf = (ids: string[], posOf: (id: string) => Pt | undefined): Pt[] | null => {
    const pts: Pt[] = [];
    for (const id of ids) {
      const p = posOf(id);
      if (!p) return null;
      pts.push(p);
    }
    return outlineOrder(pts).map((i) => pts[i]);
  };

  // Zones none of the moving nodes are in keep their shape wherever they go.
  const fixedZones: Zone[] = [];
  const movingZones: { rootId: string; ids: string[]; memberIds: Set<string> }[] = [];
  for (const z of zoneMembers) {
    const memberIds = new Set(z.ids);
    if (z.ids.some((id) => offsetOf.has(id))) {
      movingZones.push({ rootId: z.rootId, ids: z.ids, memberIds });
    } else {
      const outline = outlineOf(z.ids, (id) => fixedPos.get(id));
      if (outline) fixedZones.push({ rootId: z.rootId, memberIds, outline });
    }
  }
  const fixedPoints = Array.from(fixedPos, ([id, p]) => ({ id, p })).filter((e) => !weapons.has(e.id));
  const fixedLines = fixedZones.map((z) => z.outline);

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
      // Rule 1: not in a zone it isn't part of.
      for (const z of fixedZones) if (!z.memberIds.has(m.id) && intrudes(m.p, z)) return false;
    }
    for (const mz of movingZones) {
      const outline = outlineOf(mz.ids, posOf);
      if (!outline) continue;
      const zone: Zone = { rootId: mz.rootId, memberIds: mz.memberIds, outline };
      // Rule 1, the other way round: the reshaped zone doesn't swallow anyone.
      for (const f of fixedPoints) if (!zone.memberIds.has(f.id) && intrudes(f.p, zone)) return false;
      for (const m of placed) if (!zone.memberIds.has(m.id) && intrudes(m.p, zone)) return false;
      // Rule 2: no crossing another zone, unless the two hang together.
      for (const z of fixedZones) if (!shareMember(zone, z) && outlinesCross(outline, z.outline)) return false;
    }
    return true;
  }

  function compact(p: Pt): boolean {
    if (fixedPoints.length === 0 && fixedLines.length === 0) return true;
    for (const m of movingAt(p)) {
      for (const f of fixedPoints) if (footprintGap(m.p, f.p) <= MAX_ZONE_GAP) return true;
      for (const line of fixedLines) if (distToOutline(m.p, line) - NODE_FOOTPRINT.h / 2 <= MAX_ZONE_GAP) return true;
    }
    return false;
  }

  return { fits, compact };
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
