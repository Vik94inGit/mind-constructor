import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

// A strong attack plays Pac-Man while the pointer rests on it: the attack's
// icon turns into a round pie with a mouth, runs over to whatever it hit,
// takes a few bites and runs back home (map/PacmanChomp.tsx). Strong means a
// counterpoint (axe, leaves a fresh node at 75%) or a fatal flaw (spear,
// leaves it at 50%); a nitpick stays still.
const CHOMPING_ICONS = new Set(["axe", "spear"]);

/** True for an attack node strong enough to chomp its target on hover. */
export function chompsOnHover(node: Pick<NodeDoc, "isWeapon" | "weaponIcon">): boolean {
  return !!node.isWeapon && !!node.weaponIcon && CHOMPING_ICONS.has(node.weaponIcon);
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
