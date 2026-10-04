import { describe, beforeEach, it, expect, vi } from "vitest";
import { getMapByIdDao } from "../src/dao/mapsDao.js";
import {
  createFolderDao,
  deleteFolderDao,
  listFoldersDao,
  moveMapToFolderDao,
  renameFolderDao,
} from "../src/dao/folderDao.js";
import {
  createFolderAbl,
  deleteFolderAbl,
  FolderNotFoundError,
  listFoldersAbl,
  MapNotFoundError,
  moveMapToFolderAbl,
  renameFolderAbl,
} from "../src/abl/folderAbl.js";
import { ValidationError } from "../src/abl/errors.js";

vi.mock("../src/dao/mapsDao.js", () => ({
  getMapByIdDao: vi.fn(),
}));
vi.mock("../src/dao/folderDao.js", () => ({
  listFoldersDao: vi.fn(),
  createFolderDao: vi.fn(),
  renameFolderDao: vi.fn(),
  deleteFolderDao: vi.fn(),
  moveMapToFolderDao: vi.fn(),
}));

describe("folderAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists only the caller's folders", async () => {
    vi.mocked(listFoldersDao).mockResolvedValue([] as never);
    await listFoldersAbl("user1");
    expect(listFoldersDao).toHaveBeenCalledWith("user1");
  });

  describe("createFolderAbl", () => {
    it("trims the name", async () => {
      vi.mocked(createFolderDao).mockResolvedValue({ folderId: "f1" } as never);
      await createFolderAbl({ name: "  Work  " }, "user1");
      expect(createFolderDao).toHaveBeenCalledWith("user1", "Work");
    });

    it("rejects a blank, missing or too long name", async () => {
      await expect(createFolderAbl({ name: "   " }, "user1")).rejects.toThrow(ValidationError);
      await expect(createFolderAbl({}, "user1")).rejects.toThrow(ValidationError);
      await expect(createFolderAbl({ name: "x".repeat(61) }, "user1")).rejects.toThrow(ValidationError);
      expect(createFolderDao).not.toHaveBeenCalled();
    });
  });

  describe("renameFolderAbl", () => {
    it("renames the caller's folder", async () => {
      vi.mocked(renameFolderDao).mockResolvedValue({ folderId: "f1", name: "New" } as never);
      await expect(renameFolderAbl("f1", { name: "New" }, "user1")).resolves.toEqual({ folderId: "f1", name: "New" });
      expect(renameFolderDao).toHaveBeenCalledWith("f1", "user1", "New");
    });

    it("throws FolderNotFoundError for someone else's or a missing folder", async () => {
      vi.mocked(renameFolderDao).mockResolvedValue(null as never);
      await expect(renameFolderAbl("f1", { name: "New" }, "user1")).rejects.toThrow(FolderNotFoundError);
    });
  });

  describe("deleteFolderAbl", () => {
    it("deletes the caller's folder", async () => {
      vi.mocked(deleteFolderDao).mockResolvedValue({ folderId: "f1" } as never);
      await expect(deleteFolderAbl("f1", "user1")).resolves.toEqual({ folderId: "f1" });
    });

    it("throws FolderNotFoundError when there's nothing to delete", async () => {
      vi.mocked(deleteFolderDao).mockResolvedValue(null as never);
      await expect(deleteFolderAbl("f1", "user1")).rejects.toThrow(FolderNotFoundError);
    });
  });

  describe("moveMapToFolderAbl", () => {
    it("moves a map the caller can open into their folder", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ mapId: "m1" } as never);
      vi.mocked(moveMapToFolderDao).mockResolvedValue(true);
      await expect(moveMapToFolderAbl("m1", { folderId: "f1" }, "user1")).resolves.toEqual({
        mapId: "m1",
        folderId: "f1",
      });
      expect(moveMapToFolderDao).toHaveBeenCalledWith("m1", "user1", "f1");
    });

    it("moves a map back to the top level with folderId null", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ mapId: "m1" } as never);
      vi.mocked(moveMapToFolderDao).mockResolvedValue(true);
      await moveMapToFolderAbl("m1", { folderId: null }, "user1");
      expect(moveMapToFolderDao).toHaveBeenCalledWith("m1", "user1", null);
    });

    it("throws MapNotFoundError for a map the caller can't open", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue(null as never);
      await expect(moveMapToFolderAbl("m1", { folderId: "f1" }, "user1")).rejects.toThrow(MapNotFoundError);
      expect(moveMapToFolderDao).not.toHaveBeenCalled();
    });

    it("throws FolderNotFoundError for a folder that isn't the caller's", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ mapId: "m1" } as never);
      vi.mocked(moveMapToFolderDao).mockResolvedValue(false);
      await expect(moveMapToFolderAbl("m1", { folderId: "f9" }, "user1")).rejects.toThrow(FolderNotFoundError);
    });

    it("rejects a missing folderId", async () => {
      await expect(moveMapToFolderAbl("m1", {}, "user1")).rejects.toThrow(ValidationError);
    });
  });
});
