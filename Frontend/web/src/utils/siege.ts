import { nodeRefId } from "./nodeType";
import type { AttackNodeType, NodeDoc, NodeType, Weapon } from "../types";

// Discussion mode read as a realm under siege. Every zone is a hold: one whose
// parent hangs from nothing is the kingdom (its outer wall is the kingdom's
// border), one whose parent hangs from another node is a castle inside it. A
// hold's keep is its parent; everything below the keep is the castle itself.
//
// An imitated opponent plays one of a few strategies against a hold, one move
// per turn. A move is an ordinary attack or protection node — the same thing
// a person would place from a node's panel — so damage, shields and the
// retaliation heal all work as they always do. This file only decides *what*
// the move is; the words come from i18n (t.ui.siege.moves), so they are in the
// viewer's language.

export const STRATEGIES = ["siege", "undermine", "assault", "sally", "fortify"] as const;
export type Strategy = (typeof STRATEGIES)[number];

/** Strategies that need the opponent to have a castle of its own (a civil war, not an invasion). */
export const NEEDS_OWN_CASTLE: readonly Strategy[] = ["sally", "fortify"];

export interface Hold {
  rootId: string;
  kind: "kingdom" | "castle";
}

export type Move =
  | { strategy: Strategy; action: "attack"; targetId: string; weapon: Weapon; type: NodeType }
  | { strategy: Strategy; action: "protect"; targetId: string; type: AttackNodeType };

const NEGATIVE: readonly NodeType[] = ["Problem", "Problematic option", "Fail"];

const isPiece = (n: NodeDoc) => !n.isWeapon && !n.isProtection && !nodeRefId(n.packedIntoNodeId);

/** The holds on the map, from the zones' parents (MapPage's nodeGroups root ids). */
export function holdsOf(rootIds: string[], nodes: NodeDoc[]): Hold[] {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  return rootIds
    .filter((id) => byId.has(id))
    .map((id) => ({ rootId: id, kind: nodeRefId(byId.get(id)!.parentId) ? "castle" : "kingdom" }));
}

/** A hold's keep and everything below it, weapon and protection nodes left out. */
export function holdMembers(rootId: string, nodes: NodeDoc[]): NodeDoc[] {
  const children = new Map<string, NodeDoc[]>();
  for (const n of nodes) {
    if (!isPiece(n)) continue;
    const p = nodeRefId(n.parentId);
    if (p) children.set(p, [...(children.get(p) ?? []), n]);
  }
  const root = nodes.find((n) => n.nodeId === rootId);
  if (!root) return [];
  const out = [root];
  const seen = new Set([rootId]);
  for (let i = 0; i < out.length; i++) {
    for (const c of children.get(out[i].nodeId) ?? []) {
      if (seen.has(c.nodeId)) continue;
      seen.add(c.nodeId);
      out.push(c);
    }
  }
  return out;
}

/** Nodes an undefeated protection node currently guards. */
function shieldedIds(nodes: NodeDoc[]): Set<string> {
  const out = new Set<string>();
  for (const n of nodes) {
    const target = n.isProtection && !n.defeated ? nodeRefId(n.protectsNodeId) : undefined;
    if (target) out.add(target);
  }
  return out;
}

function hitsOn(nodes: NodeDoc[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const n of nodes) {
    const target = n.isWeapon ? nodeRefId(n.targetNodeId) : undefined;
    if (target) out.set(target, (out.get(target) ?? 0) + 1);
  }
  return out;
}

const health = (n: NodeDoc) => n.health ?? 100;

/**
 * The opponent's next move, or null when the strategy has nothing to do here
 * (no outer node left standing, no attack to strike back at, a keep that is
 * already shielded...). `attackerRootId` is the opponent's own castle in a
 * civil war, null for an invader from outside the kingdom.
 */
export function planMove(
  strategy: Strategy,
  targetRootId: string,
  attackerRootId: string | null,
  nodes: NodeDoc[],
): Move | null {
  const members = holdMembers(targetRootId, nodes).filter((n) => !n.defeated);
  const keep = members.find((n) => n.nodeId === targetRootId);
  const shielded = shieldedIds(nodes);
  const hits = hitsOn(nodes);

  switch (strategy) {
    // Surround the castle: a question on the outer node that has been asked
    // the least so far.
    case "siege": {
      const parents = new Set(members.map((n) => nodeRefId(n.parentId)));
      const outer = members.filter((n) => n.nodeId !== targetRootId && !parents.has(n.nodeId));
      const pick = [...outer].sort((a, b) => (hits.get(a.nodeId) ?? 0) - (hits.get(b.nodeId) ?? 0))[0];
      return pick ? { strategy, action: "attack", targetId: pick.nodeId, weapon: "nitpick", type: "unknown" } : null;
    }
    // Dig under the keep: doubt the assumption the whole castle stands on.
    case "undermine":
      return keep ? { strategy, action: "attack", targetId: keep.nodeId, weapon: "counterpoint", type: "Problematic option" } : null;
    // Storm the breach: the weakest node, unshielded first, a failure or a
    // problematic option first among equals.
    case "assault": {
      const rank = (n: NodeDoc) => (shielded.has(n.nodeId) ? 1000 : 0) + health(n) - (NEGATIVE.includes(n.type) ? 1 : 0);
      const pick = [...members].sort((a, b) => rank(a) - rank(b))[0];
      return pick ? { strategy, action: "attack", targetId: pick.nodeId, weapon: "fatalFlaw", type: "Fail" } : null;
    }
    // Ride out against the latest attack on the opponent's own castle.
    case "sally": {
      if (!attackerRootId) return null;
      const own = new Set(holdMembers(attackerRootId, nodes).map((n) => n.nodeId));
      const attackers = nodes.filter((n) => n.isWeapon && !n.defeated && own.has(nodeRefId(n.targetNodeId) ?? ""));
      const pick = attackers[attackers.length - 1];
      return pick ? { strategy, action: "attack", targetId: pick.nodeId, weapon: "counterpoint", type: "Success" } : null;
    }
    // Stay inside and shield the opponent's own keep.
    case "fortify": {
      if (!attackerRootId || shielded.has(attackerRootId)) return null;
      const ownKeep = nodes.find((n) => n.nodeId === attackerRootId && !n.defeated);
      return ownKeep ? { strategy, action: "protect", targetId: ownKeep.nodeId, type: "Solution" } : null;
    }
  }
}
