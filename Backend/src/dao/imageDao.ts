import { nanoid } from "nanoid";
import mongoose from "mongoose";
import { Image, IMAGE_URL_PREFIX } from "../models/Image.js";

type InternalId = mongoose.Types.ObjectId | string;

// Stores one picture's bytes and returns the address a node keeps instead.
export const createImageDao = async (fields: {
  mapId: InternalId;
  nodeId: InternalId;
  userId: InternalId;
  mime: string;
  data: Buffer;
}): Promise<string> => {
  const imageId = nanoid(16);
  await Image.create({ imageId, ...fields });
  return IMAGE_URL_PREFIX + imageId;
};

// The bytes and owner node of one stored picture, or null.
export const findImageDao = async (imageId: string) => {
  return await Image.findOne({ imageId }, "mime data nodeId mapId");
};

// Which of these picture ids are stored for this node — anything else a
// caller sends back as "already stored" is refused (see updateNodeAbl).
export const findNodeImageIdsDao = async (nodeId: InternalId, imageIds: string[]): Promise<Set<string>> => {
  if (imageIds.length === 0) return new Set();
  const rows = await Image.find({ nodeId, imageId: { $in: imageIds } }, "imageId").lean();
  return new Set(rows.map((r) => r.imageId));
};

// Deletes this node's stored pictures except the ones it still points at.
export const deleteNodeImagesExceptDao = async (nodeId: InternalId, keepImageIds: string[]) => {
  await Image.deleteMany({ nodeId, imageId: { $nin: keepImageIds } });
};

export const deleteImagesByNodesDao = async (nodeIds: InternalId[]) => {
  if (nodeIds.length === 0) return;
  await Image.deleteMany({ nodeId: { $in: nodeIds } });
};

export const deleteImagesByMapDao = async (mapId: InternalId) => {
  await Image.deleteMany({ mapId });
};
