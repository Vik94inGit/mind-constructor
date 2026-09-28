import { Router } from "express";
import { register, login, googleAuth, demoAuth, logout, me } from "../controllers/authController.js";
import { protect, requireAdmin } from "../middleware/auth.js";
import {
  getAllUsers,
  deleteAll,
  deleteUser,
  blockUser,
  unblockUser,
} from "../controllers/userController.js";
const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);
router.post("/demo", demoAuth);
router.post("/logout", logout);
// Who the current session cookie belongs to — see authController.ts's own
// doc comment on `me`.
router.get("/me", protect, me);

// Any signed-in user can list users — needed to look up an id to invite to
// a map. Everything below is admin-only.
router.get("/users", protect, getAllUsers);
router.delete("/users", protect, requireAdmin, deleteAll);
router.delete<{ id: string }>("/users/:id", protect, requireAdmin, deleteUser);
router.patch<{ id: string }>("/users/:id/block", protect, requireAdmin, blockUser);
router.patch<{ id: string }>("/users/:id/unblock", protect, requireAdmin, unblockUser);

export default router;
