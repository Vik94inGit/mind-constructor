import { nanoid } from "nanoid";
import mongoose from "mongoose";
import { Edge, type EdgeSentiment } from "../models/Edge.js";
import { getMapByIdDao } from "./mapsDao.js";

type InternalId = mongoose.Types.ObjectId | string;

export const findEdgeByPublicIdDao = async (publicEdgeId: string) => {
  return await Edge.findOne({ edgeId: publicEdgeId });
};

// Populated the same way getEdgesByMapDao lists edges — otherwise the edge
// handed back right after creation looks different (raw internal ObjectIds
// instead of { nodeId, text, type }) than one read back from a fresh page
// load, and the line it should draw silently fails to render until reload.
export const createEdgeMutationDao = async (edgeData: {
  mapId: InternalId;
  fromNodeId: InternalId;
  toNodeId: InternalId;
  sentiment?: EdgeSentiment;
  userId: string;
}) => {
  const edge = await Edge.create({
    edgeId: nanoid(10),
    ...edgeData,
  });
  return edge.populate([
    { path: "fromNodeId", select: "nodeId text type" },
    { path: "toNodeId", select: "nodeId text type" },
    { path: "userId", select: "username" },
  ]);
};

// Only the edge's creator may delete it — same pattern as node ownership.
export const deleteEdgeDao = async (publicEdgeId: string, userId: string) => {
  return await Edge.findOneAndDelete({ edgeId: publicEdgeId, userId });
};

export const findEdgesByMapInternalIdDao = async (mapInternalId: InternalId) => {
  return await Edge.find({ mapId: mapInternalId }).lean();
};

// Only members of the map may list its edges — same membership pattern as
// getNodesByMapDao. Populated with public node ids so a caller never has to
// see Mongo's internal ones.
export const getEdgesByMapDao = async (publicMapId: string, userId: string) => {
  const map = await getMapByIdDao(publicMapId, userId);
  if (!map) return null;

  return await Edge.find({ mapId: map._id })
    .populate("fromNodeId", "nodeId text type")
    .populate("toNodeId", "nodeId text type")
    .populate("userId", "username");
};

// One row per node that receives at least one edge of the given sentiment,
// with how many it received. Used for the attack-indicator threshold check
// — grouping/counting is still "just a query", so it stays in the DAO; what
// counts as "enough" to show an indicator is decided in the ABL layer.
export const countIncomingEdgesByTargetDao = async (
  mapInternalId: InternalId,
  sentiment: EdgeSentiment,
) => {
  return await Edge.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { mapId: mapInternalId, sentiment } },
    { $group: { _id: "$toNodeId", count: { $sum: 1 } } },
  ]);
};
