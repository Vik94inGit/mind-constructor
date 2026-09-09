// routes/nodeRoutes.ts
import { Router } from "express";
import {
  getNodeById,
  createNode,
  updateNode,
  deleteNode,
  attackNode,
  getNodeAttackHistory,
  protectNode,
  packNode,
  unpackNode,
} from "../controllers/nodeController.js";
import { protect } from "#src/middleware/auth.js";

const router = Router();
router.post<{ mapId: string }>("/:mapId", protect, createNode);
router.get<{ nodeId: string }>("/:nodeId", protect, getNodeById);

router.patch<{ nodeId: string }>("/:nodeId", protect, updateNode);
router.delete<{ nodeId: string }>("/:nodeId", protect, deleteNode);

router.post<{ nodeId: string }>("/:nodeId/attack", protect, attackNode);
router.get<{ nodeId: string }>("/:nodeId/attacks", protect, getNodeAttackHistory);
router.post<{ nodeId: string }>("/:nodeId/protect", protect, protectNode);
router.post<{ nodeId: string }>("/:nodeId/pack", protect, packNode);
router.post<{ nodeId: string }>("/:nodeId/unpack", protect, unpackNode);

export default router;
