// Combat rules — none of this is "how do I query Mongo", it's "is this
// attack allowed, and what does it do," so it belongs here in the ABL
// layer rather than in a DAO file (attackDao.ts).
import { z } from "zod";
import type mongoose from "mongoose";
import { WEAPONS, type WeaponKey } from "../models/Attack.js";
import { type WeaponIcon } from "../models/Node.js";
import {
  findNodeByPublicIdDao,
  findNodeByInternalIdDao,
  createWeaponNodeMutationDao,
  createProtectionNodeMutationDao,
  findActiveProtectorDao,
  incrementBlockedDamageDao,
  NODE_POPULATE,
} from "../dao/nodeDao.js";
import { getMapByInternalIdDao, isMapMemberDao } from "../dao/mapsDao.js";
import { applyDamageDao, logAttackDao, healNodeDao, getAttackHistoryByNodeDao } from "../dao/attackDao.js";
import { getHiddenNodesDao } from "../dao/visibilityDao.js";
import { parseOrThrow } from "./errors.js";

// Combat has two modes, set per map (Map.discussionMode):
//
//  - Discussion (the default, "battle"): attacks hurt. The map's owner may
//    attack any node with any node type; every other member is limited by
//    the target's side (see allowedAttackTypes). There are no cooldowns, no
//    own-node rule, and no already-defeated block — only these type rules,
//    map membership, and an active protection node (see below).
//  - Personal ("creating", discussionMode === false): attacking still works
//    and still spawns the objection node, but it is decoration only — zero
//    damage, no defeat, no retaliation heal — and any member may use any
//    type.
export class AttackTypeNotAllowedError extends Error {
  constructor(public readonly allowed: readonly string[]) {
    super(`This attack node type is not allowed here. Allowed: ${allowed.join(", ")}`);
  }
}

// Reward for a successful retaliation (see the isWeapon branch in
// attackNodeAbl below) — a fixed bump, same spirit as each weapon's own
// fixed damage number, applied to the retaliating node's own *parent*
// rather than the retaliating node itself.
const RETALIATION_HEAL_AMOUNT = 10;

// Adding a shield doesn't just set up future defense, it's an immediate
// show of support for the node it defends — a fixed bump applied once, at
// creation (see protectNodeAbl below), on top of (not instead of) the
// shield's own ongoing block-and-bank-damage behavior in attackNodeAbl.
const PROTECT_CREATE_HEAL_AMOUNT = 15;

// An attack always creates a real content node alongside the damage — every
// outcome type (see OutcomeBadge.tsx on the frontend). This list is also what
// a protection node's "why" may be (PROTECT_NODE_TYPES); an attack may
// additionally be a question ("unknown") — see ATTACK_TYPES_WITH_QUESTION.
// The weapon node this becomes carries the chosen type and text — the
// attacker's actual objection, not a generic placeholder.
export const ATTACK_NODE_TYPES = [
  "Problem",
  "Problematic option",
  "Solution",
  "Option",
  "Success",
  "Fail",
] as const;
export type AttackNodeType = (typeof ATTACK_NODE_TYPES)[number];

// What an attack node may be, by the attacker. "unknown" is a question — it
// draws no ring, so it only ever reads as "are you sure?" — which is why it
// is an attack type but not a protection type (see PROTECT_NODE_TYPES).
const ATTACK_TYPES_WITH_QUESTION = [...ATTACK_NODE_TYPES, "unknown"] as const;
const POSITIVE_TYPES: readonly string[] = ["Solution", "Option", "Success"];
const NEGATIVE_TYPES: readonly string[] = ["Problem", "Problematic option", "Fail"];

// Discussion-mode rule for a member who is not the map's owner: a negative
// node is answered with positive ones; a positive (or unknown) node is
// answered with a question or a negative problem/option. The owner's set is
// everything.
export const allowedAttackTypes = (isMapOwner: boolean, targetType: string): readonly string[] => {
  if (isMapOwner) return ATTACK_TYPES_WITH_QUESTION;
  if (NEGATIVE_TYPES.includes(targetType)) return POSITIVE_TYPES;
  return ["unknown", "Problem", "Problematic option"];
};

const attackContentSchema = z.object({
  type: z.enum(ATTACK_TYPES_WITH_QUESTION, {
    error: () => `type is required and must be one of: ${ATTACK_TYPES_WITH_QUESTION.join(", ")}`,
  }),
  text: z.string().min(1, "text is required"),
});

const protectContentSchema = z.object({
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

  // An attacker has to actually belong to the map — basic access control,
  // before any combat rule.
  const map = await getMapByInternalIdDao(node.mapId);
  if (!map) return null;
  const isMember = map.members.some((m) => m.toString() === attackerId.toString());
  if (!isMember) return null;

  const isMapOwner = map.ownerId.toString() === attackerId.toString();
  // A branch the owner has hidden from invited members can't be attacked by them.
  if (!isMapOwner && (await getHiddenNodesDao(node.mapId)).ids.has(node._id.toString())) return null;

  // Personal mode is decoration only (see the top of this file).
  const battle = map.discussionMode !== false;
  if (battle) {
    const allowed = allowedAttackTypes(isMapOwner, node.type);
    if (!allowed.includes(type)) throw new AttackTypeNotAllowedError(allowed);
  }

  // Landing a hit on a weapon node heals whatever that weapon node's own
  // target's parent is, for whoever lands it — a reward for "retaliating,"
  // open to anyone rather than gated to the original victim.
  let healParentId: mongoose.Types.ObjectId | null = null;
  if (battle && node.isWeapon) {
    const victim = node.targetNodeId ? await findNodeByInternalIdDao(node.targetNodeId) : null;
    healParentId = victim?.parentId ?? null;
  }

  // Protection: the one thing that still stops an attack outright. Any
  // undefeated protection node linked to this target (see protectNodeAbl
  // below) blocks every hit unconditionally — full block while alive, no
  // stacking, no limited uses, no cooldown — so this is a plain existence
  // check, not a count. Everything else about landing an attack still
  // happens even when blocked (the attacker's objection is still a real
  // recorded node/history entry, see below); only the health/defeated
  // change is skipped.
  const protector = battle ? await findActiveProtectorDao(node._id) : null;
  const blocked = !!protector;

  const weaponDef = WEAPONS[weapon];
  const newHealth = Math.max(0, (node.health ?? 100) - weaponDef.damage);

  // Blocked: 0 damage to the target — but the damage isn't erased, it's
  // banked on the protector instead (Node.blockedDamage), released back
  // onto the target all at once if/when this protector is ever deleted
  // (see deleteNodeDao). A shield defers the hit, it doesn't cancel it.
  // `node` itself is unchanged either way here, but findNodeByPublicIdDao's
  // own query doesn't populate (see its own doc comment) — applyDamageDao's
  // query does, so the non-blocked branch already comes back client-shaped;
  // the blocked branch has to populate explicitly or the response goes out
  // with a raw userId ObjectId instead of { _id, username }.
  const updatedProtector = blocked ? await incrementBlockedDamageDao(protector._id, weaponDef.damage) : null;
  const noDamage = blocked || !battle;
  const updatedNode = noDamage ? await node.populate(NODE_POPULATE) : await applyDamageDao(node._id, newHealth, newHealth <= 0);

  await logAttackDao({
    mapId: node.mapId,
    targetNodeId: node._id,
    attackerId,
    weapon,
    damage: noDamage ? 0 : weaponDef.damage,
  });

  // Every landed attack spawns its own weapon node pointing at the target
  // — repeated attacks accumulate weapon nodes rather than upgrading one.
  // It's a real content node now (the attacker's actual objection), not a
  // generic "<weapon> attack" placeholder — type/text come from the caller.
  // Still created even when blocked: the objection itself is a real
  // recorded node regardless of whether the shield stopped the damage.
  const weaponNode = await createWeaponNodeMutationDao(node.mapId, {
    targetNodeId: node._id,
    weaponIcon: WEAPON_TO_ICON[weapon],
    type,
    text,
    userId: attackerId,
  });

  // Only set on a landed retaliation (see healParentId above) — a node
  // with no parent (a root) simply has nothing here to reward, same as
  // "no circle" for a childless node elsewhere in this app. Independent of
  // `blocked` — this is about the weapon node's own target's parent, not
  // about whether the current attack's own damage landed.
  const healedParent = healParentId ? await healNodeDao(healParentId, RETALIATION_HEAL_AMOUNT) : null;

  return { node: updatedNode, weaponNode, healedParent, blocked, protector: updatedProtector };
};

// Which node types a protection node's own linked "why" can carry — reused
// from ATTACK_NODE_TYPES rather than duplicated: a protection node is the
// same kind of real, typed content node a weapon node is, just framed as a
// defense instead of an objection.
export const PROTECT_NODE_TYPES = ATTACK_NODE_TYPES;

// Creates a protection node aimed at publicNodeId. Owner-of-target-only —
// deliberately *not* open like attackNodeAbl above: a shield has a
// map-wide, no-cost, no-cooldown effect (it blocks *everyone's* future
// attacks on that node, not just the protector's own), so only the target's
// own owner may add one, same gating as editing that node's own text/type.
export class NotNodeOwnerError extends Error {}

export const protectNodeAbl = async (
  publicNodeId: string,
  protectorId: string,
  content: unknown,
) => {
  const { type, text } = parseOrThrow(protectContentSchema, content);

  const node = await findNodeByPublicIdDao(publicNodeId);
  if (!node) return null;

  if (node.userId.toString() !== protectorId.toString()) throw new NotNodeOwnerError();

  const protectionNode = await createProtectionNodeMutationDao(node.mapId, {
    protectsNodeId: node._id,
    type,
    text,
    userId: protectorId,
  });

  // Immediate, one-time reward for adding a shield — capped at 100, same
  // healNodeDao every other heal in this app already uses.
  const healedNode = await healNodeDao(node._id, PROTECT_CREATE_HEAL_AMOUNT);

  return { protectionNode, healedNode };
};

// Only map members may see a node's attack history.
export const getAttackHistoryAbl = async (publicNodeId: string, userId: string) => {
  const node = await findNodeByPublicIdDao(publicNodeId);
  if (!node) return null;

  const isMember = await isMapMemberDao(node.mapId, userId);
  if (!isMember) return null;

  return await getAttackHistoryByNodeDao(node._id);
};
