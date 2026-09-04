// Business logic for admin actions on users. Controllers stay thin (parse
// the request, call one of these, map the result to a status code); DAOs
// stay thin (one query each). This is the layer that decides *what should
// happen*, including anything that spans more than one collection.

import {
  findUserByIdDao,
  deleteUserDao,
  setUserBlockedDao,
} from "../dao/userDao.js";
import {
  listMapsByOwnerDao,
  deleteMapDao,
  removeUserFromMapsDao,
} from "../dao/mapsDao.js";

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

  // 2. Remove them from every other map they were just a member of.
  await removeUserFromMapsDao(targetUserId);

  // 3. Delete the account itself.
  //    NOTE: nodes this user created on maps they *don't* own are
  //    deliberately left as-is — deleting someone else's shared discussion
  //    because one contributor was removed would be more destructive than
  //    helpful. Their `userId` reference on those nodes becomes dangling;
  //    `.populate("userId", "username")` will resolve it to `null`.
  await deleteUserDao(targetUserId);

  return { deletedUserId: targetUserId, deletedOwnedMaps: ownedMaps.length };
};
