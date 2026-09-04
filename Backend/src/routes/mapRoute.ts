// routes/mapRoutes.ts
import { Router } from "express";
import {
  createMap,
  inviteUserToMap,
  getAllMaps,
  getMapSummary,
  getNodesByMap,
  getMapById,
  updateMap,
  deleteMap,
  setMyMapColor,
  getEdgesByMap,
  getMapAttackIndicators,
  selectMapCircle,
  deselectMapCircle,
} from "../controllers/mapController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// Protected routes
router.post("/", protect, createMap);
router.get("/", protect, getAllMaps);

router.patch("/:mapId", protect, updateMap);
router.get("/:mapId", protect, getMapById);
router.delete("/:mapId", protect, deleteMap);

router.post("/:mapId/invite", protect, inviteUserToMap);
router.patch("/:mapId/color", protect, setMyMapColor);
router.get("/:mapId/summary", protect, getMapSummary);
router.get("/:mapId/nodes", protect, getNodesByMap);
router.get("/:mapId/edges", protect, getEdgesByMap);
router.post("/:mapId/circles/select", protect, selectMapCircle);
router.post("/:mapId/circles/deselect", protect, deselectMapCircle);
router.get("/:mapId/attack-indicators", protect, getMapAttackIndicators);

export default router;
