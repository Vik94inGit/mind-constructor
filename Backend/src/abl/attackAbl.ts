// Combat rules. This is the clearest case in the whole app of logic that
// used to live in a DAO file (attackDao.ts) even though none of it is "how
// do I query Mongo" — it's "is this attack allowed, and what does it do."
import { z } from "zod";
import { WEAPONS, type WeaponKey } from "../models/Attack.js";
import { type WeaponIcon } from "../models/Node.js";
import { findNodeByPublicIdDao, createWeaponNodeMutationDao } from "../dao/nodeDao.js";
import { getMapByInternalIdDao, isMapMemberDao } from "../dao/mapsDao.js";
import {
  getLastAttackDao,
  applyDamageDao,
  logAttackDao,
  getAttackHistoryByNodeDao,
} from "../dao/attackDao.js";
import { parseOrThrow } from "./errors.js";

export class CannotAttackOwnNodeError extends Error {}
// Discussion mode's inverse of the above — see Map.discussionMode. Attacking
// itself is never disabled by discussion mode, only *who* it can land on.
export class CanOnlyAttackOwnNodeError extends Error {}
export class NodeAlreadyDefeatedError extends Error {}
export class WeaponOnCooldownError extends Error {
  readyAt: number;
  constructor(readyAt: number) {
    super("Weapon is still on cooldown");
    this.readyAt = readyAt;
  }
}

// An attack now always creates a real content node alongside the damage —
// restricted to the three "this is an objection" types, not the full
// NodeType set (Success/Solution/Option/unknown don't read as an attack's
// own claim). The weapon node this becomes carries this type + text
// instead of the old generic "<weapon> attack" placeholder.
export const ATTACK_NODE_TYPES = ["Problem", "Problematic option", "Fail"] as const;
export type AttackNodeType = (typeof ATTACK_NODE_TYPES)[number];

const attackContentSchema = z.object({
  type: z.enum(ATTACK_NODE_TYPES, {
    error: () => `type is required and must be one of: ${ATTACK_NODE_TYPES.join(", ")}`,
  }),
  text: z.string().min(1, "text is required"),
});

// Which visual icon each combat weapon spawns as a weapon-node. Defined
// here, not imported from attackIndicatorAbl.ts — that module computes a
// severity-based icon for an unrelated, read-only signal; this one is
// simply "which weapon did the attacker pick."
const WEAPON_TO_ICON: Record<WeaponKey, WeaponIcon> = {
  nitpick: "sword",
  counterpoint: "axe",
  fatalFlaw: "spear",
};

export const attackNodeAbl = async (
  publicNodeId: string,
  attackerId: string,
  weapon: WeaponKey,
  content: unknown,
) => {
  // Validated before anything touches the database, same as every other
  // ABL — a malformed attack shouldn't cost a lookup, let alone damage.
  const { type, text } = parseOrThrow(attackContentSchema, content);

  const node = await findNodeByPublicIdDao(publicNodeId);
  if (!node) return null;

  // Fetched (not just an isMapMemberDao existence check) because the own-
  // node rule right below depends on this map's discussionMode too.
  const map = await getMapByInternalIdDao(node.mapId);
  if (!map) return null;
  const isMember = map.members.some((m) => m.toString() === attackerId.toString());
  if (!isMember) return null;

  const isOwnNode = node.userId.toString() === attackerId.toString();
  // Normal rules: attack only lands on someone else's node. Discussion
  // mode inverts this — attacking stays enabled, it just only lands on
  // your *own* node (self-critique instead of combat). See Map.discussionMode.
  if (map.discussionMode) {
    if (!isOwnNode) throw new CanOnlyAttackOwnNodeError();
  } else if (isOwnNode) {
    throw new CannotAttackOwnNodeError();
  }
  if (node.defeated) {
    throw new NodeAlreadyDefeatedError();
  }

  const weaponDef = WEAPONS[weapon];

  if (weaponDef.cooldownMs > 0) {
    const lastUse = await getLastAttackDao(attackerId, weapon);
    if (lastUse) {
      const readyAt = new Date(lastUse.createdAt as Date).getTime() + weaponDef.cooldownMs;
      if (Date.now() < readyAt) {
        throw new WeaponOnCooldownError(readyAt);
      }
    }
  }

  const newHealth = Math.max(0, (node.health ?? 100) - weaponDef.damage);

  const updatedNode = await applyDamageDao(node._id, newHealth, newHealth <= 0);

  await logAttackDao({
    mapId: node.mapId,
    targetNodeId: node._id,
    attackerId,
    weapon,
    damage: weaponDef.damage,
  });

  // Every landed attack spawns its own weapon node pointing at the target
  // — repeated attacks accumulate weapon nodes rather than upgrading one.
  // It's a real content node now (the attacker's actual objection), not a
  // generic "<weapon> attack" placeholder — type/text come from the caller.
  const weaponNode = await createWeaponNodeMutationDao(node.mapId, {
    targetNodeId: node._id,
    weaponIcon: WEAPON_TO_ICON[weapon],
    type,
    text,
    userId: attackerId,
  });

  return { node: updatedNode, weaponNode };
};

// Only map members may see a node's attack history.
export const getAttackHistoryAbl = async (publicNodeId: string, userId: string) => {
  const node = await findNodeByPublicIdDao(publicNodeId);
  if (!node) return null;

  const isMember = await isMapMemberDao(node.mapId, userId);
  if (!isMember) return null;

  return await getAttackHistoryByNodeDao(node._id);
};
