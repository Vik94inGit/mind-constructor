// The admin page's clean-up: telling unused accounts apart, deleting them in
// one go, and listing / deleting any map whoever owns it. Every route that
// reaches this runs `protect` + `requireAdmin` first.

import mongoose from "mongoose";
import { z } from "zod";
import { getAllUsersDao } from "../dao/userDao.js";
import { listUserActivityDao, listAllMapsDao, type UserActivityRow } from "../dao/adminDao.js";
import { adminDeleteMapDao } from "../dao/mapsDao.js";
import { adminDeleteUserAbl } from "./userAbl.js";
import { parseOrThrow } from "./errors.js";

export class AdminMapNotFoundError extends Error {}

// How long an account has to sit untouched before it can count as unused,
// so someone who signed up today and hasn't written yet is never swept.
export const UNUSED_IDLE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// When the account was made: User has no timestamps, but its ObjectId does.
export const createdAtOf = (id: unknown): Date | null => {
  const s = String(id);
  return mongoose.Types.ObjectId.isValid(s) && /^[0-9a-f]{24}$/i.test(s)
    ? new mongoose.Types.ObjectId(s).getTimestamp()
    : null;
};

// An unused profile: not an admin, never wrote a single thought on any map
// (untouched starter ghosts don't count), and no sign of life — no use of the
// app, no change to a node or map of theirs, not even signing up — for
// UNUSED_IDLE_DAYS.
export const isUnusedProfile = (
  user: { _id: unknown; role?: string },
  activity: Pick<UserActivityRow, "writtenNodes" | "lastActiveAt"> | undefined,
  now: Date,
): boolean => {
  if (user.role === "admin") return false;
  if ((activity?.writtenNodes ?? 0) > 0) return false;
  const created = createdAtOf(user._id);
  const last = [activity?.lastActiveAt ?? null, created].reduce<Date | null>(
    (best, d) => (d && (!best || d > best) ? d : best),
    null,
  );
  if (!last) return true;
  return now.getTime() - new Date(last).getTime() >= UNUSED_IDLE_DAYS * DAY_MS;
};

// Every account, with how much it's used and whether it counts as unused.
export const listAdminUsersAbl = async (now = new Date()) => {
  const users = (await getAllUsersDao()) as { _id: unknown; role?: string; [k: string]: unknown }[];
  const activity = await listUserActivityDao(users.map((u) => String(u._id)));
  const byId: Record<string, UserActivityRow> = {};
  for (const a of activity) byId[a.userId] = a;
  return users.map((u) => {
    const { passwordHash: _p, __v: _v, ...rest } = u as Record<string, unknown>;
    const a = byId[String(u._id)];
    return {
      ...rest,
      _id: String(u._id),
      createdAt: createdAtOf(u._id),
      ownedMaps: a?.ownedMaps ?? 0,
      writtenNodes: a?.writtenNodes ?? 0,
      lastActiveAt: a?.lastActiveAt ?? null,
      unused: isUnusedProfile(u, a, now),
    };
  });
};

const deleteUnusedSchema = z.object({
  userIds: z.array(z.string().min(1).max(64)).min(1).max(1000),
});

// Deletes the accounts the admin confirmed, but only those that still count
// as unused when the request lands (one may have written something since the
// list was loaded) — those are skipped, never deleted.
export const deleteUnusedUsersAbl = async (adminId: string, input: unknown, now = new Date()) => {
  const { userIds } = parseOrThrow(deleteUnusedSchema, input);
  const wanted = new Set(userIds);
  const users = await listAdminUsersAbl(now);
  const deleted: string[] = [];
  const skipped: string[] = [];
  for (const id of wanted) {
    const u = users.find((x) => String(x._id) === id);
    if (!u || !u.unused || id === String(adminId)) {
      skipped.push(id);
      continue;
    }
    await adminDeleteUserAbl(id, adminId);
    deleted.push(id);
  }
  return { deleted, skipped };
};

export const listAllMapsAbl = async () => await listAllMapsDao();

export const adminDeleteMapAbl = async (mapId: string) => {
  const result = await adminDeleteMapDao(mapId);
  if (!result) throw new AdminMapNotFoundError();
  return { deletedMapId: mapId };
};
