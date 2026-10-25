import { nodeRefId } from "./nodeType";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

// A strong attack plays Pac-Man while the pointer rests on it: the attack's
// own round icon runs over to whatever it hit, the empty part of its health
// ring opening wider like a mouth, nudges into it and runs back home
// (NodeCard's chomp, index.css's pacman-node-run). Strong means a
// counterpoint (axe, leaves a fresh node at 75%) or a fatal flaw (spear,
// leaves it at 50%); a nitpick stays still.
const CHOMPING_ICONS = new Set(["axe", "spear"]);

/** True for an attack node strong enough to chomp its target on hover. */
export function chompsOnHover(node: Pick<NodeDoc, "isWeapon" | "weaponIcon">): boolean {
  return !!node.isWeapon && !!node.weaponIcon && CHOMPING_ICONS.has(node.weaponIcon);
}

type Chomper = Pick<NodeDoc, "nodeId" | "isWeapon" | "weaponIcon" | "targetNodeId">;

/** Every node hovering starts a Pac-Man run on: a strong attack itself, or a node a strong attack hit. */
export function chompTargets(nodes: Chomper[]): Set<string> {
  const ids = new Set<string>();
  for (const n of nodes) {
    if (!chompsOnHover(n)) continue;
    ids.add(n.nodeId);
    const target = nodeRefId(n.targetNodeId);
    if (target) ids.add(target);
  }
  return ids;
}

/**
 * Which attacks run while `hoveredId` is under the pointer: the hovered strong
 * attack, or every strong attack on the hovered node.
 */
export function chompersFor(hoveredId: string | null, nodes: Chomper[]): Set<string> {
  const ids = new Set<string>();
  if (!hoveredId) return ids;
  for (const n of nodes) {
    if (chompsOnHover(n) && (n.nodeId === hoveredId || nodeRefId(n.targetNodeId) === hoveredId)) ids.add(n.nodeId);
  }
  return ids;
}

/**
 * The run from the attack to its target: which way it faces (degrees, 0 is
 * to the right) and how far its centre travels. It stops with its mouth over
 * the edge of the target, never past it, and stays home when the two overlap.
 */
export function chompRun(from: Pt, to: Pt, radius: number, targetRadius: number): { angle: number; reach: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const angle = dist === 0 ? 0 : (Math.atan2(dy, dx) * 180) / Math.PI;
  return { angle, reach: Math.max(0, dist - targetRadius - radius * 0.4) };
}

/** Where an attack's run goes, in canvas units: out to (dx, dy), nudging on to (lx, ly), its mouth facing `angle`. */
export type ChompMove = { dx: number; dy: number; lx: number; ly: number; angle: number };

/** The run from the attack's centre `from` to its target at `to` (see chompRun), as offsets the node itself moves by. */
export function chompMove(from: Pt, to: Pt, radius: number, targetRadius: number): ChompMove {
  const { angle, reach } = chompRun(from, to, radius, targetRadius);
  const rad = (angle * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const lunge = reach + radius * 0.25;
  return { dx: ux * reach, dy: uy * reach, lx: ux * lunge, ly: uy * lunge, angle };
}

/** What a weapon's run bites: an active shield on its target stops it there, like the arrows (see WeaponLayer). */
export function chompAim<N extends Pick<NodeDoc, "nodeId" | "targetNodeId" | "isProtection" | "defeated" | "protectsNodeId">>(
  attack: N,
  nodes: N[],
): N | undefined {
  const targetId = nodeRefId(attack.targetNodeId);
  if (!targetId) return undefined;
  const shield = nodes.find((n) => n.isProtection && !n.defeated && nodeRefId(n.protectsNodeId) === targetId);
  return shield ?? nodes.find((n) => n.nodeId === targetId);
}

/**
 * How wide the mouth starts, in degrees: the empty part of the attack's own
 * health ring, but never so shut it doesn't read as a mouth, nor so wide that
 * opening it further during the run would eat the whole icon.
 */
export function chompMouth(health: number): number {
  return Math.max(40, Math.min(260, (100 - health) * 3.6));
}
