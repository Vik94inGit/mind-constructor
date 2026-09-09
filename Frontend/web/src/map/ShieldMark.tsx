// A guard's shield, drawn on the *protected* node (not the protection node
// itself) — modeled on WeaponMark's own positioning-along-a-line-with-
// rotation approach, just protector→protected instead of attacker→target,
// and drawn as an outward-facing arc rather than a bow. "Like a halo but
// turned against attacking nodes" (the user's own framing): NodeCrown's
// halo is a fixed, symmetric arc always centered above a node; this one
// sits just outside the node's own icon on whichever side its protector is
// on, curving outward — reads as a shield actually being held up on that
// flank rather than a decoration floating in a fixed spot. One ShieldMark
// per active protector, so a node guarded from two directions shows two
// arcs.
const SHIELD_RADIUS = 36; // just outside NodeCrown's halo / the 48px icon's own 24px radius
const SHIELD_COLOR = "#3b82f6"; // steel-blue — a status effect, not a node type, so a literal hex (same convention NodeCrown's own HALO_GOLD/HORNS_RED use) rather than one of NODE_TYPE_COLORS

interface Props {
  /** The protected node's own canvas position — the arc is drawn just outside this, not at the protection node's own spot. */
  x: number;
  y: number;
  /** The protection node's own position — purely to compute which way the arc should face (toward it), same "offset toward the other end" idea WeaponMark's targetX/targetY serves. */
  protectorX: number;
  protectorY: number;
  color?: string;
}

export function ShieldMark({ x, y, protectorX, protectorY, color = SHIELD_COLOR }: Props) {
  const dx = protectorX - x;
  const dy = protectorY - y;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <g
      style={{
        transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`,
        transition: "transform 0.35s ease",
      }}
    >
      {/* The arc itself — a curved band just outside the node's icon,
          facing outward on the side closest to this shield's own
          protector. */}
      <path
        d={`M ${SHIELD_RADIUS - 8},-15 A ${SHIELD_RADIUS} ${SHIELD_RADIUS} 0 0 1 ${SHIELD_RADIUS - 8},15`}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.85}
      />
      {/* A small shield emblem at the arc's outer midpoint — reads as the
          actual "shield" rather than just an unlabeled curve. */}
      <path
        d={`M ${SHIELD_RADIUS + 5},-7 L ${SHIELD_RADIUS + 5},2 Q ${SHIELD_RADIUS + 5},9 ${SHIELD_RADIUS - 1},11 Q ${SHIELD_RADIUS - 7},9 ${SHIELD_RADIUS - 7},2 L ${SHIELD_RADIUS - 7},-7 Z`}
        fill={color}
        stroke="var(--surface)"
        strokeWidth={1}
        opacity={0.95}
      />
    </g>
  );
}
