import { nanoid } from "nanoid";
import mongoose from "mongoose";
import { Image, IMAGE_URL_PREFIX } from "../models/Image.js";
import { fileStorageEnabled, putFile, getFile, deleteFiles } from "../config/fileStorage.js";

type InternalId = mongoose.Types.ObjectId | string;

// Stores one picture's bytes — in the file storage bucket when one is
// configured, otherwise in MongoDB — and returns the address a node keeps.
export const createImageDao = async (fields: {
  mapId: InternalId;
  nodeId: InternalId | null;
  userId: InternalId;
  mime: string;
  data: Buffer;
}): Promise<string> => {
  const imageId = nanoid(16);
  const { data, ...meta } = fields;
  if (fileStorageEnabled()) {
    const storageKey = `images/${imageId}`;
    await putFile(storageKey, data, meta.mime);
    await Image.create({ imageId, ...meta, storageKey });
  } else {
    await Image.create({ imageId, ...meta, data });
  }
  return IMAGE_URL_PREFIX + imageId;
};

// The node a stored picture belongs to, or null — checked before its bytes
// are read (see imageAbl.ts).
export const findImageDao = async (imageId: string) => {
  return await Image.findOne({ imageId }, "mime nodeId mapId storageKey").lean();
};

// A stored picture's bytes, wherever they are kept.
export const readImageDataDao = async (image: { _id: unknown; storageKey?: string | null }): Promise<Buffer> => {
  if (image.storageKey) return await getFile(image.storageKey);
  const doc = await Image.findById(image._id, "data");
  if (!doc?.data) throw new Error("Image has no data");
  return doc.data;
};

// Which of these picture ids are stored for this node — anything else a
// caller sends back as "already stored" is refused (see updateNodeAbl).
export const findNodeImageIdsDao = async (nodeId: InternalId, imageIds: string[]): Promise<Set<string>> => {
  if (imageIds.length === 0) return new Set();
  const rows = await Image.find({ nodeId, imageId: { $in: imageIds } }, "imageId").lean();
  return new Set(rows.map((r) => r.imageId));
};

// Deletes the matching pictures, their files in the bucket included.
const deleteImages = async (filter: Record<string, unknown>) => {
  const withFiles = await Image.find({ ...filter, storageKey: { $ne: null } }, "storageKey").lean();
  await deleteFiles(withFiles.map((r) => r.storageKey as string));
  await Image.deleteMany(filter);
};

// Deletes this node's stored pictures except the ones it still points at.
export const deleteNodeImagesExceptDao = async (nodeId: InternalId, keepImageIds: string[]) => {
  await deleteImages({ nodeId, imageId: { $nin: keepImageIds } });
};

export const deleteImagesByNodesDao = async (nodeIds: InternalId[]) => {
  if (nodeIds.length === 0) return;
  await deleteImages({ nodeId: { $in: nodeIds } });
};

export const deleteImagesByMapDao = async (mapId: InternalId) => {
  await deleteImages({ mapId });
};

// Deletes a map's background pictures (the ones with no node) except the one
// it now shows, if any.
export const deleteMapBackgroundImagesExceptDao = async (mapId: InternalId, keepImageId: string | null) => {
  await deleteImages({ mapId, nodeId: null, ...(keepImageId ? { imageId: { $ne: keepImageId } } : {}) });
};
