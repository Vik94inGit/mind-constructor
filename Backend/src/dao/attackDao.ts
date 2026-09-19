import mongoose from "mongoose";
import { Node } from "../models/Node.js";
import { NODE_POPULATE } from "./nodeDao.js";
import { Attack, type WeaponKey } from "../models/Attack.js";

type InternalId = mongoose.Types.ObjectId | string;

export const applyDamageDao = async (
  nodeInternalId: InternalId,
  newHealth: number,
  defeated: boolean,
) => {
  return await Node.findByIdAndUpdate(
    nodeInternalId,
    { $set: { health: newHealth, defeated } },
    { new: true },
  ).populate(NODE_POPULATE);
};

export const logAttackDao = async (attackData: {
  mapId: InternalId;
  targetNodeId: InternalId;
  attackerId: string;
  weapon: WeaponKey;
  damage: number;
}) => {
  return await Attack.create(attackData);
};

// Heals a node by a fixed amount, capped at 100 — the reward side of a
// successful retaliation (see attackAbl's own retaliation branch): landing
// a counter-attack on the weapon that hit you heals *your own node's
// parent*, not the retaliating node itself or the weapon that just took
// the damage. Never touches `defeated` — a node that already hit 0 stays
// "can't be attacked further" even if its health climbs back above 0 here;
// nothing else in this app un-defeats a node either, so healing isn't
// special-cased into becoming the first thing that does.
export const healNodeDao = async (nodeInternalId: InternalId, amount: number) => {
  // Single atomic update via an aggregation-pipeline update expression,
  // instead of a read-then-write pair — health defaults to 100 in the
  // schema, but a document read via a plain query could still (in theory)
  // predate that default, so $ifNull mirrors the old `?? 100` fallback.
  return await Node.findByIdAndUpdate(
    nodeInternalId,
    [{ $set: { health: { $min: [100, { $add: [{ $ifNull: ["$health", 100] }, amount] }] } } }],
    { new: true },
  ).populate(NODE_POPULATE);
};

export const getAttackHistoryByNodeDao = async (nodeInternalId: InternalId) => {
  return await Attack.find({ targetNodeId: nodeInternalId })
    .sort({ createdAt: -1 })
    .populate("attackerId", "username");
};
