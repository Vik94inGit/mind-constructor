import { describe, beforeEach, it, expect, vi } from "vitest";
import { getMapByIdDao } from "../src/dao/mapsDao.js";
import {
  deleteDraftDao,
  getDraftDao,
  getMapViewStateDao,
  getUserStateDao,
  saveDraftDao,
  updateMapViewStateDao,
  updatePreferencesDao,
} from "../src/dao/userStateDao.js";
import {
  deleteDraftAbl,
  getDraftAbl,
  getMapViewStateAbl,
  getUserStateAbl,
  MapNotFoundError,
  MAX_DRAFT_BYTES,
  saveDraftAbl,
  UnknownDraftError,
  updateMapViewStateAbl,
  updatePreferencesAbl,
} from "../src/abl/userStateAbl.js";
import { ValidationError } from "../src/abl/errors.js";

vi.mock("../src/dao/mapsDao.js", () => ({ getMapByIdDao: vi.fn() }));
vi.mock("../src/dao/userStateDao.js", () => ({
  getUserStateDao: vi.fn(),
  updatePreferencesDao: vi.fn(),
  getMapViewStateDao: vi.fn(),
  updateMapViewStateDao: vi.fn(),
  getDraftDao: vi.fn(),
  saveDraftDao: vi.fn(),
  deleteDraftDao: vi.fn(),
}));

describe("userStateAbl", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("getUserStateAbl", () => {
    it("is empty for a user with nothing saved yet", async () => {
      vi.mocked(getUserStateDao).mockResolvedValue(null as never);
      await expect(getUserStateAbl("u1")).resolves.toEqual({ preferences: {}, lastMapId: null });
    });

    it("returns the saved preferences and last map", async () => {
      vi.mocked(getUserStateDao).mockResolvedValue({ preferences: { theme: "dark" }, lastMapId: "m1" } as never);
      await expect(getUserStateAbl("u1")).resolves.toEqual({ preferences: { theme: "dark" }, lastMapId: "m1" });
    });
  });

  describe("updatePreferencesAbl", () => {
    it("saves only the fields given", async () => {
      vi.mocked(updatePreferencesDao).mockResolvedValue({ preferences: { language: "ru" } } as never);
      await updatePreferencesAbl({ language: "ru" }, "u1");
      expect(updatePreferencesDao).toHaveBeenCalledWith("u1", { language: "ru" });
    });

    it("rejects unknown values and unknown fields", async () => {
      await expect(updatePreferencesAbl({ theme: "pink" }, "u1")).rejects.toThrow(ValidationError);
      await expect(updatePreferencesAbl({ fontSize: 3 }, "u1")).rejects.toThrow(ValidationError);
      expect(updatePreferencesDao).not.toHaveBeenCalled();
    });
  });

  describe("map view state", () => {
    it("only for a map the user can open", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue(null as never);
      await expect(getMapViewStateAbl("m1", "u1")).rejects.toThrow(MapNotFoundError);
      await expect(updateMapViewStateAbl("m1", { center: { x: 1, y: 2 } }, "u1")).rejects.toThrow(MapNotFoundError);
      expect(getMapViewStateDao).not.toHaveBeenCalled();
      expect(updateMapViewStateDao).not.toHaveBeenCalled();
    });

    it("saves the given fields", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ mapId: "m1" } as never);
      const fields = {
        nodeDisplay: { a: "puzzle" },
        zoneDisplay: { r: "dots" },
        cardFills: { a: "#fde68a" },
        blockLocks: ["a"],
        detachedPieces: ["b"],
        center: { x: 10, y: 20 },
        selectedNodeId: null,
      };
      await updateMapViewStateAbl("m1", fields, "u1");
      expect(updateMapViewStateDao).toHaveBeenCalledWith("u1", "m1", fields);
    });

    it("rejects bad values", async () => {
      await expect(updateMapViewStateAbl("m1", { nodeDisplay: { a: "huge" } }, "u1")).rejects.toThrow(ValidationError);
      await expect(updateMapViewStateAbl("m1", { cardFills: { a: "red" } }, "u1")).rejects.toThrow(ValidationError);
      await expect(updateMapViewStateAbl("m1", { zoom: 2 }, "u1")).rejects.toThrow(ValidationError);
    });
  });

  describe("drafts", () => {
    it("round-trips a draft", async () => {
      vi.mocked(getDraftDao).mockResolvedValue({ data: { text: "hi" }, clientUpdatedAt: 5 } as never);
      await saveDraftAbl("textSplit", { data: { text: "hi" }, clientUpdatedAt: 5 }, "u1");
      expect(saveDraftDao).toHaveBeenCalledWith("u1", "textSplit", { text: "hi" }, 5);
      await expect(getDraftAbl("textSplit", "u1")).resolves.toEqual({ data: { text: "hi" }, clientUpdatedAt: 5 });
    });

    it("is null when there's none", async () => {
      vi.mocked(getDraftDao).mockResolvedValue(null as never);
      await expect(getDraftAbl("think", "u1")).resolves.toBeNull();
    });

    it("refuses an unknown kind, a missing timestamp and an oversized draft", async () => {
      await expect(getDraftAbl("novel", "u1")).rejects.toThrow(UnknownDraftError);
      await expect(deleteDraftAbl("novel", "u1")).rejects.toThrow(UnknownDraftError);
      await expect(saveDraftAbl("think", { data: {} }, "u1")).rejects.toThrow(ValidationError);
      const big = { text: "x".repeat(MAX_DRAFT_BYTES + 1) };
      await expect(saveDraftAbl("think", { data: big, clientUpdatedAt: 1 }, "u1")).rejects.toThrow(ValidationError);
      expect(saveDraftDao).not.toHaveBeenCalled();
    });

    it("deletes a draft", async () => {
      await deleteDraftAbl("think", "u1");
      expect(deleteDraftDao).toHaveBeenCalledWith("u1", "think");
    });
  });
});
