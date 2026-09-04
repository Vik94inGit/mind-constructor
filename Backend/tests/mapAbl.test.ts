import { describe, beforeEach, it, expect, vi } from "vitest";
import {
  createMapDao,
  getMapByIdDao,
  setMemberColorMutationDao,
  getMapsDao,
  updateMapDao,
  inviteUserToMapDao,
} from "../src/dao/mapsDao.js";
import {
  createMapAbl,
  updateMapAbl,
  inviteUserToMapAbl,
  setMapColorAbl,
  getMapsAbl,
  ColorTakenError,
} from "../src/abl/mapAbl.js";
import { createNodeAbl } from "../src/abl/nodeAbl.js";
import { ValidationError } from "../src/abl/errors.js";

vi.mock("../src/dao/mapsDao.js", () => ({
  createMapDao: vi.fn(),
  getMapByIdDao: vi.fn(),
  setMemberColorMutationDao: vi.fn(),
  getMapsDao: vi.fn(),
  updateMapDao: vi.fn(),
  inviteUserToMapDao: vi.fn(),
}));

// createMapAbl seeds a template's nodes through the real createNodeAbl (see
// mapAbl.ts's seedTemplateNodes) rather than a DAO directly — mocked here as
// its own module so template tests can assert on calls to it without also
// standing up createNodeAbl's own membership/parent-resolution DAOs.
vi.mock("../src/abl/nodeAbl.js", () => ({
  createNodeAbl: vi.fn(),
}));

describe("mapAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createMapAbl", () => {
    it("rejects a missing name", async () => {
      await expect(
        createMapAbl({ ownerColor: "#4f46e5" }, "user1"),
      ).rejects.toThrow(ValidationError);
      expect(createMapDao).not.toHaveBeenCalled();
    });

    it("rejects a missing or invalid ownerColor", async () => {
      await expect(
        createMapAbl({ name: "Test", ownerColor: "not-a-color" }, "user1"),
      ).rejects.toThrow(ValidationError);
      expect(createMapDao).not.toHaveBeenCalled();
    });

    it("creates the map once input is valid", async () => {
      vi.mocked(createMapDao).mockResolvedValue({ mapId: "abc123" } as never);

      const result = await createMapAbl(
        { name: "Test Map", ownerColor: "#4f46e5" },
        "user1",
      );

      expect(createMapDao).toHaveBeenCalledWith({
        name: "Test Map",
        ownerColor: "#4f46e5",
        ownerId: "user1",
      });
      expect(result).toEqual({ mapId: "abc123" });
    });

    it("rejects an unknown template", async () => {
      await expect(
        createMapAbl(
          { name: "Test Map", ownerColor: "#4f46e5", template: "not-a-real-template" },
          "user1",
        ),
      ).rejects.toThrow(ValidationError);
      expect(createMapDao).not.toHaveBeenCalled();
    });

    it("seeds no nodes for template: 'blank'", async () => {
      vi.mocked(createMapDao).mockResolvedValue({ mapId: "abc123" } as never);

      await createMapAbl({ name: "Test Map", ownerColor: "#4f46e5", template: "blank" }, "user1");

      expect(createNodeAbl).not.toHaveBeenCalled();
    });

    it("seeds no nodes when template is omitted, same as 'blank'", async () => {
      vi.mocked(createMapDao).mockResolvedValue({ mapId: "abc123" } as never);

      await createMapAbl({ name: "Test Map", ownerColor: "#4f46e5" }, "user1");

      expect(createNodeAbl).not.toHaveBeenCalled();
    });

    it("seeds a single root Problem node for 'single-problem'", async () => {
      vi.mocked(createMapDao).mockResolvedValue({ mapId: "abc123" } as never);
      vi.mocked(createNodeAbl).mockResolvedValue({ nodeId: "root1" } as never);

      await createMapAbl(
        { name: "Test Map", ownerColor: "#4f46e5", template: "single-problem" },
        "user1",
      );

      expect(createNodeAbl).toHaveBeenCalledTimes(1);
      expect(createNodeAbl).toHaveBeenCalledWith(
        { text: "Problem", type: "Problem", parentId: null },
        "abc123",
        "user1",
      );
    });

    it("seeds a root Problem with two Option children for 'decision-tree', children parented off the real created root", async () => {
      vi.mocked(createMapDao).mockResolvedValue({ mapId: "abc123" } as never);
      vi.mocked(createNodeAbl).mockResolvedValueOnce({ nodeId: "root1" } as never);
      vi.mocked(createNodeAbl).mockResolvedValue({ nodeId: "childN" } as never);

      await createMapAbl(
        { name: "Test Map", ownerColor: "#4f46e5", template: "decision-tree" },
        "user1",
      );

      expect(createNodeAbl).toHaveBeenCalledTimes(3);
      expect(createNodeAbl).toHaveBeenNthCalledWith(
        1,
        { text: "Problem", type: "Problem", parentId: null },
        "abc123",
        "user1",
      );
      expect(createNodeAbl).toHaveBeenNthCalledWith(
        2,
        { text: "Option A", type: "Option", parentId: "root1" },
        "abc123",
        "user1",
      );
      expect(createNodeAbl).toHaveBeenNthCalledWith(
        3,
        { text: "Option B", type: "Option", parentId: "root1" },
        "abc123",
        "user1",
      );
    });

    it("seeds a Solution child and a Problematic option child for 'pro-con'", async () => {
      vi.mocked(createMapDao).mockResolvedValue({ mapId: "abc123" } as never);
      vi.mocked(createNodeAbl).mockResolvedValueOnce({ nodeId: "root1" } as never);
      vi.mocked(createNodeAbl).mockResolvedValue({ nodeId: "childN" } as never);

      await createMapAbl({ name: "Test Map", ownerColor: "#4f46e5", template: "pro-con" }, "user1");

      expect(createNodeAbl).toHaveBeenCalledTimes(3);
      expect(createNodeAbl).toHaveBeenNthCalledWith(
        2,
        { text: "Solution", type: "Solution", parentId: "root1" },
        "abc123",
        "user1",
      );
      expect(createNodeAbl).toHaveBeenNthCalledWith(
        3,
        { text: "Problematic option", type: "Problematic option", parentId: "root1" },
        "abc123",
        "user1",
      );
    });
  });

  describe("setMapColorAbl", () => {
    it("rejects an invalid color before touching the database", async () => {
      await expect(
        setMapColorAbl("pub123", "user1", { color: "nope" }),
      ).rejects.toThrow(ValidationError);
      expect(getMapByIdDao).not.toHaveBeenCalled();
    });

    it("returns null when the map doesn't exist or the user isn't a member", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue(null as never);

      const result = await setMapColorAbl("pub123", "user1", { color: "#4f46e5" });

      expect(result).toBeNull();
      expect(setMemberColorMutationDao).not.toHaveBeenCalled();
    });

    it("rejects a color already taken by another member", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({
        _id: "m1",
        memberColors: [{ userId: "user2", color: "#4f46e5" }],
      } as never);

      await expect(
        setMapColorAbl("pub123", "user1", { color: "#4F46E5" }),
      ).rejects.toThrow(ColorTakenError);
      expect(setMemberColorMutationDao).not.toHaveBeenCalled();
    });

    it("allows reusing your own current color", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({
        _id: "m1",
        memberColors: [{ userId: "user1", color: "#4f46e5" }],
      } as never);
      vi.mocked(setMemberColorMutationDao).mockResolvedValue({ _id: "m1" } as never);

      await setMapColorAbl("pub123", "user1", { color: "#4f46e5" });

      expect(setMemberColorMutationDao).toHaveBeenCalledWith("m1", "user1", "#4f46e5");
    });
  });

  describe("updateMapAbl", () => {
    it("rejects an empty update body", async () => {
      await expect(updateMapAbl("pub123", "user1", {})).rejects.toThrow(ValidationError);
      expect(updateMapDao).not.toHaveBeenCalled();
    });

    it("rejects an invalid color", async () => {
      await expect(
        updateMapAbl("pub123", "user1", { color: "not-a-color" }),
      ).rejects.toThrow(ValidationError);
      expect(updateMapDao).not.toHaveBeenCalled();
    });

    it("rejects an empty name", async () => {
      await expect(updateMapAbl("pub123", "user1", { name: "" })).rejects.toThrow(ValidationError);
      expect(updateMapDao).not.toHaveBeenCalled();
    });

    it("passes a valid partial update straight through", async () => {
      vi.mocked(updateMapDao).mockResolvedValue({ mapId: "pub123", name: "Renamed" } as never);

      const result = await updateMapAbl("pub123", "user1", { name: "Renamed" });

      expect(updateMapDao).toHaveBeenCalledWith("pub123", "user1", { name: "Renamed" });
      expect(result).toEqual({ mapId: "pub123", name: "Renamed" });
    });
  });

  describe("inviteUserToMapAbl", () => {
    it("rejects a missing userIdToInvite", async () => {
      await expect(inviteUserToMapAbl("pub123", {}, "user1")).rejects.toThrow(ValidationError);
      expect(inviteUserToMapDao).not.toHaveBeenCalled();
    });

    it("rejects a malformed userIdToInvite", async () => {
      await expect(
        inviteUserToMapAbl("pub123", { userIdToInvite: "not-an-id" }, "user1"),
      ).rejects.toThrow(ValidationError);
      expect(inviteUserToMapDao).not.toHaveBeenCalled();
    });

    it("invites with a well-formed user id", async () => {
      const validId = "507f1f77bcf86cd799439011";
      vi.mocked(inviteUserToMapDao).mockResolvedValue({ mapId: "pub123" } as never);

      await inviteUserToMapAbl("pub123", { userIdToInvite: validId }, "user1");

      expect(inviteUserToMapDao).toHaveBeenCalledWith("pub123", validId, "user1");
    });
  });

  describe("getMapsAbl", () => {
    it("falls back to 'all' for an invalid filter instead of erroring", async () => {
      vi.mocked(getMapsDao).mockResolvedValue([] as never);

      await getMapsAbl("user1", "not-a-real-filter");

      expect(getMapsDao).toHaveBeenCalledWith("user1", "all");
    });

    it("passes through a valid filter", async () => {
      vi.mocked(getMapsDao).mockResolvedValue([] as never);

      await getMapsAbl("user1", "owned");

      expect(getMapsDao).toHaveBeenCalledWith("user1", "owned");
    });
  });
});
