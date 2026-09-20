import { nanoid } from "nanoid";
import mongoose from "mongoose";
import { Line } from "../models/Line.js";
import { getMapByIdDao } from "./mapsDao.js";

type InternalId = mongoose.Types.ObjectId | string;

export const createLineMutationDao = async (lineData: {
  mapId: InternalId;
  userId: string;
  points: { x: number; y: number }[];
}) => {
  const line = await Line.create({ lineId: nanoid(10), ...lineData });
  return line.populate("userId", "username");
};

// Only members of the map may list its lines — same membership pattern as
// getEdgesByMapDao.
export const getLinesByMapDao = async (publicMapId: string, userId: string) => {
  const map = await getMapByIdDao(publicMapId, userId);
  if (!map) return null;
  return await Line.find({ mapId: map._id }).populate("userId", "username");
};

// The line with its map's public id and owner attached (populated mapId), so
// the caller can decide who may delete it and which room to broadcast to
// without further lookups.
export const findLineByPublicIdDao = async (publicLineId: string) => {
  return await Line.findOne({ lineId: publicLineId }).populate("mapId", "mapId ownerId");
};

export const deleteLineByIdDao = async (lineInternalId: InternalId) => {
  return await Line.findByIdAndDelete(lineInternalId);
};
