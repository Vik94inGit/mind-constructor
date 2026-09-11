import { Map } from "../models/Map.js";
import { Node, NODE_TYPES, type NodeType } from "../models/Node.js";
import { Edge } from "../models/Edge.js";
import { nanoid } from "nanoid";

export const findMapByPublicIdDao = async (publicMapId: string) => {
  return await Map.findOne({ mapId: publicMapId });
};

export const getMapsDao = async (
  currentUserId: string,
  filterType: "all" | "owned" | "shared" = "all",
) => {
  const query =
    filterType === "owned"
      ? { ownerId: currentUserId }
      : filterType === "shared"
        ? { members: currentUserId, ownerId: { $ne: currentUserId } }
        : { $or: [{ members: currentUserId }] };
  const maps = await Map.find(query);
  // A dashboard card only ever needs enough to render itself
  // (name/color/ownerId) plus how many members there are — memberColors/
  // pendingInvites/selectedCircle used to ride along on every card in this
  // list for no reason: nothing in the frontend's own list view reads any
  // of them (a map's full detail, real member ids included, is only ever
  // fetched once you're actually on that map, or opening Invite — see
  // getMapByIdDao/InviteMemberModal's own on-demand fetch). `members`
  // itself is dropped the same way here, replaced by its own length —
  // never sent as the raw id array on this list endpoint.
  return maps.map((m) => {
    const { memberColors, pendingInvites, selectedCircle, members, ...rest } = m.toJSON();
    return { ...rest, memberCount: Array.isArray(members) ? members.length : 0 };
  });
};

export const getMapByIdDao = async (publicMapId: string, userId: string) => {
  // Single database lookup using public string mapId AND authorization check
  return await Map.findOne({
    mapId: publicMapId,
    $or: [{ members: userId }],
  }).exec();
};

// Checks membership by the map's internal _id (use when you already have the
// Map document, e.g. from a Node's mapId field).
export const isMapMemberDao = async (mapInternalId: unknown, userId: string) => {
  const exists = await Map.exists({ _id: mapInternalId, members: userId });
  return !!exists;
};

// Fetches the full map by its internal _id — for callers that only ever see
// a Node's own mapId ref (e.g. attackAbl, which needs discussionMode) and
// so can't go through the public-id + membership lookup getMapByIdDao does.
export const getMapByInternalIdDao = async (mapInternalId: unknown) => {
  return await Map.findById(mapInternalId);
};

// Realtime broadcasts are addressed by the map's *public* id (Socket.IO
// rooms mirror the room a client actually joined, and a client only ever
// knows the public one) — mutations reached via a node/edge id only carry
// the map's internal ref, so this is how a controller gets from one to the
// other right before emitting.
export const findPublicMapIdDao = async (mapInternalId: unknown): Promise<string | null> => {
  const map = await Map.findById(mapInternalId, "mapId").lean<{ mapId: string } | null>();
  return map?.mapId ?? null;
};

export const getNodesByMapDao = async (publicMapId: string, userId: string) => {
  // Only members of the map may list its nodes; all members see all nodes.
  const map = await Map.findOne({ mapId: publicMapId, members: userId });
  if (!map) return null;

  // parentId/targetNodeId/protectsNodeId/packedIntoNodeId are all internal
  // ObjectId refs — populated with the same public-id projection Edge uses
  // for fromNodeId/toNodeId, so a caller never has to resolve Mongo's
  // internal ids itself. This list used to fall behind nodeDao.ts's own
  // NODE_POPULATE (the create/update/attack/protect/pack responses' shared
  // populate list) whenever a new ref field was added there — protectsNodeId
  // and packedIntoNodeId both came back missing from a fresh page load
  // (present on a freshly-created node's own response, since that goes
  // through NODE_POPULATE, but silently absent again the moment the page
  // reloaded and refetched through this query instead) — breaking
  // protection's shield rendering/positioning and packing's own hidden-node
  // filter for anyone who wasn't looking at a still-live tab. Keep this in
  // sync with NODE_POPULATE by hand; the two aren't shared code since this
  // one is scoped to a whole map's nodes rather than one at a time.
  return await Node.find({ mapId: map._id })
    .populate("userId", "username")
    .populate("parentId", "nodeId text type")
    .populate("targetNodeId", "nodeId text type")
    .populate("protectsNodeId", "nodeId text type")
    .populate("packedIntoNodeId", "nodeId text type");
};

export const createMapDao = async (mapData: {
  name: string;
  ownerId: string;
  ownerColor: string; // the owner's personal color, required up front
  color?: string;
  members?: string[];
  discussionMode?: boolean;
}) => {
  const publicMapId = nanoid(10);
  return await Map.create({
    mapId: publicMapId,
    name: mapData.name,
    ownerId: mapData.ownerId,
    color: mapData.color,
    members: mapData.members ?? [mapData.ownerId],
    memberColors: [{ userId: mapData.ownerId, color: mapData.ownerColor }],
    discussionMode: mapData.discussionMode,
  });
};

// Pure mutation: remove this member's old memberColors entry (if any), add
// the new one. Whether the color is actually available is a business rule,
// not a query concern — decided in abl/mapAbl.ts before this ever runs.
export const setMemberColorMutationDao = async (
  mapInternalId: unknown,
  userId: string,
  color: string,
) => {
  await Map.updateOne({ _id: mapInternalId }, { $pull: { memberColors: { userId } } });
  await Map.updateOne({ _id: mapInternalId }, { $push: { memberColors: { userId, color } } });

  return await Map.findById(mapInternalId);
};

export const updateMapDao = async (
  publicMapId: string,
  userId: string,
  updates: {
    name?: string;
    color?: string;
    parentId?: string | null;
    members?: string[];
    discussionMode?: boolean;
  },
) => {
  return await Map.findOneAndUpdate(
    { mapId: publicMapId, $or: [{ ownerId: userId }] },
    { $set: updates },
    { new: true, runValidators: true },
  );
};

export const inviteUserToMapDao = async (
  publicMapId: string,
  userIdToInvite: string,
  currentUserId: string,
) => {
  const map = await findMapByPublicIdDao(publicMapId);
  if (!map) return null;
  return await Map.findOneAndUpdate(
    {
      _id: map._id,
      ownerId: currentUserId,
    },
    {
      $addToSet: { members: userIdToInvite },
    },
    { new: true },
  ).populate("members", "username email");
};

export const deleteMapDao = async (publicMapId: string, userId: string) => {
  // 1. Find the map AND verify authorization (owner or member) in one query
  const map = await Map.findOne({
    mapId: publicMapId,
    $or: [{ ownerId: userId }],
  });

  if (!map) return null; // Returns null if map doesn't exist OR user lacks permission

  // 2. Delete everything scoped to this map's internal MongoDB _id — edges
  // first, since they reference nodes that are about to disappear too.
  await Edge.deleteMany({ mapId: map._id });
  await Node.deleteMany({ mapId: map._id });

  // 3. Delete the map itself using its internal Mongo _id
  return await Map.findByIdAndDelete(map._id);
};

export const listMapIdsDao = async () => {
  return await Map.find({}, "mapId");
};

export const listMapsByOwnerDao = async (ownerId: string) => {
  return await Map.find({ ownerId });
};

// Strips a user out of every map they're a member (but not owner) of —
// pulls both their `members` entry and their `memberColors` entry in one
// update. Used when an admin deletes a user account; maps they *own* are
// handled separately (deleted, not just membership-pulled).
export const removeUserFromMapsDao = async (userId: string) => {
  await Map.updateMany(
    { members: userId },
    { $pull: { members: userId, memberColors: { userId } } },
  );
};

// Pure mutation — pass null to clear the selection (deselect).
export const setSelectedCircleDao = async (
  mapInternalId: unknown,
  selectedCircle: {
    rootId: string;
    nodeIds: string[];
  } | null,
) => {
  return await Map.findByIdAndUpdate(
    mapInternalId,
    { $set: { selectedCircle } },
    { new: true },
  );
};

export const getMapSummaryDao = async (publicMapId: string, userId: string) => {
  // Same membership check as every other map-read endpoint — a non-member
  // gets the same "not found" as a truly nonexistent map.
  const map = await Map.findOne({ mapId: publicMapId, members: userId }).lean();
  if (!map) {
    return null;
  }

  const [nodeCount, typeCounts] = await Promise.all([
    Node.countDocuments({ mapId: map._id }),
    Node.aggregate<{ _id: NodeType; count: number }>([
      { $match: { mapId: map._id } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
  ]);

  // Every known type gets an entry, zero-filled, not just the ones present —
  // a chart built from this shouldn't have to know the full NODE_TYPES list
  // itself just to render an empty bar for "no Fail nodes yet".
  const nodesByType = Object.fromEntries(NODE_TYPES.map((t) => [t, 0])) as Record<NodeType, number>;
  for (const row of typeCounts) nodesByType[row._id] = row.count;

  // .lean() returns a plain object, so it skips the schema's toJSON
  // transform — strip _id/__v by hand to match every other Map response.
  const { _id, __v, ...publicMap } = map;

  return {
    ...publicMap,
    nodeCount,
    nodesByType,
  };
};
