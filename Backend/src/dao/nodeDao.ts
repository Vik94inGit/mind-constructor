import { nanoid } from "nanoid";
import mongoose from "mongoose";
import { Node, type NodeType, type WeaponIcon } from "../models/Node.js";
import { Edge } from "../models/Edge.js";
import { isMapMemberDao } from "./mapsDao.js";

type MapInternalId = mongoose.Types.ObjectId | string;

export const findNodeByPublicIdDao = async (publicNodeId: string) => {
  return await Node.findOne({ nodeId: publicNodeId });
};

// Internal-id lookup, unpopulated — used specifically by attackAbl's
// retaliation rule to resolve a weapon node's own targetNodeId (an
// internal ObjectId ref, not a public nodeId) back to the real node it
// hit, so it can check who owns it. Not run through NODE_POPULATE like
// findNodeByPublicIdDao — the caller only ever reads userId/parentId off
// this, not a client-shaped response.
export const findNodeByInternalIdDao = async (
  nodeInternalId: mongoose.Types.ObjectId | string,
) => {
  return await Node.findById(nodeInternalId);
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
  { path: "protectsNodeId", select: "nodeId text type" },
  { path: "packedIntoNodeId", select: "nodeId text type" },
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

// Spawns a protection node — exact mirror of createWeaponNodeMutationDao,
// isProtection/protectsNodeId in place of isWeapon/weaponIcon/targetNodeId.
// Called once per POST /:nodeId/protect; multiple protection nodes can
// point at the same target (each renders its own shield arc — see
// ShieldMark.tsx — none of them "use up" or replace an existing one).
export const createProtectionNodeMutationDao = async (
  mapInternalId: MapInternalId,
  data: {
    protectsNodeId: MapInternalId;
    type: NodeType;
    text: string;
    userId: string;
  },
) => {
  const protectionNode = await Node.create({
    nodeId: nanoid(10),
    mapId: mapInternalId,
    userId: data.userId,
    text: data.text,
    type: data.type,
    isFirstNode: false,
    isProtection: true,
    protectsNodeId: data.protectsNodeId,
  });
  return protectionNode.populate(NODE_POPULATE);
};

// A boolean gate, not a list — attackNodeAbl only ever needs "does at least
// one undefeated protection node currently guard this node," per the
// full-block-while-alive mechanic (no stacking, no partial absorption). The
// actual document (not just a boolean) is returned since attackNodeAbl also
// needs its _id to bank the blocked damage onto (see
// incrementBlockedDamageDao below).
export const findActiveProtectorDao = async (protectedNodeInternalId: MapInternalId) => {
  return await Node.findOne({
    isProtection: true,
    protectsNodeId: protectedNodeInternalId,
    defeated: false,
  });
};

// Banks a blocked hit's damage onto the protector instead of applying it to
// the node it defends — see Node.blockedDamage's own doc comment for why:
// a shield defers damage, it doesn't erase it. Returns the updated
// protector so the caller can hand it back to the client (its running
// total is worth surfacing — see NodePanel's own "this shield has
// absorbed N damage" line).
export const incrementBlockedDamageDao = async (protectorInternalId: MapInternalId, amount: number) => {
  return await Node.findByIdAndUpdate(
    protectorInternalId,
    { $inc: { blockedDamage: amount } },
    { new: true },
  ).populate(NODE_POPULATE);
};

// How many nodes are currently packed into this container — read *before*
// packNodesMutationDao runs, so packAbl.ts's auto-bump can tell "was this
// the container's first-ever pack" from "it already had members."
export const countPackedMembersDao = async (containerInternalId: MapInternalId) => {
  return await Node.countDocuments({ packedIntoNodeId: containerInternalId });
};

// Folds the given members into containerInternalId — packAbl.ts has
// already validated eligibility/ownership by this point, so this is a
// plain bulk mutation, same division of labor as every other *MutationDao
// in this file. Returns the freshly-populated container + members so the
// caller can broadcast/respond with up-to-date shapes rather than the
// pre-mutation documents it started with.
export const packNodesMutationDao = async (
  containerInternalId: mongoose.Types.ObjectId,
  memberInternalIds: mongoose.Types.ObjectId[],
) => {
  await Node.updateMany(
    { _id: { $in: memberInternalIds } },
    { $set: { packedIntoNodeId: containerInternalId } },
  );
  const [container, members] = await Promise.all([
    Node.findById(containerInternalId).populate(NODE_POPULATE),
    Node.find({ _id: { $in: memberInternalIds } }).populate(NODE_POPULATE),
  ]);
  return { container, members };
};

// Unpacks one member — owner-of-the-member-itself scoped, same convention
// updateNodeDao already uses (any other node edit is gated by "you own the
// node being changed," not by who owns whatever it's connected to).
export const unpackNodeMutationDao = async (publicNodeId: string, userId: string) => {
  return await Node.findOneAndUpdate(
    { nodeId: publicNodeId, userId },
    { $set: { packedIntoNodeId: null } },
    { new: true },
  ).populate(NODE_POPULATE);
};

// Atomic guard for packAbl.ts's auto-bump: only ever succeeds while
// sizeTier is still null (never touched, manually or automatically) — a
// concurrent manual PATCH landing between packAbl's own "check" and this
// write loses the race cleanly instead of clobbering the user's explicit
// choice.
export const bumpSizeTierIfDefaultDao = async (
  nodeInternalId: mongoose.Types.ObjectId,
  tier: number,
) => {
  return await Node.findOneAndUpdate(
    { _id: nodeInternalId, sizeTier: null },
    { $set: { sizeTier: tier } },
    { new: true },
  ).populate(NODE_POPULATE);
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
//
// Returns { node, damagedProtectedNode } instead of just `node` now —
// deleting a protection node with a nonzero blockedDamage releases that
// whole running total onto whatever it was defending in the same breath
// (see Node.blockedDamage's own doc comment), and the caller needs that
// second, separately-updated node to broadcast so every open tab picks up
// the health change live rather than only on next reload (unlike the other
// cascades below, which stay silent — a health change is worth more than
// those).
export const deleteNodeDao = async (publicNodeId: string, userId: string) => {
  const node = await Node.findOneAndDelete({ nodeId: publicNodeId, userId });
  if (!node) return null;

  let damagedProtectedNode = null;
  if (node.isProtection && node.protectsNodeId && node.blockedDamage > 0) {
    const protectedNode = await Node.findById(node.protectsNodeId);
    if (protectedNode) {
      const newHealth = Math.max(0, (protectedNode.health ?? 100) - node.blockedDamage);
      damagedProtectedNode = await Node.findByIdAndUpdate(
        protectedNode._id,
        { $set: { health: newHealth, defeated: newHealth <= 0 } },
        { new: true },
      ).populate(NODE_POPULATE);
    }
  }

  await Promise.all([
    Edge.deleteMany({ $or: [{ fromNodeId: node._id }, { toNodeId: node._id }] }),
    Node.updateMany({ parentId: node._id }, { $set: { parentId: null } }),
    Node.deleteMany({ isWeapon: true, targetNodeId: node._id }),
    // Deleting a protected node takes its shields down with it — same
    // "the thing it points at is gone, so it goes too" reasoning as the
    // weapon-node line above. Any *other* protector's own blockedDamage
    // (a second shield also guarding this same node) is simply lost along
    // with it here, same as any other in-progress state a deleted node's
    // relations carry — there's no third node left to release it onto.
    Node.deleteMany({ isProtection: true, protectsNodeId: node._id }),
    // Deleting a container unpacks its members instead of leaving them
    // forever hidden with a dangling packedIntoNodeId — mirrors the
    // parentId line above (deleting a parent doesn't delete its children,
    // it just clears the link).
    Node.updateMany({ packedIntoNodeId: node._id }, { $set: { packedIntoNodeId: null } }),
  ]);

  return { node, damagedProtectedNode };
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
