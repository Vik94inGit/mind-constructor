// Pure graph helpers over a map's nodes — lifted out of MapPage unchanged,
// so each one can be read (and tested) without the page's own state around
// it. Nothing here touches React or the API.
import { nodeRefId } from "./nodeType";
import type { NodeDoc, NodeType } from "../types";

type Pt = { x: number; y: number };

// A Problem-type node's own child counts as "addressing" it (see
// computeUnsolvedProblemIds below) only if it's one of these — a plain
// Problem or Fail child piled on top doesn't count as a proposal.
const ADDRESSES_PROBLEM_TYPES = new Set<NodeType>(["Success", "Option", "Solution"]);

// Every insertion into a node/edge/line list goes through this, not a blind
// [...prev, x] append — the server broadcasts an action's own result back
// over the socket to its actor too, and that echo can arrive before this same
// tab's own HTTP response does. Two blind appends of the same id would render
// it twice; an upsert keyed by id makes whichever one lands second a harmless
// no-op instead.
export function upsertBy<T>(prev: T[], incoming: T, idOf: (item: T) => string): T[] {
  const id = idOf(incoming);
  const idx = prev.findIndex((item) => idOf(item) === id);
  if (idx === -1) return [...prev, incoming];
  const next = prev.slice();
  next[idx] = incoming;
  return next;
}

// For the owner: every node in a branch hidden from invited members (a
// flagged root, and everything hanging from it by parentId).
export function computeHiddenBranchIds(nodes: NodeDoc[]): Set<string> {
  const out = new Set<string>();
  if (!nodes.some((n) => n.hiddenFromMembers)) return out;
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const isHidden = (id: string, seen: Set<string>): boolean => {
    const n = byId.get(id);
    if (!n || seen.has(id)) return false;
    seen.add(id);
    if (n.hiddenFromMembers) return true;
    const parent = nodeRefId(n.parentId);
    return !!parent && isHidden(parent, seen);
  };
  for (const n of nodes) if (isHidden(n.nodeId, new Set())) out.add(n.nodeId);
  return out;
}

// Selecting either end of an attack (clicking the objection node or the
// node it's aimed at) keeps *that pair* visible even if a chosen circle
// would otherwise dim one of them: a weapon node never belongs to any circle
// itself, so with a circle spotlighted every attack elsewhere on the map
// would otherwise mute into near-invisibility the moment you're actually
// looking at one of them. Null when nothing is selected or the selection
// isn't part of any attack.
export function computeAttackPairIds(selectedId: string | null, nodes: NodeDoc[]): Set<string> | null {
  if (!selectedId) return null;
  const selected = nodes.find((n) => n.nodeId === selectedId);
  if (!selected) return null;
  if (selected.isWeapon) {
    const targetId = nodeRefId(selected.targetNodeId);
    return targetId ? new Set([selected.nodeId, targetId]) : null;
  }
  const attackers = nodes.filter((n) => n.isWeapon && nodeRefId(n.targetNodeId) === selected.nodeId);
  return attackers.length > 0 ? new Set([selected.nodeId, ...attackers.map((a) => a.nodeId)]) : null;
}

// Every id reachable from `rootIds` by walking parentId forward (children,
// grandchildren, ...) within `pool` — used to expand a chosen zone's own
// [rootId, ...directChildIds] (see SelectedCircle) into its *whole* branch
// for presenting, since a zone's stabilized membership only ever lists the
// root's direct children, not deeper descendants.
export function collectDescendants(rootIds: Set<string>, pool: NodeDoc[]): Set<string> {
  const result = new Set(rootIds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of pool) {
      if (result.has(n.nodeId)) continue;
      const parentId = nodeRefId(n.parentId);
      if (parentId && result.has(parentId)) {
        result.add(n.nodeId);
        grew = true;
      }
    }
  }
  return result;
}

// Every node below `rootId` in the branch tree (parentId) — its children,
// their children, and so on — that you can choose: your own (`isOwn`), in
// `pool`, and not an attack or shield node (those hang off a node by
// parentId too, but they aren't part of the argument). In the order a reader
// would follow it, level by level from the top, which is also the order
// "Number in order" numbers them in.
export function collectBranchIds(rootId: string, pool: NodeDoc[], isOwn: (node: NodeDoc) => boolean): string[] {
  const childrenOf = new Map<string, NodeDoc[]>();
  for (const n of pool) {
    const parent = nodeRefId(n.parentId);
    if (!parent) continue;
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent)!.push(n);
  }
  const found: string[] = [];
  const seen = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of childrenOf.get(current) ?? []) {
      if (seen.has(child.nodeId)) continue;
      seen.add(child.nodeId);
      // Not chosen itself if it's someone else's, an attack or a shield — but
      // its own children are still reached through it.
      if (isOwn(child) && !child.isWeapon && !child.isProtection) found.push(child.nodeId);
      queue.push(child.nodeId);
    }
  }
  return found;
}

// How many nodes are currently packed into each container — NodeCard's own
// corner badge reads this by nodeId.
export function countPackedByContainer(nodes: NodeDoc[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const n of nodes) {
    const containerId = nodeRefId(n.packedIntoNodeId);
    if (!containerId) continue;
    counts.set(containerId, (counts.get(containerId) ?? 0) + 1);
  }
  return counts;
}

// A Problem node with no Success/Option/Solution child yet — nothing's
// actually been proposed against it — pulses (see NodeCard's own `unsolved`
// prop). "Addresses it" is deliberately narrow (see ADDRESSES_PROBLEM_TYPES
// above): a Problem with only more Problem/Fail children branched off it
// still counts as unsolved. Callers pass every node, not just visible ones:
// a packed-away child still counts as "this got addressed".
export function computeUnsolvedProblemIds(nodes: NodeDoc[]): Set<string> {
  const ids = new Set<string>();
  for (const n of nodes) {
    if (n.type !== "Problem" || n.isWeapon) continue;
    const hasAddressingChild = nodes.some(
      (child) => nodeRefId(child.parentId) === n.nodeId && ADDRESSES_PROBLEM_TYPES.has(child.type),
    );
    if (!hasAddressingChild) ids.add(n.nodeId);
  }
  return ids;
}

// A Problem is solved, or a goal (Solution) reached, once a Success sits
// somewhere below it — directly or further down the branch. Each such
// Success is celebrated (wings and halo, see NodeCard's `triumphant`), and
// so is every zone it's in (a gold outline, see CanvasBackdrop). The walk
// up stops at the nearest Problem/Solution: that's the one it answers.
export function computeSolved(nodes: NodeDoc[]): { successIds: Set<string>; solvedIds: Set<string> } {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const successIds = new Set<string>();
  const solvedIds = new Set<string>();
  for (const n of nodes) {
    if (n.type !== "Success" || n.isWeapon) continue;
    let current = byId.get(nodeRefId(n.parentId) ?? "");
    for (let hops = 0; current && hops < 50; hops++) {
      if (current.type === "Problem" || current.type === "Solution") {
        successIds.add(n.nodeId);
        solvedIds.add(current.nodeId);
        break;
      }
      current = byId.get(nodeRefId(current.parentId) ?? "");
    }
  }
  return { successIds, solvedIds };
}

// "Group into circle" picks its root automatically — whichever point sits
// closest to the group's own centroid. Returns that point's index (0 for an
// empty or single-point list).
export function closestToCentroidIndex(pts: Pt[]): number {
  if (pts.length === 0) return 0;
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  let rootIndex = 0;
  let bestDist = Infinity;
  pts.forEach((p, i) => {
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d < bestDist) {
      bestDist = d;
      rootIndex = i;
    }
  });
  return rootIndex;
}

// Weapon nodes fly in from the direction away from their target (a fixed
// 150px so a distant attack doesn't launch it from absurdly far away), so the
// entrance animation reads as "just landed from what it hit" instead of an
// arbitrary random direction. See NodeCard's flightVector doc comment.
export function weaponFlightVector(pos: Pt, targetPos: Pt): Pt {
  const dx = pos.x - targetPos.x;
  const dy = pos.y - targetPos.y;
  const dist = Math.hypot(dx, dy) || 1;
  const scale = 150 / dist;
  return { x: dx * scale, y: dy * scale };
}

// Capped the same way other short node-text previews already are elsewhere
// (see e.g. CreateEdgeModal's own .slice(0, 24)) — the raw text fallback
// especially can run to a whole sentence, which read as far too wide a pill
// for a corner legend meant to be skimmed at a glance.
const ZONE_NAME_MAX = 22;

// An owner-given zoneName wins when set; otherwise every zone still gets
// *some* label rather than none at all — same title-falls-back-to-text the
// node's own caption uses elsewhere. Undefined when the root has nothing to
// show at all.
export function zoneLabel(root: NodeDoc | undefined): string | undefined {
  const name = root?.zoneName || root?.title || root?.text;
  return name && name.length > ZONE_NAME_MAX ? `${name.slice(0, ZONE_NAME_MAX)}…` : name;
}
