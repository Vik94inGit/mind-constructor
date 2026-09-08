// Combat rules. This is the clearest case in the whole app of logic that
// used to live in a DAO file (attackDao.ts) even though none of it is "how
// do I query Mongo" — it's "is this attack allowed, and what does it do."
import { z } from "zod";
import type mongoose from "mongoose";
import { WEAPONS, type WeaponKey } from "../models/Attack.js";
import { type WeaponIcon } from "../models/Node.js";
import { findNodeByPublicIdDao, findNodeByInternalIdDao, createWeaponNodeMutationDao } from "../dao/nodeDao.js";
import { getMapByInternalIdDao, isMapMemberDao } from "../dao/mapsDao.js";
import { applyDamageDao, logAttackDao, healNodeDao, getAttackHistoryByNodeDao } from "../dao/attackDao.js";
import { parseOrThrow } from "./errors.js";

// Combat is fully open now — attackNodeAbl below no longer throws any of
// these; every restriction on *who* can attack, *what* can be attacked,
// and *how often* has been removed. All five classes are kept exported and
// unused (rather than torn out of every layer that still references them —
// nodeController.ts's own error handling, mainly) purely so nothing else
// has to change just to keep compiling; none of them can fire any more.
export class CannotAttackOwnNodeError extends Error {}
export class CanOnlyAttackOwnNodeError extends Error {}
export class CannotRetaliateError extends Error {}
export class NodeAlreadyDefeatedError extends Error {}
export class WeaponOnCooldownError extends Error {
  readyAt: number;
  constructor(readyAt: number) {
    super("Weapon is still on cooldown");
    this.readyAt = readyAt;
  }
}

// Reward for a successful retaliation (see the isWeapon branch in
// attackNodeAbl below) — a fixed bump, same spirit as each weapon's own
// fixed damage number, applied to the retaliating node's own *parent*
// rather than the retaliating node itself.
const RETALIATION_HEAL_AMOUNT = 10;

// An attack now always creates a real content node alongside the damage —
// restricted to every outcome type (see OutcomeBadge.tsx on the frontend),
// just not "unknown" (which draws no ring/framing at all, so it doesn't
// read as an attack's own claim one way or the other). Used to be only the
// three negative-framed types (Problem/Problematic option/Fail) on the
// theory that an attack is inherently an objection — but retaliation
// (see CannotRetaliateError below) is exactly the case where the
// attacker's own claim is naturally a positive one ("my defense holds"),
// so the positive types (Success/Solution/Option) belong here too now.
// The weapon node this becomes carries this type + text instead of the
// old generic "<weapon> attack" placeholder.
export const ATTACK_NODE_TYPES = [
  "Problem",
  "Problematic option",
  "Solution",
  "Option",
  "Success",
  "Fail",
] as const;
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

  // Still fetched for the membership check right below — an attacker has
  // to actually belong to the map, full stop; that's the one thing left
  // that isn't a "combat rule" so much as basic access control.
  const map = await getMapByInternalIdDao(node.mapId);
  if (!map) return null;
  const isMember = map.members.some((m) => m.toString() === attackerId.toString());
  if (!isMember) return null;

  // Fully open combat: no own-node rule, no restriction on attacking a
  // weapon node (used to require being the one it actually hit —
  // "retaliation," see the removed CannotRetaliateError), no
  // already-defeated block, no cooldowns. Every check that used to gate
  // *who* could land a hit, *what* it could land on, and *how often* is
  // gone — any map member can attack any node, any number of times, with
  // any weapon, regardless of its current health.
  //
  // The one thing that survives from the old retaliation mechanic is the
  // reward itself, now unconditional: landing a hit on a weapon node still
  // heals whatever that weapon node's own target's parent is, for whoever
  // lands it — not just the original victim striking back any more.
  let healParentId: mongoose.Types.ObjectId | null = null;
  if (node.isWeapon) {
    const victim = node.targetNodeId ? await findNodeByInternalIdDao(node.targetNodeId) : null;
    healParentId = victim?.parentId ?? null;
  }

  const weaponDef = WEAPONS[weapon];
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

  // Only set on a landed retaliation (see healParentId above) — a node
  // with no parent (a root) simply has nothing here to reward, same as
  // "no circle" for a childless node elsewhere in this app.
  const healedParent = healParentId ? await healNodeDao(healParentId, RETALIATION_HEAL_AMOUNT) : null;

  return { node: updatedNode, weaponNode, healedParent };
};

// Only map members may see a node's attack history.
export const getAttackHistoryAbl = async (publicNodeId: string, userId: string) => {
  const node = await findNodeByPublicIdDao(publicNodeId);
  if (!node) return null;

  const isMember = await isMapMemberDao(node.mapId, userId);
  if (!isMember) return null;

  return await getAttackHistoryByNodeDao(node._id);
};
