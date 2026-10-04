import { nanoid } from "nanoid";
import { Folder } from "../models/Folder.js";

export const listFoldersDao = async (userId: string) => {
  return await Folder.find({ ownerId: userId }).sort({ name: 1 });
};

export const createFolderDao = async (userId: string, name: string) => {
  return await Folder.create({ folderId: nanoid(10), ownerId: userId, name });
};

// null when the folder doesn't exist or isn't this user's.
export const renameFolderDao = async (folderId: string, userId: string, name: string) => {
  return await Folder.findOneAndUpdate({ folderId, ownerId: userId }, { name }, { new: true });
};

export const deleteFolderDao = async (folderId: string, userId: string) => {
  return await Folder.findOneAndDelete({ folderId, ownerId: userId });
};

// Puts a map in one of the user's folders (null: back to the top level),
// taking it out of whichever other folder of theirs held it. Returns false
// when the target folder doesn't exist or isn't this user's.
export const moveMapToFolderDao = async (mapId: string, userId: string, folderId: string | null) => {
  if (folderId) {
    const target = await Folder.exists({ folderId, ownerId: userId });
    if (!target) return false;
  }
  await Folder.updateMany({ ownerId: userId, mapIds: mapId }, { $pull: { mapIds: mapId } });
  if (folderId) await Folder.updateOne({ folderId, ownerId: userId }, { $addToSet: { mapIds: mapId } });
  return true;
};

// A deleted map leaves every folder, whoever's it was.
export const removeMapFromAllFoldersDao = async (mapId: string) => {
  await Folder.updateMany({ mapIds: mapId }, { $pull: { mapIds: mapId } });
};
