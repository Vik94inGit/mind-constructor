import { Request, Response } from "express";
import {
  createFolderAbl,
  deleteFolderAbl,
  FolderNotFoundError,
  listFoldersAbl,
  MapNotFoundError,
  moveMapToFolderAbl,
  renameFolderAbl,
} from "../abl/folderAbl.js";
import { handleAblError } from "./errorHandling.js";

const folderNotFound: [typeof FolderNotFoundError, number, string] = [FolderNotFoundError, 404, "Folder not found"];

export const listFolders = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    const folders = await listFoldersAbl(userId);
    return res.status(200).json({ success: true, folders });
  } catch (error) {
    return handleAblError(res, error, [], { message: "Failed to load folders", logLabel: "listFolders" });
  }
};

export const createFolder = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    const folder = await createFolderAbl(req.body, userId);
    return res.status(201).json({ success: true, folder });
  } catch (error) {
    return handleAblError(res, error, [], { message: "Failed to create folder", logLabel: "createFolder" });
  }
};

export const renameFolder = async (req: Request<{ folderId: string }>, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    const folder = await renameFolderAbl(req.params.folderId, req.body, userId);
    return res.status(200).json({ success: true, folder });
  } catch (error) {
    return handleAblError(res, error, [folderNotFound], { message: "Failed to rename folder", logLabel: "renameFolder" });
  }
};

export const deleteFolder = async (req: Request<{ folderId: string }>, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    const result = await deleteFolderAbl(req.params.folderId, userId);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleAblError(res, error, [folderNotFound], { message: "Failed to delete folder", logLabel: "deleteFolder" });
  }
};

export const moveMapToFolder = async (req: Request<{ mapId: string }>, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
    const result = await moveMapToFolderAbl(req.params.mapId, req.body, userId);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleAblError(res, error, [folderNotFound, [MapNotFoundError, 404, "Map not found"]], {
      message: "Failed to move map",
      logLabel: "moveMapToFolder",
    });
  }
};
