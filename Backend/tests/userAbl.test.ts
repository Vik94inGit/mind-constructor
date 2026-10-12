import { describe, beforeEach, it, expect, vi } from "vitest";
import {
  findUserByIdDao,
  deleteUserDao,
  setUserBlockedDao,
  searchUsersDao,
} from "../src/dao/userDao.js";
import {
  listMapsByOwnerDao,
  deleteMapDao,
  removeUserFromMapsDao,
  getMapByIdDao,
} from "../src/dao/mapsDao.js";
import {
  blockUserAbl,
  unblockUserAbl,
  adminDeleteUserAbl,
  searchUsersAbl,
  CannotActOnSelfError,
  UserNotFoundError,
} from "../src/abl/userAbl.js";

vi.mock("../src/dao/userDao.js", () => ({
  findUserByIdDao: vi.fn(),
  deleteUserDao: vi.fn(),
  setUserBlockedDao: vi.fn(),
  searchUsersDao: vi.fn(),
}));
vi.mock("../src/dao/mapsDao.js", () => ({
  listMapsByOwnerDao: vi.fn(),
  deleteMapDao: vi.fn(),
  removeUserFromMapsDao: vi.fn(),
  getMapByIdDao: vi.fn(),
}));

describe("userAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("blockUserAbl", () => {
    it("refuses to let an admin block themselves", async () => {
      await expect(blockUserAbl("admin1", "admin1")).rejects.toThrow(
        CannotActOnSelfError,
      );
      expect(setUserBlockedDao).not.toHaveBeenCalled();
    });

    it("throws UserNotFoundError when the target doesn't exist", async () => {
      vi.mocked(setUserBlockedDao).mockResolvedValue(null as never);

      await expect(blockUserAbl("user1", "admin1")).rejects.toThrow(
        UserNotFoundError,
      );
    });

    it("blocks the target user", async () => {
      const blocked = { _id: "user1", isBlocked: true };
      vi.mocked(setUserBlockedDao).mockResolvedValue(blocked as never);

      const result = await blockUserAbl("user1", "admin1");

      expect(setUserBlockedDao).toHaveBeenCalledWith("user1", true);
      expect(result).toEqual(blocked);
    });
  });

  describe("unblockUserAbl", () => {
    it("throws UserNotFoundError when the target doesn't exist", async () => {
      vi.mocked(setUserBlockedDao).mockResolvedValue(null as never);

      await expect(unblockUserAbl("user1")).rejects.toThrow(UserNotFoundError);
    });

    it("unblocks the target user", async () => {
      const unblocked = { _id: "user1", isBlocked: false };
      vi.mocked(setUserBlockedDao).mockResolvedValue(unblocked as never);

      const result = await unblockUserAbl("user1");

      expect(setUserBlockedDao).toHaveBeenCalledWith("user1", false);
      expect(result).toEqual(unblocked);
    });
  });

  describe("adminDeleteUserAbl", () => {
    it("refuses to let an admin delete themselves", async () => {
      await expect(adminDeleteUserAbl("admin1", "admin1")).rejects.toThrow(
        CannotActOnSelfError,
      );
      expect(findUserByIdDao).not.toHaveBeenCalled();
    });

    it("throws UserNotFoundError when the target doesn't exist", async () => {
      vi.mocked(findUserByIdDao).mockResolvedValue(null as never);

      await expect(adminDeleteUserAbl("user1", "admin1")).rejects.toThrow(
        UserNotFoundError,
      );
      expect(deleteUserDao).not.toHaveBeenCalled();
    });

    it("deletes owned maps, unlinks other memberships, then deletes the user", async () => {
      vi.mocked(findUserByIdDao).mockResolvedValue({ _id: "user1" } as never);
      vi.mocked(listMapsByOwnerDao).mockResolvedValue([
        { mapId: "mapA" },
        { mapId: "mapB" },
      ] as never);
      vi.mocked(deleteMapDao).mockResolvedValue({} as never);
      vi.mocked(removeUserFromMapsDao).mockResolvedValue(undefined as never);
      vi.mocked(deleteUserDao).mockResolvedValue({ _id: "user1" } as never);

      const result = await adminDeleteUserAbl("user1", "admin1");

      expect(deleteMapDao).toHaveBeenCalledWith("mapA", "user1");
      expect(deleteMapDao).toHaveBeenCalledWith("mapB", "user1");
      expect(removeUserFromMapsDao).toHaveBeenCalledWith("user1");
      expect(deleteUserDao).toHaveBeenCalledWith("user1");
      expect(result).toEqual({ deletedUserId: "user1", deletedOwnedMaps: 2 });
    });
  });

  describe("searchUsersAbl", () => {
    it("returns nothing for a query under 2 characters", async () => {
      expect(await searchUsersAbl("me", { q: " a " })).toEqual([]);
      expect(searchUsersDao).not.toHaveBeenCalled();
    });

    it("leaves out yourself and the map's current members", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ members: ["me", "m2"] } as never);
      vi.mocked(searchUsersDao).mockResolvedValue([] as never);

      await searchUsersAbl("me", { q: "ali", mapId: "pub1" });

      expect(getMapByIdDao).toHaveBeenCalledWith("pub1", "me");
      expect(searchUsersDao).toHaveBeenCalledWith("ali", ["me", "me", "m2"], 10);
    });
  });
});
