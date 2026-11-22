import {
  listAdminUsersAbl,
  deleteUnusedUsersAbl,
  listAllMapsAbl,
  adminDeleteMapAbl,
  AdminMapNotFoundError,
} from "../abl/adminAbl.js";
import { authed, param } from "./errorHandling.js";

// GET /api/admin/users — every account with its usage and an `unused` flag.
export const listAdminUsers = authed("listAdminUsers", async (_req, res) =>
  res.status(200).json({ success: true, users: await listAdminUsersAbl() }),
);

// POST /api/admin/users/delete-unused { userIds } — see deleteUnusedUsersAbl.
export const deleteUnusedUsers = authed("deleteUnusedUsers", async (req, res, adminId) =>
  res.status(200).json({ success: true, ...(await deleteUnusedUsersAbl(adminId, req.body)) }),
);

// GET /api/admin/maps — every map, whoever owns it.
export const listAllMaps = authed("listAllMaps", async (_req, res) =>
  res.status(200).json({ success: true, maps: await listAllMapsAbl() }),
);

// DELETE /api/admin/maps/:mapId — any map, with all its nodes, links and history.
export const adminDeleteMap = authed(
  "adminDeleteMap",
  async (req, res) => res.status(200).json({ success: true, ...(await adminDeleteMapAbl(param(req, "mapId"))) }),
  { errors: [[AdminMapNotFoundError, 404, "Map not found"]] },
);
