import { idOf } from "./nodeType";
import type { MapAttack, MapDoc, NodeDoc } from "../types";

// Ending a discussion fairly — the same rule as Backend's finishAbl.ts
// finishRule, so the Finish button can say why it waits before anyone
// presses it (the server still decides). The owner may finish when the
// opponent had the last word (the newest node is another member's, or an
// imitated-opponent move), when every other member agreed, when nobody else
// is on the map and the owner never played the opponent, or on an empty map.
// So nobody can end a discussion right after their own point.
export type FinishReason = "empty" | "opponentLastWord" | "everyoneAgreed" | "noOpponent";

export interface FinishState {
  allowed: boolean;
  reason: FinishReason | null;
  /** Other members' ids who haven't agreed yet. */
  waitingFor: string[];
  /** Other members' ids. */
  others: string[];
}

export function memberIds(map: MapDoc): string[] {
  return (map.members ?? []).map((m) => (typeof m === "string" ? m : m._id));
}

export function finishState(map: MapDoc, nodes: NodeDoc[]): FinishState {
  const owner = map.ownerId;
  const others = memberIds(map).filter((id) => id !== owner);
  const agreed = new Set(map.finishAgreedBy ?? []);
  const waitingFor = others.filter((id) => !agreed.has(id));
  let latest: NodeDoc | null = null;
  for (const n of nodes) {
    if (!latest || (n.createdAt ?? "") > (latest.createdAt ?? "")) latest = n;
  }
  const result = (allowed: boolean, reason: FinishReason | null) => ({ allowed, reason, waitingFor, others });
  if (!latest) return result(true, "empty");
  if (latest.byOpponent || idOf(latest.userId) !== owner) return result(true, "opponentLastWord");
  if (others.length > 0 && waitingFor.length === 0) return result(true, "everyoneAgreed");
  if (others.length === 0 && !nodes.some((n) => n.byOpponent)) return result(true, "noOpponent");
  return result(false, null);
}

/** Of the map's own points (not attacks or shields), how many still stand and how many fell. */
export function battleTally(nodes: NodeDoc[]): { standing: number; fallen: number } {
  let standing = 0;
  let fallen = 0;
  for (const n of nodes) {
    if (n.isWeapon || n.isProtection) continue;
    if (n.defeated) fallen++;
    else standing++;
  }
  return { standing, fallen };
}

// The replay shows the fight as it was: at the moment of the newest node on
// screen, a node's health is today's plus every hit it took after that moment
// (capped at 100), and it has fallen only if it is fallen today and had no
// health left then. Heals after that moment aren't taken back — the attack
// log is all there is to go on — so mid-fight health can read a little high.
export function healthAt(nodes: NodeDoc[], attacks: MapAttack[], at: string | undefined): NodeDoc[] {
  if (!at || attacks.length === 0) return nodes;
  const later = new Map<string, number>();
  for (const a of attacks) {
    if (a.createdAt > at && a.damage > 0) later.set(a.targetNodeId, (later.get(a.targetNodeId) ?? 0) + a.damage);
  }
  if (later.size === 0) return nodes;
  return nodes.map((n) => {
    const back = later.get(n.nodeId);
    if (!back) return n;
    const health = Math.min(100, n.health + back);
    return { ...n, health, defeated: n.defeated && health <= 0 };
  });
}

