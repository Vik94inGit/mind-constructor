// Business logic for admin actions on users. Controllers stay thin (parse
// the request, call one of these, map the result to a status code); DAOs
// stay thin (one query each). This is the layer that decides *what should
// happen*, including anything that spans more than one collection.

import { z } from "zod";
import {
  findUserByIdDao,
  deleteUserDao,
  setUserBlockedDao,
  searchUsersDao,
} from "../dao/userDao.js";
import {
  listMapsByOwnerDao,
  deleteMapDao,
  removeUserFromMapsDao,
  getMapByIdDao,
} from "../dao/mapsDao.js";
import { deleteManyNodesDao } from "../dao/nodeDao.js";
import { deleteUserContentDao, listNodeIdsByUserDao } from "../dao/userContentDao.js";
import { parseOrThrow } from "./errors.js";

export class CannotActOnSelfError extends Error {}
export class UserNotFoundError extends Error {}

export const blockUserAbl = async (targetUserId: string, adminId: string) => {
  if (targetUserId === adminId) {
    throw new CannotActOnSelfError("You can't block your own account");
  }

  const user = await setUserBlockedDao(targetUserId, true);
  if (!user) throw new UserNotFoundError();
  return user;
};

export const unblockUserAbl = async (targetUserId: string) => {
  const user = await setUserBlockedDao(targetUserId, false);
  if (!user) throw new UserNotFoundError();
  return user;
};

export const adminDeleteUserAbl = async (targetUserId: string, adminId: string) => {
  if (targetUserId === adminId) {
    throw new CannotActOnSelfError("You can't delete your own account");
  }

  const user = await findUserByIdDao(targetUserId);
  if (!user) throw new UserNotFoundError();

  // 1. Delete every map this user owns — deleteMapDao already cascades to
  //    that map's nodes, so this covers both in one call per map.
  const ownedMaps = await listMapsByOwnerDao(targetUserId);
  for (const map of ownedMaps) {
    await deleteMapDao(map.mapId, targetUserId);
  }

  // 2. Delete every node they added to someone else's map, one by one so
  //    each node's own cascade runs (its links, children's parent link,
  //    protection, packing — see nodeDao.ts cascadeAfterNodeDeleted).
  const nodeIds = await listNodeIdsByUserDao(targetUserId);
  const deletedNodes = nodeIds.length > 0 ? (await deleteManyNodesDao(nodeIds, targetUserId)).length : 0;

  // 3. Everything else of theirs: links, lines, attacks, history entries,
  //    pictures, folders, saved state, drafts and usage events.
  await deleteUserContentDao(targetUserId);

  // 4. Remove them from every other map they were a member of.
  await removeUserFromMapsDao(targetUserId);

  // 5. Delete the account itself.
  await deleteUserDao(targetUserId);

  return { deletedUserId: targetUserId, deletedOwnedMaps: ownedMaps.length, deletedNodes };
};

const searchUsersSchema = z.object({
  q: z.string().trim().max(64).default(""),
  mapId: z.string().optional(),
});

const SEARCH_LIMIT = 10;

// The invite box's search. Never returns the caller themselves, and, given
// a map they're on, none of its current members either — so every result is
// someone who can actually still be invited. Under 2 characters returns
// nothing rather than paging through every account.
export const searchUsersAbl = async (currentUserId: string, input: unknown) => {
  const { q, mapId } = parseOrThrow(searchUsersSchema, input);
  if (q.length < 2) return [];

  const exclude = [currentUserId.toString()];
  if (mapId) {
    const map = await getMapByIdDao(mapId, currentUserId);
    if (map) exclude.push(...map.members.map((m: unknown) => String(m)));
  }
  return await searchUsersDao(q, exclude, SEARCH_LIMIT);
};
