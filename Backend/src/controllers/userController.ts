import { deleteAllDao, getAllUsersDao } from "../dao/userDao.js";
import {
  blockUserAbl,
  unblockUserAbl,
  adminDeleteUserAbl,
  searchUsersAbl,
  CannotActOnSelfError,
  UserNotFoundError,
} from "../abl/userAbl.js";
import { authed, type ErrorMapping } from "./errorHandling.js";

type IdParams = { id: string };

const userNotFound: ErrorMapping = [UserNotFoundError, 404, "User not found"];
const adminErrors: ErrorMapping[] = [[CannotActOnSelfError, 400, (e) => ({ error: e.message })], userNotFound];

// Strips passwordHash before sending a user back to the client.
export function toPublicUser(user: any) {
  if (!user) return user;
  const { passwordHash, ...publicUser } = user.toObject ? user.toObject() : user;
  return publicUser;
}

export const getAllUsers = authed("getAllUsers", async (_req, res) => {
  const result = await getAllUsersDao();
  const users = Array.isArray(result) ? result : [];
  return res.status(200).json(users.map(toPublicUser));
});

// GET /api/auth/users/search?q=ali&mapId=abc — see searchUsersAbl.
export const searchUsers = authed("searchUsers", async (req, res, userId) => {
  const users = await searchUsersAbl(userId, req.query);
  return res.status(200).json({ success: true, users });
});

// ========== ADMIN: DELETE A USER ==========
// Cascades: deletes every map they own (and, via that, its nodes) and pulls
// them out of every other map's membership. See abl/userAbl.ts for the
// full breakdown, including what's deliberately left untouched.
// Every admin route requires `protect` + `requireAdmin`.
export const deleteUser = authed<IdParams>(
  "deleteUser",
  async (req, res, adminId) => res.status(200).json({ success: true, ...(await adminDeleteUserAbl(req.params.id, adminId)) }),
  { errors: adminErrors },
);

// ========== ADMIN: BLOCK / UNBLOCK A USER ==========
// A blocked user is rejected by `protect` on their very next request —
// unlike logout, this doesn't need to wait for their token to expire,
// because `protect` already re-checks the database on every call.
export const blockUser = authed<IdParams>(
  "blockUser",
  async (req, res, adminId) =>
    res.status(200).json({ success: true, user: toPublicUser(await blockUserAbl(req.params.id, adminId)) }),
  { errors: adminErrors },
);

export const unblockUser = authed<IdParams>(
  "unblockUser",
  async (req, res) => res.status(200).json({ success: true, user: toPublicUser(await unblockUserAbl(req.params.id)) }),
  { errors: [userNotFound] },
);

export const deleteAll = authed("deleteAllUsers", async (_req, res) => {
  await deleteAllDao();
  return res.status(200).json({ success: true, message: "All users deleted" });
});
