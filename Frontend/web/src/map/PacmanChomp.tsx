import type { CSSProperties } from "react";
import { chompRun } from "../utils/pacman";

type Pt = { x: number; y: number };

interface Props {
  from: Pt;
  to: Pt;
  /** The attack icon's radius in canvas units, so the pie covers it exactly. */
  radius: number;
  targetRadius: number;
  color: string;
}

// The Pac-Man run a strong attack plays while hovered (see utils/pacman.ts):
// a round pie in the attack's colour leaves the attack's spot with its mouth
// open, runs to its target, nudges into it once and comes back, over and over
// until the pointer leaves. Drawn inside WeaponLayer's SVG, so it paints over the nodes.
//
// The outer group's transform attribute puts the origin on the attack and
// turns the x axis toward the target; the CSS animations (index.css) then
// only ever move along x and hold the jaws open round that origin, so one
// set of keyframes fits any direction and distance.
export function PacmanChomp({ from, to, radius, targetRadius, color }: Props) {
  const { angle, reach } = chompRun(from, to, radius, targetRadius);
  const r = radius;
  const runStyle = { "--chomp-reach": `${reach}px`, "--chomp-lunge": `${r * 0.25}px` } as CSSProperties;
  return (
    <g transform={`translate(${from.x} ${from.y}) rotate(${angle})`} data-testid="pacman-chomp" aria-hidden="true">
      <g className="pacman-run" style={runStyle}>
        <g className="pacman-jaw-top">
          <path d={`M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0 Z`} fill={color} stroke="var(--surface)" strokeWidth={r * 0.08} />
          <circle cx={r * 0.12} cy={-r * 0.52} r={r * 0.12} fill="var(--surface)" />
        </g>
        <g className="pacman-jaw-bottom">
          <path d={`M ${-r} 0 A ${r} ${r} 0 0 0 ${r} 0 Z`} fill={color} stroke="var(--surface)" strokeWidth={r * 0.08} />
        </g>
      </g>
    </g>
  );
}
