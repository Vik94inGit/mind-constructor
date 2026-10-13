import { Router } from "express";
import {
  register,
  login,
  googleAuth,
  demoAuth,
  logout,
  me,
  updateMyUsername,
  socketToken,
} from "../controllers/authController.js";
import { protect, requireAdmin } from "../middleware/auth.js";
import {
  getAllUsers,
  searchUsers,
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
// Pick your own username (or keep the one picked for you) — see
// authAbl.ts's setUsernameAbl.
router.patch("/me/username", protect, updateMyUsername);
// A short-lived token the frontend hands to the Socket.IO handshake, which
// can't count on the session cookie — see realtime/socketToken.ts.
router.get("/socket-token", protect, socketToken);

// Find someone to invite to a map, by username or exact email — see
// userAbl.ts's searchUsersAbl. Any signed-in user; results carry no emails.
router.get("/users/search", protect, searchUsers);
// The full user list (with emails) and everything below is admin-only.
router.get("/users", protect, requireAdmin, getAllUsers);
router.delete("/users", protect, requireAdmin, deleteAll);
router.delete<{ id: string }>("/users/:id", protect, requireAdmin, deleteUser);
router.patch<{ id: string }>("/users/:id/block", protect, requireAdmin, blockUser);
router.patch<{ id: string }>("/users/:id/unblock", protect, requireAdmin, unblockUser);

export default router;
