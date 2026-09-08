// Combat rules. This is the clearest case in the whole app of logic that
// used to live in a DAO file (attackDao.ts) even though none of it is "how
// do I query Mongo" — it's "is this attack allowed, and what does it do."
import { z } from "zod";
import type mongoose from "mongoose";
import { WEAPONS, type WeaponKey } from "../models/Attack.js";
import { type WeaponIcon } from "../models/Node.js";
import { findNodeByPublicIdDao, findNodeByInternalIdDao, createWeaponNodeMutationDao } from "../dao/nodeDao.js";
import { getMapByInternalIdDao, isMapMemberDao } from "../dao/mapsDao.js";
import {
  getLastAttackDao,
  applyDamageDao,
  logAttackDao,
  healNodeDao,
  getAttackHistoryByNodeDao,
} from "../dao/attackDao.js";
import { parseOrThrow } from "./errors.js";

// No longer thrown — attacking your own node is now always allowed (see
// CanOnlyAttackOwnNodeError below). Kept exported since nodeController.ts
// still pattern-matches on it defensively; harmless dead code, not worth
// the churn of touching every layer to remove it.
export class CannotAttackOwnNodeError extends Error {}
// The app's only combat rule now: an attack always lands on your *own*
// node (self-critique), never someone else's. This used to be gated behind
// Map.discussionMode (attack others normally, or attack only yourself in
// "discussion mode") — that per-map toggle is gone; every map behaves as
// discussion mode did. See attackNodeAbl's own-node check below.
export class CanOnlyAttackOwnNodeError extends Error {}
// A weapon node is otherwise excluded from combat entirely — "landing an
// attack on an attack isn't a thing this game models" (see the frontend's
// own canAttackNode) — except for the one node it actually hit striking
// back at it. Thrown when the target *is* a weapon node but either it has
// no resolvable target of its own, or the caller doesn't own the node it
// targeted — i.e. "attack any weapon node you like" is still not a thing,
// only "retaliate against the one that hit you" is.
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

  // Fetched (not just an isMapMemberDao existence check) for the membership
  // check right below — Map.discussionMode itself no longer affects the
  // own-node rule (see CanOnlyAttackOwnNodeError's own comment), but the
  // map document is still needed to confirm the attacker belongs to it.
  const map = await getMapByInternalIdDao(node.mapId);
  if (!map) return null;
  const isMember = map.members.some((m) => m.toString() === attackerId.toString());
  if (!isMember) return null;

  // Retaliation: the one case a weapon node can be attacked at all — see
  // CannotRetaliateError's own doc comment. Its own, narrower check;
  // deliberately *not* run through the own-node/discussion-mode rule below,
  // which is about content nodes (whose owner a weapon node's `userId` is
  // never going to match anyway, since that's always the original
  // attacker, not the retaliator).
  let healParentId: mongoose.Types.ObjectId | null = null;
  if (node.isWeapon) {
    const victim = node.targetNodeId ? await findNodeByInternalIdDao(node.targetNodeId) : null;
    if (!victim || victim.userId.toString() !== attackerId.toString()) {
      throw new CannotRetaliateError();
    }
    healParentId = victim.parentId ?? null;
  } else {
    const isOwnNode = node.userId.toString() === attackerId.toString();
    // Discussion mode's own-node-only rule is now the app's only combat
    // rule — attacking is self-critique, not player-vs-player, regardless
    // of a given map's stored Map.discussionMode value. See attackAbl.ts's
    // top-of-file comment and CanOnlyAttackOwnNodeError's own doc comment.
    if (!isOwnNode) throw new CanOnlyAttackOwnNodeError();
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
