import { describe, beforeEach, it, expect, vi } from "vitest";
import { getMapByIdDao } from "../src/dao/mapsDao.js";
import {
  deleteDraftDao,
  getCheckInsDao,
  getDraftDao,
  getMapViewStateDao,
  getUserStateDao,
  saveDraftDao,
  updateMapViewStateDao,
  updatePreferencesDao,
} from "../src/dao/userStateDao.js";
import {
  deleteDraftAbl,
  getCheckInsAbl,
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
  getCheckInsDao: vi.fn(),
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

    it("saves emoji first and the user's own emoji per node type", async () => {
      vi.mocked(updatePreferencesDao).mockResolvedValue({ preferences: {} } as never);
      await updatePreferencesAbl({ nodeFade: 30 }, "u1");
      expect(updatePreferencesDao).toHaveBeenLastCalledWith("u1", { nodeFade: 30 });
      await expect(updatePreferencesAbl({ nodeFade: 101 }, "u1")).rejects.toThrow();

      await updatePreferencesAbl({ emojiUp: true, typeEmoji: { Problem: "🔥", Solution: "🌟" } }, "u1");
      expect(updatePreferencesDao).toHaveBeenCalledWith("u1", { emojiUp: true, typeEmoji: { Problem: "🔥", Solution: "🌟" } });
    });

    it("lets a type keep its own symbol", async () => {
      await updatePreferencesAbl({ typeEmoji: { Fail: "symbol" } }, "u1");
      expect(updatePreferencesDao).toHaveBeenCalledWith("u1", { typeEmoji: { Fail: "symbol" } });
    });

    it("rejects a type emoji with letters, or for a type that doesn't exist", async () => {
      await expect(updatePreferencesAbl({ typeEmoji: { Problem: "abc" } }, "u1")).rejects.toThrow(ValidationError);
      await expect(updatePreferencesAbl({ typeEmoji: { Banana: "🍌" } }, "u1")).rejects.toThrow(ValidationError);
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
        zoneLayout: { "*": "none", r: "nested" },
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
      await expect(updateMapViewStateAbl("m1", { zoneLayout: { r: "flat" } }, "u1")).rejects.toThrow(ValidationError);
    });
  });

  describe("feelings and check-ins", () => {
    beforeEach(() => vi.mocked(getMapByIdDao).mockResolvedValue({ mapId: "m1" } as never));

    it("saves the viewer's own feeling per node and a before/after check-in", async () => {
      const fields = {
        feelings: { a: "worried", b: "relieved", c: "grateful", d: "frustrated" },
        checkIn: { before: { feeling: "worried", strength: 4, at: 1 }, after: { feeling: "calm", strength: 2, at: 2 } },
      };
      await updateMapViewStateAbl("m1", fields, "u1");
      expect(updateMapViewStateDao).toHaveBeenCalledWith("u1", "m1", fields);
    });

    it("lets a check-in wait for its after, or be cleared", async () => {
      await updateMapViewStateAbl("m1", { checkIn: { before: { feeling: "sad", strength: 1, at: 1 }, after: null } }, "u1");
      await updateMapViewStateAbl("m1", { checkIn: null }, "u1");
      expect(updateMapViewStateDao).toHaveBeenCalledTimes(2);
    });

    it("rejects a feeling that isn't on the list, and a strength outside 1-5", async () => {
      await expect(updateMapViewStateAbl("m1", { feelings: { a: "bored" } }, "u1")).rejects.toThrow(ValidationError);
      await expect(
        updateMapViewStateAbl("m1", { checkIn: { before: { feeling: "calm", strength: 6, at: 1 } } }, "u1"),
      ).rejects.toThrow(ValidationError);
      await expect(
        updateMapViewStateAbl("m1", { checkIn: { before: { feeling: "calm", strength: 2.5, at: 1 } } }, "u1"),
      ).rejects.toThrow(ValidationError);
      expect(updateMapViewStateDao).not.toHaveBeenCalled();
    });

    it("lists the check-in of every map that has one", async () => {
      const before = { feeling: "worried", strength: 4, at: 1 };
      vi.mocked(getCheckInsDao).mockResolvedValue([
        { mapId: "m1", checkIn: { before, after: null } },
        { mapId: "m2", checkIn: null },
      ] as never);
      await expect(getCheckInsAbl("u1")).resolves.toEqual({ m1: { before, after: null } });
      expect(getCheckInsDao).toHaveBeenCalledWith("u1");
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
