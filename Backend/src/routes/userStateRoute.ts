import { Router } from "express";
import {
  deleteDraft,
  getDraft,
  getMapViewState,
  getUserState,
  saveDraft,
  updateMapViewState,
  updatePreferences,
} from "../controllers/userStateController.js";
import { protect } from "../middleware/auth.js";

// The signed-in user's own state, so they can pick up on any device where
// they left off — see models/UserState.ts.
const router = Router();

router.get("/", protect, getUserState);
router.patch("/preferences", protect, updatePreferences);
router.get<{ mapId: string }>("/maps/:mapId", protect, getMapViewState);
router.patch<{ mapId: string }>("/maps/:mapId", protect, updateMapViewState);
router.get<{ kind: string }>("/drafts/:kind", protect, getDraft);
router.patch<{ kind: string }>("/drafts/:kind", protect, saveDraft);
router.delete<{ kind: string }>("/drafts/:kind", protect, deleteDraft);

export default router;
