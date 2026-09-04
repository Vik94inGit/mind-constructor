import { nanoid } from "nanoid";
import mongoose from "mongoose";
import { Node, type NodeType, type WeaponIcon } from "../models/Node.js";
import { Edge } from "../models/Edge.js";
import { isMapMemberDao } from "./mapsDao.js";

type MapInternalId = mongoose.Types.ObjectId | string;

export const findNodeByPublicIdDao = async (publicNodeId: string) => {
  return await Node.findOne({ nodeId: publicNodeId });
};

// Every Node handed back to a caller should carry the same public-id shape
// getNodesByMapDao's listing does (parentId/targetNodeId resolved to
// { nodeId, text, type }, userId to { username }) — otherwise a node that
// arrives via create/update/attack instead of the initial list fetch looks
// different (raw internal ObjectIds) until the next full reload.
export const NODE_POPULATE = [
  { path: "userId", select: "username" },
  { path: "parentId", select: "nodeId text type" },
  { path: "targetNodeId", select: "nodeId text type" },
];

// Pure mutation — the membership check and the isFirstNode calculation both
// require looking at other collections first, so they live in abl/nodeAbl.ts
// and this just inserts the document once the caller's already decided it's
// allowed to.
export const createNodeMutationDao = async (
  mapInternalId: MapInternalId,
  nodeData: {
    text: string;
    type: NodeType;
    x?: number;
    y?: number;
    color?: string;
    isFirstNode: boolean;
    parentId?: mongoose.Types.ObjectId | string | null;
    userId: string;
  },
) => {
  const node = await Node.create({
    nodeId: nanoid(10),
    mapId: mapInternalId,
    userId: nodeData.userId,
    text: nodeData.text,
    type: nodeData.type,
    parentId: nodeData.parentId,
    x: nodeData.x,
    y: nodeData.y,
    color: nodeData.color,
    isFirstNode: nodeData.isFirstNode,
  });
  return node.populate(NODE_POPULATE);
};

// Spawns a weapon node — a real Node, tagged isWeapon so it's identifiable,
// carrying the attacker's actual objection (type/text) and pointing at
// whatever it was aimed at. Called once per landed attack, so repeated
// attacks accumulate multiple weapon nodes around a target rather than
// upgrading a single one.
export const createWeaponNodeMutationDao = async (
  mapInternalId: MapInternalId,
  data: {
    targetNodeId: MapInternalId;
    weaponIcon: WeaponIcon;
    type: NodeType;
    text: string;
    userId: string;
  },
) => {
  const weaponNode = await Node.create({
    nodeId: nanoid(10),
    mapId: mapInternalId,
    userId: data.userId,
    text: data.text,
    type: data.type,
    isFirstNode: false,
    isWeapon: true,
    weaponIcon: data.weaponIcon,
    targetNodeId: data.targetNodeId,
  });
  return weaponNode.populate(NODE_POPULATE);
};

// Only members of the node's map may view it.
export const findNodeDao = async (publicNodeId: string, userId: string) => {
  const node = await findNodeByPublicIdDao(publicNodeId);
  if (!node) return null;

  const isMember = await isMapMemberDao(node.mapId, userId);
  if (!isMember) return null;

  return node;
};

// Only the node's creator may edit it.
export const updateNodeDao = async (
  publicNodeId: string,
  userId: string,
  updates: Record<string, any>,
) => {
  return await Node.findOneAndUpdate(
    { nodeId: publicNodeId, userId },
    { $set: updates },
    { new: true, runValidators: true },
  ).populate(NODE_POPULATE);
};

// Only the node's creator may delete it. Deleting a node used to leave any
// Edge pointing at it dangling (fromNodeId/toNodeId populating as null
// instead of ever being cleaned up) — this now takes the rest of the graph
// down with it: edges touching the node, branch-children's parentId, and
// weapon nodes that were aimed at it.
export const deleteNodeDao = async (publicNodeId: string, userId: string) => {
  const node = await Node.findOneAndDelete({ nodeId: publicNodeId, userId });
  if (!node) return null;

  await Promise.all([
    Edge.deleteMany({ $or: [{ fromNodeId: node._id }, { toNodeId: node._id }] }),
    Node.updateMany({ parentId: node._id }, { $set: { parentId: null } }),
    Node.deleteMany({ isWeapon: true, targetNodeId: node._id }),
  ]);

  return node;
};

// Locks exactly the given nodes and unlocks everything else on the map —
// used when a cluster selection changes, so "locked" always matches
// "member of the currently-selected cluster" with nothing left over from a
// previous selection. Passing an empty array unlocks the whole map, which
// is exactly what deselecting a cluster wants.
export const setLockedNodesDao = async (
  mapInternalId: MapInternalId,
  lockedNodeIds: string[],
) => {
  await Node.updateMany(
    { mapId: mapInternalId, nodeId: { $in: lockedNodeIds } },
    { $set: { locked: true } },
  );
  await Node.updateMany(
    { mapId: mapInternalId, nodeId: { $nin: lockedNodeIds } },
    { $set: { locked: false } },
  );
};

// Takes the map's internal _id (not the public mapId) — the caller is
// expected to have already looked the map up, e.g. as part of a membership
// check, rather than this doing a second lookup of its own.
export const countNodesByMapInternalIdDao = async (mapInternalId: MapInternalId) => {
  return await Node.countDocuments({ mapId: mapInternalId });
};

// Minimal projection for translating internal _ids back to public nodeIds —
// used by graph-analysis code (attack indicators) that works with Edge
// documents storing internal ObjectId references. Carries parentId too, so
// abl/circleAbl.ts can group by it without a second query.
export const listNodesByMapInternalIdDao = async (mapInternalId: MapInternalId) => {
  return await Node.find({ mapId: mapInternalId }, "nodeId parentId").lean();
};
