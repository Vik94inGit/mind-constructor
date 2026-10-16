// routes/mapRoutes.ts
import { Router } from "express";
import {
  createMap,
  inviteUserToMap,
  getAllMaps,
  searchNodes,
  getMapSummary,
  getNodesByMap,
  getNodesText,
  getMapById,
  updateMap,
  deleteMap,
  setMyMapColor,
  getEdgesByMap,
  getMapAttackIndicators,
  selectMapCircle,
  deselectMapCircle,
} from "../controllers/mapController.js";
import { getLinesByMap } from "../controllers/lineController.js";
import { agreeToFinish, finishMap, getFinishStatus, getMapAttacks, reopenMap } from "../controllers/finishController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// Protected routes
router.post("/", protect, createMap);
router.get("/", protect, getAllMaps);
// Before "/:mapId", so "search" isn't read as a map id.
router.get("/search", protect, searchNodes);

router.patch("/:mapId", protect, updateMap);
router.get("/:mapId", protect, getMapById);
router.delete("/:mapId", protect, deleteMap);

router.post("/:mapId/invite", protect, inviteUserToMap);
router.patch("/:mapId/color", protect, setMyMapColor);
router.get("/:mapId/summary", protect, getMapSummary);
router.get("/:mapId/nodes", protect, getNodesByMap);
router.post("/:mapId/nodes/text", protect, getNodesText);
router.get("/:mapId/edges", protect, getEdgesByMap);
router.get("/:mapId/lines", protect, getLinesByMap);
router.post("/:mapId/circles/select", protect, selectMapCircle);
router.post("/:mapId/circles/deselect", protect, deselectMapCircle);
router.get("/:mapId/attack-indicators", protect, getMapAttackIndicators);
// Ending the discussion, and its fight for the replay — see abl/finishAbl.ts.
router.get("/:mapId/finish", protect, getFinishStatus);
router.post("/:mapId/finish", protect, finishMap);
router.post("/:mapId/finish/agree", protect, agreeToFinish);
router.post("/:mapId/reopen", protect, reopenMap);
router.get("/:mapId/attacks", protect, getMapAttacks);

export default router;
