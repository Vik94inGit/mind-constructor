import { describe, beforeEach, it, expect, vi } from "vitest";
import { getMapByIdDao } from "../src/dao/mapsDao.js";
import { createLineMutationDao, findLineByPublicIdDao, deleteLineByIdDao } from "../src/dao/lineDao.js";
import {
  createLineAbl,
  deleteLineAbl,
  MapNotFoundError,
  LineNotFoundError,
  NotLineDeleterError,
} from "../src/abl/lineAbl.js";
import { ValidationError } from "../src/abl/errors.js";

vi.mock("../src/dao/mapsDao.js", () => ({
  getMapByIdDao: vi.fn(),
}));
vi.mock("../src/dao/lineDao.js", () => ({
  createLineMutationDao: vi.fn(),
  findLineByPublicIdDao: vi.fn(),
  deleteLineByIdDao: vi.fn(),
}));

const pts = [
  { x: 10, y: 20 },
  { x: 300, y: 400 },
];

describe("lineAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createLineAbl", () => {
    it("rejects a line with fewer than 2 points", async () => {
      await expect(createLineAbl({ points: [{ x: 1, y: 2 }] }, "pub1", "user1")).rejects.toThrow(ValidationError);
      await expect(createLineAbl({ points: [] }, "pub1", "user1")).rejects.toThrow(ValidationError);
      expect(getMapByIdDao).not.toHaveBeenCalled();
    });

    it("rejects too many points, non-numeric coordinates and a missing points field", async () => {
      const tooMany = Array.from({ length: 201 }, (_, i) => ({ x: i, y: i }));
      await expect(createLineAbl({ points: tooMany }, "pub1", "user1")).rejects.toThrow(ValidationError);
      await expect(createLineAbl({ points: [{ x: "1", y: 2 }, { x: 3, y: 4 }] }, "pub1", "user1")).rejects.toThrow(ValidationError);
      await expect(createLineAbl({}, "pub1", "user1")).rejects.toThrow(ValidationError);
    });

    it("throws MapNotFoundError when the caller isn't a member of the map", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue(null as never);
      await expect(createLineAbl({ points: pts }, "pub1", "user1")).rejects.toThrow(MapNotFoundError);
      expect(createLineMutationDao).not.toHaveBeenCalled();
    });

    it("creates the line on the map's internal id for the caller", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "mapInternal1" } as never);
      vi.mocked(createLineMutationDao).mockResolvedValue({ lineId: "l1" } as never);

      const result = await createLineAbl({ points: pts }, "pub1", "user1");

      expect(createLineMutationDao).toHaveBeenCalledWith({ mapId: "mapInternal1", userId: "user1", points: pts });
      expect(result).toEqual({ lineId: "l1" });
    });
  });

  describe("deleteLineAbl", () => {
    const lineOf = (userId: string, ownerId: string) => ({
      _id: "lineInternal1",
      userId,
      mapId: { mapId: "pub1", ownerId },
    });

    it("throws LineNotFoundError for an unknown line", async () => {
      vi.mocked(findLineByPublicIdDao).mockResolvedValue(null as never);
      await expect(deleteLineAbl("l1", "user1")).rejects.toThrow(LineNotFoundError);
      expect(deleteLineByIdDao).not.toHaveBeenCalled();
    });

    it("lets the creator delete it, and reports the map's public id for the broadcast", async () => {
      vi.mocked(findLineByPublicIdDao).mockResolvedValue(lineOf("user1", "owner9") as never);

      const result = await deleteLineAbl("l1", "user1");

      expect(deleteLineByIdDao).toHaveBeenCalledWith("lineInternal1");
      expect(result).toEqual({ lineId: "l1", publicMapId: "pub1" });
    });

    it("lets the map's owner delete a line someone else drew", async () => {
      vi.mocked(findLineByPublicIdDao).mockResolvedValue(lineOf("user2", "owner9") as never);
      await deleteLineAbl("l1", "owner9");
      expect(deleteLineByIdDao).toHaveBeenCalled();
    });

    it("refuses anyone who is neither the creator nor the owner", async () => {
      vi.mocked(findLineByPublicIdDao).mockResolvedValue(lineOf("user2", "owner9") as never);
      await expect(deleteLineAbl("l1", "user3")).rejects.toThrow(NotLineDeleterError);
      expect(deleteLineByIdDao).not.toHaveBeenCalled();
    });
  });
});
