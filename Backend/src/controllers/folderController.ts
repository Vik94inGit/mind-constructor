import {
  createFolderAbl,
  deleteFolderAbl,
  FolderNotFoundError,
  listFoldersAbl,
  MapNotFoundError,
  moveMapToFolderAbl,
  renameFolderAbl,
} from "../abl/folderAbl.js";
import { authed, type ErrorMapping } from "./errorHandling.js";

const folderNotFound: ErrorMapping = [FolderNotFoundError, 404, "Folder not found"];

export const listFolders = authed(
  "listFolders",
  async (_req, res, userId) => res.status(200).json({ success: true, folders: await listFoldersAbl(userId) }),
  { message: "Failed to load folders" },
);

export const createFolder = authed(
  "createFolder",
  async (req, res, userId) => res.status(201).json({ success: true, folder: await createFolderAbl(req.body, userId) }),
  { message: "Failed to create folder" },
);

export const renameFolder = authed<{ folderId: string }>(
  "renameFolder",
  async (req, res, userId) =>
    res.status(200).json({ success: true, folder: await renameFolderAbl(req.params.folderId, req.body, userId) }),
  { errors: [folderNotFound], message: "Failed to rename folder" },
);

export const deleteFolder = authed<{ folderId: string }>(
  "deleteFolder",
  async (req, res, userId) =>
    res.status(200).json({ success: true, ...(await deleteFolderAbl(req.params.folderId, userId)) }),
  { errors: [folderNotFound], message: "Failed to delete folder" },
);

export const moveMapToFolder = authed<{ mapId: string }>(
  "moveMapToFolder",
  async (req, res, userId) =>
    res.status(200).json({ success: true, ...(await moveMapToFolderAbl(req.params.mapId, req.body, userId)) }),
  { errors: [folderNotFound, [MapNotFoundError, 404, "Map not found"]], message: "Failed to move map" },
);
