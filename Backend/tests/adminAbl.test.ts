import { describe, beforeEach, it, expect, vi } from "vitest";
import { getAllUsersDao } from "../src/dao/userDao.js";
import { listUserActivityDao, listAllMapsDao } from "../src/dao/adminDao.js";
import { adminDeleteMapDao } from "../src/dao/mapsDao.js";
import { adminDeleteUserAbl } from "../src/abl/userAbl.js";
import {
  isUnusedProfile,
  listAllMapsAbl,
  listAdminUsersAbl,
  deleteUnusedUsersAbl,
  adminDeleteMapAbl,
  AdminMapNotFoundError,
  UNUSED_IDLE_DAYS,
} from "../src/abl/adminAbl.js";
import { ValidationError } from "../src/abl/errors.js";

vi.mock("../src/dao/userDao.js", () => ({ getAllUsersDao: vi.fn() }));
vi.mock("../src/dao/adminDao.js", () => ({ listUserActivityDao: vi.fn(), listAllMapsDao: vi.fn() }));
vi.mock("../src/dao/mapsDao.js", () => ({ adminDeleteMapDao: vi.fn() }));
vi.mock("../src/abl/userAbl.js", () => ({ adminDeleteUserAbl: vi.fn() }));

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-22T00:00:00Z");
// An ObjectId whose timestamp is `daysAgo` days before `now`.
const idMadeDaysAgo = (daysAgo: number, tail = "0000000000000001") =>
  Math.floor((now.getTime() - daysAgo * DAY) / 1000).toString(16).padStart(8, "0") + tail;

describe("isUnusedProfile", () => {
  const old = { _id: idMadeDaysAgo(100) };

  it("counts an old account that never wrote and has been idle", () => {
    expect(isUnusedProfile(old, { writtenNodes: 0, lastActiveAt: new Date(now.getTime() - 40 * DAY) }, now)).toBe(true);
    expect(isUnusedProfile(old, undefined, now)).toBe(true);
  });

  it("never counts an admin", () => {
    expect(isUnusedProfile({ ...old, role: "admin" }, undefined, now)).toBe(false);
  });

  it("never counts someone who wrote a thought", () => {
    expect(isUnusedProfile(old, { writtenNodes: 1, lastActiveAt: null }, now)).toBe(false);
  });

  it("keeps someone active within the idle window", () => {
    const recent = new Date(now.getTime() - (UNUSED_IDLE_DAYS - 1) * DAY);
    expect(isUnusedProfile(old, { writtenNodes: 0, lastActiveAt: recent }, now)).toBe(false);
  });

  it("keeps a fresh sign-up even with no activity at all", () => {
    expect(isUnusedProfile({ _id: idMadeDaysAgo(2) }, undefined, now)).toBe(false);
  });
});

describe("listAdminUsersAbl / deleteUnusedUsersAbl", () => {
  const unusedId = idMadeDaysAgo(100, "0000000000000001");
  const writerId = idMadeDaysAgo(100, "0000000000000002");
  const adminId = idMadeDaysAgo(100, "0000000000000003");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAllUsersDao).mockResolvedValue([
      { _id: unusedId, username: "idle", role: "user", passwordHash: "x" },
      { _id: writerId, username: "writer", role: "user" },
      { _id: adminId, username: "boss", role: "admin" },
    ] as never);
    vi.mocked(listUserActivityDao).mockResolvedValue([
      { userId: unusedId, ownedMaps: 1, writtenNodes: 0, lastActiveAt: null },
      { userId: writerId, ownedMaps: 1, writtenNodes: 3, lastActiveAt: null },
      { userId: adminId, ownedMaps: 0, writtenNodes: 0, lastActiveAt: null },
    ]);
  });

  it("flags only the unused account and strips the password hash", async () => {
    const users = await listAdminUsersAbl(now);
    expect(users.map((u) => [u.username, u.unused])).toEqual([
      ["idle", true],
      ["writer", false],
      ["boss", false],
    ]);
    expect(users[0]).not.toHaveProperty("passwordHash");
    expect(users[0].ownedMaps).toBe(1);
  });

  it("deletes the confirmed accounts that are still unused and skips the rest", async () => {
    const result = await deleteUnusedUsersAbl(adminId, { userIds: [unusedId, writerId, adminId, "missing"] }, now);
    expect(result).toEqual({ deleted: [unusedId], skipped: [writerId, adminId, "missing"] });
    expect(adminDeleteUserAbl).toHaveBeenCalledTimes(1);
    expect(adminDeleteUserAbl).toHaveBeenCalledWith(unusedId, adminId);
  });

  it("rejects an empty list", async () => {
    await expect(deleteUnusedUsersAbl(adminId, { userIds: [] }, now)).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("maps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists every map", async () => {
    vi.mocked(listAllMapsDao).mockResolvedValue([{ mapId: "m1" }] as never);
    await expect(listAllMapsAbl()).resolves.toEqual([{ mapId: "m1" }]);
  });

  it("deletes any map", async () => {
    vi.mocked(adminDeleteMapDao).mockResolvedValue({ mapId: "m1" } as never);
    await expect(adminDeleteMapAbl("m1")).resolves.toEqual({ deletedMapId: "m1" });
  });

  it("404s a map that doesn't exist", async () => {
    vi.mocked(adminDeleteMapDao).mockResolvedValue(null as never);
    await expect(adminDeleteMapAbl("nope")).rejects.toBeInstanceOf(AdminMapNotFoundError);
  });
});
