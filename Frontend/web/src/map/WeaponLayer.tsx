import { CANVAS_W, CANVAS_H } from "../utils/canvasLayout";
import { nodeRefId } from "../utils/nodeType";
import { ringKindFor } from "./OutcomeBadge";
import { WeaponMark } from "./WeaponMark";
import type { NodeDoc } from "../types";

interface Props {
  visibleNodes: NodeDoc[];
  posFor: (node: NodeDoc) => { x: number; y: number };
  celebrateIds: Set<string>;
  /** Which weapon just had its arrows re-fired (see MapPage's triggerWeaponShot). */
  shotState: { id: string; nonce: number } | null;
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
export function WeaponLayer({ visibleNodes, posFor, celebrateIds, shotState }: Props) {
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
          const b = posFor(activeProtector ?? targetNode);
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
            <WeaponMark
              key={`weapon-${weaponNode.nodeId}`}
              x={a.x}
              y={a.y}
              targetX={b.x}
              targetY={b.y}
              weaponIcon={weaponNode.weaponIcon}
              color={bowColor}
              celebrate={celebrateIds.has(weaponNode.nodeId)}
              replayNonce={shotState?.id === weaponNode.nodeId ? shotState.nonce : 0}
            />
          );
        })}
    </svg>
  );
}
