import { Router } from "express";
import { protect, requireAdmin } from "../middleware/auth.js";
import { listAdminUsers, deleteUnusedUsers, listAllMaps, adminDeleteMap } from "../controllers/adminController.js";

// Admin-only clean-up — see abl/adminAbl.ts. Mounted at /api/admin, before
// the map routes' catch-all /api/:mapId.
const router = Router();
router.use(protect, requireAdmin);
router.get("/users", listAdminUsers);
router.post("/users/delete-unused", deleteUnusedUsers);
router.get("/maps", listAllMaps);
router.delete<{ mapId: string }>("/maps/:mapId", adminDeleteMap);

export default router;
