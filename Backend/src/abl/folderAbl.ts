import { z } from "zod";
import { MAX_FOLDER_NAME } from "../models/Folder.js";
import { getMapByIdDao } from "../dao/mapsDao.js";
import {
  createFolderDao,
  deleteFolderDao,
  listFoldersDao,
  moveMapToFolderDao,
  renameFolderDao,
} from "../dao/folderDao.js";
import { parseOrThrow } from "./errors.js";

export class FolderNotFoundError extends Error {}
export class MapNotFoundError extends Error {}

const nameSchema = z.object({
  name: z
    .string({ message: "name is required" })
    .trim()
    .min(1, "name is required")
    .max(MAX_FOLDER_NAME, `name can be at most ${MAX_FOLDER_NAME} characters`),
});

const moveSchema = z.object({
  folderId: z.string().min(1).nullable(),
});

export const listFoldersAbl = async (userId: string) => {
  return await listFoldersDao(userId);
};

export const createFolderAbl = async (input: unknown, userId: string) => {
  const { name } = parseOrThrow(nameSchema, input);
  return await createFolderDao(userId, name);
};

export const renameFolderAbl = async (folderId: string, input: unknown, userId: string) => {
  const { name } = parseOrThrow(nameSchema, input);
  const folder = await renameFolderDao(folderId, userId, name);
  if (!folder) throw new FolderNotFoundError();
  return folder;
};

// The folder goes; its maps stay, back at the top level.
export const deleteFolderAbl = async (folderId: string, userId: string) => {
  const folder = await deleteFolderDao(folderId, userId);
  if (!folder) throw new FolderNotFoundError();
  return { folderId };
};

// Any map the user can open (owned or shared) can go in one of their folders.
export const moveMapToFolderAbl = async (mapId: string, input: unknown, userId: string) => {
  const { folderId } = parseOrThrow(moveSchema, input);
  const map = await getMapByIdDao(mapId, userId);
  if (!map) throw new MapNotFoundError();
  const moved = await moveMapToFolderDao(mapId, userId, folderId);
  if (!moved) throw new FolderNotFoundError();
  return { mapId, folderId };
};
