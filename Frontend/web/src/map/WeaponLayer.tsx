import { CANVAS_W, CANVAS_H } from "../utils/canvasLayout";
import { NODE_TYPE_COLORS, nodeRefId } from "../utils/nodeType";
import { ringKindFor } from "./OutcomeBadge";
import { WeaponMark } from "./WeaponMark";
import { PacmanChomp } from "./PacmanChomp";
import type { NodeDoc } from "../types";

interface Props {
  visibleNodes: NodeDoc[];
  posFor: (node: NodeDoc) => { x: number; y: number };
  celebrateIds: Set<string>;
  /** Which weapon just had its arrows re-fired (see MapPage's triggerWeaponShot). */
  shotState: { id: string; nonce: number } | null;
  /** The strong attack the pointer rests on, which plays its Pac-Man run (see PacmanChomp). */
  chompId?: string | null;
  /** A node's icon radius in canvas units, as drawn at the current zoom. */
  iconRadius?: (node: NodeDoc) => number;
}

// Weapon marks get their own SVG layer, painted after every NodeCard rather
// than inside the backdrop SVG — that one sits *behind* the node icons, but a
// bow drawn there landed centered right under its own attack node's opaque
// circular icon. z-[34] (not just "a later DOM sibling"): NodeCard carries an
// explicit z-31/z-32, and a sibling with an explicit positive z-index always
// paints over a z-index:auto one regardless of DOM order, so the explicit
// z-[34] is what keeps this on top; DOM order is incidental. Every attack
// spawns a real node carrying the attacker's objection (see attackAbl.ts) —
// this is the permanent bow facing whatever it targeted, plus the volley of
// transient arrows (see WeaponMark) that fires when the attack lands and
// again on demand when either end gets clicked.
export function WeaponLayer({ visibleNodes, posFor, celebrateIds, shotState, chompId, iconRadius = () => 24 }: Props) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[34] h-full w-full"
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
    >
      {visibleNodes
        .filter((n) => n.isWeapon)
        .map((weaponNode) => {
          const targetId = nodeRefId(weaponNode.targetNodeId);
          if (!targetId) return null;
          const targetNode = visibleNodes.find((n) => n.nodeId === targetId);
          if (!targetNode) return null;
          const a = posFor(weaponNode);
          // An active shield on the target intercepts the arrows —
          // they fly to (and stop at) the shield's own position
          // instead of reaching the target, reading as "blocked
          // here," not "landed." Any one active protector is enough
          // to redirect every one of the target's own attackers,
          // same "just needs to exist" gate attackAbl.ts's own
          // findActiveProtectorDao check already uses server-side.
          const activeProtector = visibleNodes.find(
            (n) => n.isProtection && !n.defeated && nodeRefId(n.protectsNodeId) === targetId,
          );
          const aimedAt = activeProtector ?? targetNode;
          const b = posFor(aimedAt);
          // A weapon node can carry any outcome type now, not just
          // the negative-framed ones (see Backend's attackAbl.ts —
          // retaliation especially is naturally a positive claim,
          // "my defense holds") — var(--danger) red for every bow
          // read oddly on one of those, so a halo-classified
          // weapon (ringKindFor, same classification the badge's
          // own halo/horns crown uses) draws its bow in
          // var(--n-option) blue instead.
          const bowColor = ringKindFor(weaponNode.type) === "halo" ? "var(--n-option)" : "var(--danger)";
          return (
            <g
              key={`weapon-${weaponNode.nodeId}`}
              // The map's entrance shows the bow once both the weapon and
              // whatever it's aimed at are there (see applyEntranceFrame).
              data-reveal-seg={`${weaponNode.nodeId} ${aimedAt.nodeId}`}
            >
            <WeaponMark
              x={a.x}
              y={a.y}
              targetX={b.x}
              targetY={b.y}
              weaponIcon={weaponNode.weaponIcon}
              color={bowColor}
              celebrate={celebrateIds.has(weaponNode.nodeId)}
              replayNonce={shotState?.id === weaponNode.nodeId ? shotState.nonce : 0}
            />
            {/* Bites whatever the arrows reach: the target, or its shield. */}
            {chompId === weaponNode.nodeId && (
              <PacmanChomp
                from={a}
                to={b}
                radius={iconRadius(weaponNode) * 1.08}
                targetRadius={iconRadius(aimedAt)}
                color={NODE_TYPE_COLORS[weaponNode.type]}
              />
            )}
            </g>
          );
        })}
    </svg>
  );
}
