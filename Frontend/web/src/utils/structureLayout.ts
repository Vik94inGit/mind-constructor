import { CANVAS_H, CANVAS_W, computeNodeGroups, getCirclePackSpacing } from "./canvasLayout";
import type { NodeGroup } from "./canvasLayout";
import { nodeRefId } from "./nodeType";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

// Keeps the map's structure readable after something new lands on it (a new
// node, a grown template, a drop): the thing just placed stays exactly where
// it was put, and whatever it now covers is pushed out of its way instead —
// node by node, then zone by zone. A node pushed into the canvas border
// slides along it rather than stopping on top of what it was pushed by.

/** How close a node may sit to the canvas edge — same margin templates keep. */
export const EDGE_MARGIN = 120;
/** Empty space kept between two zones that don't share a member. */
const ZONE_GAP = 16;
const MAX_PASSES = 40;

function clampPt(p: Pt): Pt {
  return {
    x: Math.min(CANVAS_W - EDGE_MARGIN, Math.max(EDGE_MARGIN, p.x)),
    y: Math.min(CANVAS_H - EDGE_MARGIN, Math.max(EDGE_MARGIN, p.y)),
  };
}

// Moves `p` by `delta`, clamped to the canvas. When the border eats part of
// the move, the blocked part is turned into a slide along that border (up
// first when sliding vertically — "move it above"), so the push still lands.
function pushWithin(p: Pt, delta: Pt): Pt {
  const target = { x: p.x + delta.x, y: p.y + delta.y };
  const clamped = clampPt(target);
  const lostX = Math.abs(target.x - clamped.x);
  const lostY = Math.abs(target.y - clamped.y);
  if (lostX < 0.5 && lostY < 0.5) return clamped;
  const slide = { x: clamped.x, y: clamped.y };
  if (lostX >= 0.5) {
    const up = clamped.y - EDGE_MARGIN;
    const down = CANVAS_H - EDGE_MARGIN - clamped.y;
    const dir = delta.y > 0.5 ? 1 : delta.y < -0.5 ? -1 : up >= lostX || up >= down ? -1 : 1;
    slide.y += dir * lostX;
  }
  if (lostY >= 0.5) {
    const left = clamped.x - EDGE_MARGIN;
    const right = CANVAS_W - EDGE_MARGIN - clamped.x;
    const dir = delta.x > 0.5 ? 1 : delta.x < -0.5 ? -1 : left >= right ? -1 : 1;
    slide.x += dir * lostY;
  }
  return clampPt(slide);
}

function awayFrom(from: Pt, p: Pt): Pt {
  const dx = p.x - from.x;
  const dy = p.y - from.y;
  const d = Math.hypot(dx, dy);
  // Exactly on top of each other: no direction to read, so go up.
  return d < 0.001 ? { x: 0, y: -1 } : { x: dx / d, y: dy / d };
}

/**
 * Pushes movable nodes off every node in `fixedIds` (and off each other, once
 * moved) until all of them are at least `spacing` apart. Overlaps between two
 * nodes nothing touched are left alone — that's the user's own arrangement.
 * Returns only what moved.
 */
export function makeRoom(
  positions: Map<string, Pt>,
  fixedIds: Set<string>,
  canMove: (id: string) => boolean,
  spacing: number = getCirclePackSpacing(),
): Map<string, Pt> {
  const pos = new Map(positions);
  const moved = new Map<string, Pt>();
  const active = new Set(fixedIds);
  const ids = Array.from(pos.keys());
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false;
    for (const a of Array.from(active)) {
      for (const b of ids) {
        if (a === b || fixedIds.has(b) || !canMove(b)) continue;
        const pa = pos.get(a)!;
        const pb = pos.get(b)!;
        const d = Math.hypot(pb.x - pa.x, pb.y - pa.y);
        if (d >= spacing - 0.5) continue;
        const dir = awayFrom(pa, pb);
        const need = spacing - d;
        const next = pushWithin(pb, { x: dir.x * need, y: dir.y * need });
        if (Math.hypot(next.x - pb.x, next.y - pb.y) < 0.5) continue;
        pos.set(b, next);
        moved.set(b, next);
        active.add(b);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return moved;
}

function zonesOverlap(a: NodeGroup, b: NodeGroup): number {
  return a.r + b.r + ZONE_GAP - Math.hypot(a.cx - b.cx, a.cy - b.cy);
}

// The node and everything hanging below it, by parentId.
function subtreeOf(rootIds: string[], nodes: NodeDoc[]): Set<string> {
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    const p = nodeRefId(n.parentId);
    if (!p) continue;
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(n.nodeId);
  }
  const out = new Set<string>();
  const stack = [...rootIds];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}

/**
 * Moves zones apart until no two zones that share no member overlap. Only
 * pairs where at least one side was touched (holds a node in `touchedIds`)
 * are resolved. The side that moves is the one holding none of `fixedIds`,
 * and it moves together with everything hanging below its members, so a
 * nested zone travels along. Returns only what moved.
 */
export function separateZones(
  visibleNodes: NodeDoc[],
  allNodes: NodeDoc[],
  positions: Map<string, Pt>,
  touchedIds: Set<string>,
  fixedIds: Set<string>,
  canMove: (id: string) => boolean,
): Map<string, Pt> {
  const pos = new Map(positions);
  const moved = new Map<string, Pt>();
  const touched = new Set(touchedIds);
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const groups = computeNodeGroups(visibleNodes, allNodes, pos);
    let changed = false;
    for (let i = 0; i < groups.length && !changed; i++) {
      for (let j = i + 1; j < groups.length && !changed; j++) {
        const a = groups[i];
        const b = groups[j];
        const aIds = new Set(a.members.map((m) => m.nodeId));
        if (b.members.some((m) => aIds.has(m.nodeId))) continue;
        const bIds = b.members.map((m) => m.nodeId);
        if (!a.members.some((m) => touched.has(m.nodeId)) && !bIds.some((id) => touched.has(id))) continue;
        const depth = zonesOverlap(a, b);
        if (depth <= 0.5) continue;
        // The smaller zone moves first; the bigger one only if the smaller can't.
        const [small, big] = a.r <= b.r ? [a, b] : [b, a];
        const plan = pickMover(big, small, allNodes, fixedIds, canMove) ?? pickMover(small, big, allNodes, fixedIds, canMove);
        if (!plan) continue;
        const { mover, still, ids } = plan;
        const dir = awayFrom({ x: still.cx, y: still.cy }, { x: mover.cx, y: mover.cy });
        const delta = { x: dir.x * depth, y: dir.y * depth };
        // One translation for the whole set, shrunk if any member would leave
        // the canvas; whatever the border takes off turns into a slide along it.
        const shifted = translateWithin(ids, pos, delta);
        if (!shifted) continue;
        for (const [id, p] of shifted) {
          pos.set(id, p);
          moved.set(id, p);
          touched.add(id);
        }
        changed = true;
      }
    }
    if (!changed) break;
  }
  return moved;
}

function pickMover(
  still: NodeGroup,
  mover: NodeGroup,
  allNodes: NodeDoc[],
  fixedIds: Set<string>,
  canMove: (id: string) => boolean,
): { mover: NodeGroup; still: NodeGroup; ids: string[] } | null {
  const ids = Array.from(subtreeOf(mover.members.map((m) => m.nodeId), allNodes));
  const stillIds = new Set(still.members.map((m) => m.nodeId));
  // Moving `mover` must leave `still` behind, and must not drag anything the
  // caller pinned or can't move (someone else's node, a locked one).
  if (ids.some((id) => stillIds.has(id) || fixedIds.has(id) || !canMove(id))) return null;
  return { mover, still, ids };
}

function translateWithin(ids: string[], pos: Map<string, Pt>, delta: Pt): Map<string, Pt> | null {
  const pts = ids.map((id) => pos.get(id)).filter((p): p is Pt => !!p);
  if (pts.length === 0) return null;
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const fit = (lo: number, hi: number, d: number, max: number) =>
    Math.min(max - EDGE_MARGIN - hi, Math.max(EDGE_MARGIN - lo, d));
  let dx = fit(minX, maxX, delta.x, CANVAS_W);
  let dy = fit(minY, maxY, delta.y, CANVAS_H);
  // Border took part of the move: slide the rest along the free axis.
  const lost = Math.hypot(delta.x - dx, delta.y - dy);
  if (lost > 0.5) {
    if (Math.abs(delta.x - dx) > 0.5) {
      const up = minY - EDGE_MARGIN;
      const down = CANVAS_H - EDGE_MARGIN - maxY;
      dy = fit(minY, maxY, dy + (up >= lost || up >= down ? -lost : lost), CANVAS_H);
    } else {
      const left = minX - EDGE_MARGIN;
      const right = CANVAS_W - EDGE_MARGIN - maxX;
      dx = fit(minX, maxX, dx + (left >= right ? -lost : lost), CANVAS_W);
    }
  }
  if (Math.hypot(dx, dy) < 0.5) return null;
  const out = new Map<string, Pt>();
  for (const id of ids) {
    const p = pos.get(id);
    if (p) out.set(id, { x: p.x + dx, y: p.y + dy });
  }
  return out;
}

/**
 * The whole tidy-up after a change: nodes off the pinned ones, then zones
 * apart, then nodes again (a moved zone can land on a loose node), a few
 * rounds at most. `pinnedIds` are what the user just placed — they never move.
 */
export function planStructureMoves(
  allNodes: NodeDoc[],
  positions: Map<string, Pt>,
  pinnedIds: Set<string>,
  canMove: (id: string) => boolean,
): Map<string, Pt> {
  const visible = allNodes.filter((n) => !n.packedIntoNodeId);
  const visibleIds = new Set(visible.map((n) => n.nodeId));
  const pos = new Map(Array.from(positions).filter(([id]) => visibleIds.has(id)));
  const moved = new Map<string, Pt>();
  const touched = new Set(pinnedIds);
  for (let round = 0; round < 3; round++) {
    const byNodes = makeRoom(pos, touched, canMove);
    for (const [id, p] of byNodes) {
      pos.set(id, p);
      moved.set(id, p);
      touched.add(id);
    }
    const byZones = separateZones(visible, allNodes, pos, touched, pinnedIds, canMove);
    for (const [id, p] of byZones) {
      pos.set(id, p);
      moved.set(id, p);
      touched.add(id);
    }
    if (byZones.size === 0) break;
  }
  return moved;
}
