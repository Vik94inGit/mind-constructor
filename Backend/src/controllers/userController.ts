import { Request, Response } from "express";
import {
  createUserDao,
  findUserByIdDao,
  findUserByEmailDao,
  updateUserDao,
  deleteAllDao,
  getAllUsersDao,
} from "../dao/userDao.js";
import {
  blockUserAbl,
  unblockUserAbl,
  adminDeleteUserAbl,
  CannotActOnSelfError,
  UserNotFoundError,
} from "../abl/userAbl.js";
import { handleAblError } from "./errorHandling.js";

interface idParams {
  id: string;
}

// Strips passwordHash before sending a user back to the client.
function toPublicUser(user: any) {
  if (!user) return user;
  const { passwordHash, ...publicUser } = user.toObject
    ? user.toObject()
    : user;
  return publicUser;
}

export const createUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "username, email and password are required",
      });
    }

    const existing = await findUserByEmailDao(email);
    if (existing) {
      return res
        .status(409)
        .json({ success: false, error: "Email already in use" });
    }

    const user = await createUserDao({ username, email, password });

    return res.status(201).json(toPublicUser(user));
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "createUser",
    });
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const result = await getAllUsersDao();
    const users = Array.isArray(result) ? result : [];
    return res.status(200).json(users.map(toPublicUser));
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "getAllUsers",
    });
  }
};

export const getUserById = async (req: Request<idParams>, res: Response) => {
  try {
    const { id } = req.params;
    const user = await findUserByIdDao(id);

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    return res.status(200).json(toPublicUser(user));
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "getUserById",
    });
  }
};

export const updateUser = async (req: Request<idParams>, res: Response) => {
  try {
    const { id } = req.params;
    const { username, email, password } = req.body;

    const updates = Object.fromEntries(
      Object.entries({ username, email, password }).filter(
        ([, v]) => v !== undefined,
      ),
    );

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "No fields to update" });
    }

    const user = await updateUserDao(id, updates);

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    return res.status(200).json(toPublicUser(user));
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "updateUser",
    });
  }
};

// ========== ADMIN: DELETE A USER ==========
// Cascades: deletes every map they own (and, via that, its nodes) and pulls
// them out of every other map's membership. See abl/userAbl.ts for the
// full breakdown, including what's deliberately left untouched.
export const deleteUser = async (req: Request<idParams>, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = req.user!._id; // route requires `protect` + `requireAdmin`

    const result = await adminDeleteUserAbl(id, adminId);

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleAblError(
      res,
      error,
      [
        [CannotActOnSelfError, 400, (e) => ({ error: e.message })],
        [UserNotFoundError, 404, "User not found"],
      ],
      { message: "Internal Server Error", logLabel: "deleteUser" },
    );
  }
};

// ========== ADMIN: BLOCK / UNBLOCK A USER ==========
// A blocked user is rejected by `protect` on their very next request —
// unlike logout, this doesn't need to wait for their token to expire,
// because `protect` already re-checks the database on every call.
export const blockUser = async (req: Request<idParams>, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = req.user!._id;

    const user = await blockUserAbl(id, adminId);

    return res.status(200).json({ success: true, user: toPublicUser(user) });
  } catch (error) {
    return handleAblError(
      res,
      error,
      [
        [CannotActOnSelfError, 400, (e) => ({ error: e.message })],
        [UserNotFoundError, 404, "User not found"],
      ],
      { message: "Internal Server Error", logLabel: "blockUser" },
    );
  }
};

export const unblockUser = async (req: Request<idParams>, res: Response) => {
  try {
    const { id } = req.params;

    const user = await unblockUserAbl(id);

    return res.status(200).json({ success: true, user: toPublicUser(user) });
  } catch (error) {
    return handleAblError(res, error, [[UserNotFoundError, 404, "User not found"]], {
      message: "Internal Server Error",
      logLabel: "unblockUser",
    });
  }
};

export const deleteAll = async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user?._id;
    console.log("Current user ID:", currentUserId);
    if (!currentUserId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }
    await deleteAllDao();
    return res
      .status(200)
      .json({ success: true, message: "All users deleted" });
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "deleteAllUsers",
    });
  }
};
