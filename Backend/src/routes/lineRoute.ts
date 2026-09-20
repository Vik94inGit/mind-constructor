import { Router } from "express";
import { createLine, deleteLine } from "../controllers/lineController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.post<{ mapId: string }>("/:mapId", protect, createLine);
router.delete<{ lineId: string }>("/:lineId", protect, deleteLine);

export default router;
