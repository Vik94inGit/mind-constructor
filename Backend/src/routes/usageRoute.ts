import { Router } from "express";
import { getUsageSummary, recordUsage } from "../controllers/usageController.js";
import { protect, requireAdmin } from "../middleware/auth.js";

// How the app is used — see abl/usageAbl.ts.
const router = Router();

router.post("/", protect, recordUsage);
router.get("/summary", protect, requireAdmin, getUsageSummary);

export default router;
