// Per-node motion that has to stay the same across re-renders without being
// stored anywhere — every value here is derived from the node's own id.
import type { CSSProperties } from "react";
import { hashSeed } from "../utils/canvasLayout";

// A stable "which direction did this weapon fly in from" per node, derived
// from its id so it doesn't change across re-renders without needing to be
// stored anywhere — same trick MapPage's hashOffset uses for weapon-node
// placement jitter. A thin wrapper around canvasLayout's shared hashSeed
// primitive — see its own doc comment for why; hashOffset and seededRandoms
// share it too, instead of each hashing a string their own way.
export function flightOffset(seed: string): { x: number; y: number } {
  const [r1, r2] = hashSeed(seed, 2);
  const angle = r1 * 2 * Math.PI;
  const distance = 140 + r2 * 60;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

// A tiny seeded PRNG (mulberry32-ish) so a node's drift waypoints/timing are
// stable across re-renders without storing anything — the node's real x/y
// (what the backend has) never changes for this; only the drawn position
// wobbles around it, purely via CSS. Same "hash the id" trick as
// flightOffset/hashOffset elsewhere in this file/MapPage — this one *is*
// canvasLayout's shared hashSeed primitive (its own contract was modeled
// directly on this function, being the most general of the three), kept as
// its own named export here since every call site in this file already
// expects `seededRandoms`.
function seededRandoms(seed: string, count: number): number[] {
  return hashSeed(seed, count);
}

// CSS custom properties driving the .chaotic keyframes (index.css): three small
// waypoints plus a randomized duration/negative-delay, so several drifting
// nodes never move in lockstep — a shared clock with the same waypoints
// would read as one synchronized wobble, not "chaotic".
const CHAOS_AMPLITUDE_PX = 10;
export function chaosStyle(seed: string): CSSProperties {
  const [rx1, ry1, rx2, ry2, rx3, ry3, rDuration, rDelay] = seededRandoms(seed, 8);
  const wp = (rx: number, ry: number) => ({
    x: (rx * 2 - 1) * CHAOS_AMPLITUDE_PX,
    y: (ry * 2 - 1) * CHAOS_AMPLITUDE_PX,
  });
  const w1 = wp(rx1, ry1);
  const w2 = wp(rx2, ry2);
  const w3 = wp(rx3, ry3);
  const duration = 4.8 + rDuration * 3.6; // 4.8s–8.4s, a slow, unhurried wander
  return {
    "--chaos-x1": `${w1.x}px`,
    "--chaos-y1": `${w1.y}px`,
    "--chaos-x2": `${w2.x}px`,
    "--chaos-y2": `${w2.y}px`,
    "--chaos-x3": `${w3.x}px`,
    "--chaos-y3": `${w3.y}px`,
    animationDuration: `${duration}s`,
    animationDelay: `-${rDelay * duration}s`, // negative: starts mid-cycle, not all at t=0
  } as CSSProperties;
}
