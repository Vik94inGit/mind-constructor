import mongoose from "mongoose";
import { Node } from "../models/Node.js";
import { NODE_POPULATE } from "./nodeDao.js";
import { Attack, type WeaponKey } from "../models/Attack.js";

type InternalId = mongoose.Types.ObjectId | string;

export const getLastAttackDao = async (attackerId: string, weapon: WeaponKey) => {
  return await Attack.findOne({ attackerId, weapon })
    .sort({ createdAt: -1 })
    .lean();
};

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

export const getAttackHistoryByNodeDao = async (nodeInternalId: InternalId) => {
  return await Attack.find({ targetNodeId: nodeInternalId })
    .sort({ createdAt: -1 })
    .populate("attackerId", "username");
};
