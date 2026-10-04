import { Router } from "express";
import {
  createFolder,
  deleteFolder,
  listFolders,
  moveMapToFolder,
  renameFolder,
} from "../controllers/folderController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/", protect, listFolders);
router.post("/", protect, createFolder);
// Body: { folderId } — a folder of the caller's, or null for the top level.
router.patch<{ mapId: string }>("/maps/:mapId", protect, moveMapToFolder);
router.patch<{ folderId: string }>("/:folderId", protect, renameFolder);
router.delete<{ folderId: string }>("/:folderId", protect, deleteFolder);

export default router;
