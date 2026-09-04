import { Router } from "express";
import { createEdge, deleteEdge } from "../controllers/edgeController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.post<{ mapId: string }>("/:mapId", protect, createEdge);
router.delete<{ edgeId: string }>("/:edgeId", protect, deleteEdge);

export default router;
