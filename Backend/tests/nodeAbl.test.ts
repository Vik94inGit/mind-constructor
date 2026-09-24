import { describe, beforeEach, it, expect, vi } from "vitest";
import { getMapByIdDao, getMapByInternalIdDao } from "../src/dao/mapsDao.js";
import {
  createNodeMutationDao,
  countNodesByMapInternalIdDao,
  updateNodeDao,
  findNodeByPublicIdDao,
  setBranchHiddenMutationDao,
} from "../src/dao/nodeDao.js";
import {
  createNodeAbl,
  updateNodeAbl,
  setBranchHiddenAbl,
  NotMapOwnerError,
  MapNotFoundError,
  ParentNotFoundError,
  CrossMapParentError,
  ParentNotOwnedError,
  SelfParentError,
} from "../src/abl/nodeAbl.js";
import { ValidationError } from "../src/abl/errors.js";

vi.mock("../src/dao/mapsDao.js", () => ({
  getMapByIdDao: vi.fn(),
  getMapByInternalIdDao: vi.fn(),
}));
vi.mock("../src/dao/nodeDao.js", () => ({
  createNodeMutationDao: vi.fn(),
  countNodesByMapInternalIdDao: vi.fn(),
  updateNodeDao: vi.fn(),
  findNodeByPublicIdDao: vi.fn(),
  setBranchHiddenMutationDao: vi.fn(),
}));

describe("nodeAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createNodeAbl", () => {
    it("rejects a missing text", async () => {
      await expect(
        createNodeAbl({ type: "Problem" }, "pub123", "user1"),
      ).rejects.toThrow(ValidationError);
      expect(getMapByIdDao).not.toHaveBeenCalled();
    });

    it("rejects an invalid order at creation too", async () => {
      await expect(
        createNodeAbl({ text: "Step", type: "Option", order: 0 }, "pub123", "user1"),
      ).rejects.toThrow(ValidationError);
      expect(getMapByIdDao).not.toHaveBeenCalled();
    });

    it("rejects a missing or invalid type — mandatory on purpose", async () => {
      await expect(
        createNodeAbl({ text: "Ship it" }, "pub123", "user1"),
      ).rejects.toThrow(ValidationError);

      await expect(
        createNodeAbl({ text: "Ship it", type: "NotARealType" }, "pub123", "user1"),
      ).rejects.toThrow(ValidationError);
    });

    it("throws MapNotFoundError when the caller isn't a map member", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue(null as never);

      await expect(
        createNodeAbl({ text: "Ship it", type: "Problem" }, "pub123", "user1"),
      ).rejects.toThrow(MapNotFoundError);
      expect(createNodeMutationDao).not.toHaveBeenCalled();
    });

    it("computes isFirstNode from the map's current node count", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "m1" } as never);
      vi.mocked(countNodesByMapInternalIdDao).mockResolvedValue(0 as never);
      vi.mocked(createNodeMutationDao).mockResolvedValue({ nodeId: "n1" } as never);

      await createNodeAbl({ text: "Ship it", type: "Problem" }, "pub123", "user1");

      expect(countNodesByMapInternalIdDao).toHaveBeenCalledWith("m1");
      expect(createNodeMutationDao).toHaveBeenCalledWith("m1", {
        text: "Ship it",
        type: "Problem",
        userId: "user1",
        isFirstNode: true,
        parentId: null,
      });
      expect(findNodeByPublicIdDao).not.toHaveBeenCalled();
    });

    it("isFirstNode is false once the map already has nodes", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "m1" } as never);
      vi.mocked(countNodesByMapInternalIdDao).mockResolvedValue(3 as never);
      vi.mocked(createNodeMutationDao).mockResolvedValue({ nodeId: "n2" } as never);

      await createNodeAbl({ text: "Cut scope", type: "Option" }, "pub123", "user1");

      const callArg = vi.mocked(createNodeMutationDao).mock.calls[0][1];
      expect(callArg.isFirstNode).toBe(false);
    });

    // parentId arrives as a public nodeId and has to be resolved to the
    // parent's internal _id — same shape of rule (and same three failure
    // modes) as linking two nodes in edgeAbl.ts.
    it("resolves a public parentId to the parent's internal _id when branching from your own node", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "m1" } as never);
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "parentInternal1",
        mapId: "m1",
        userId: "user1",
      } as never);
      vi.mocked(countNodesByMapInternalIdDao).mockResolvedValue(1 as never);
      vi.mocked(createNodeMutationDao).mockResolvedValue({ nodeId: "n2" } as never);

      await createNodeAbl(
        { text: "Branch", type: "Option", parentId: "parentPublic1" },
        "pub123",
        "user1",
      );

      expect(findNodeByPublicIdDao).toHaveBeenCalledWith("parentPublic1");
      expect(createNodeMutationDao).toHaveBeenCalledWith("m1", {
        text: "Branch",
        type: "Option",
        userId: "user1",
        isFirstNode: false,
        parentId: "parentInternal1",
      });
    });

    it("throws ParentNotFoundError when parentId doesn't resolve to a real node", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "m1" } as never);
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue(null as never);

      await expect(
        createNodeAbl({ text: "Branch", type: "Option", parentId: "nope" }, "pub123", "user1"),
      ).rejects.toThrow(ParentNotFoundError);
      expect(createNodeMutationDao).not.toHaveBeenCalled();
    });

    it("throws CrossMapParentError when the parent belongs to a different map", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "m1" } as never);
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "parentInternal1",
        mapId: "some-other-map",
        userId: "user1",
      } as never);

      await expect(
        createNodeAbl({ text: "Branch", type: "Option", parentId: "p1" }, "pub123", "user1"),
      ).rejects.toThrow(CrossMapParentError);
      expect(createNodeMutationDao).not.toHaveBeenCalled();
    });

    it("throws ParentNotOwnedError when the parent wasn't created by the caller", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "m1" } as never);
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "parentInternal1",
        mapId: "m1",
        userId: "someoneElse",
      } as never);

      await expect(
        createNodeAbl({ text: "Branch", type: "Option", parentId: "p1" }, "pub123", "user1"),
      ).rejects.toThrow(ParentNotOwnedError);
      expect(createNodeMutationDao).not.toHaveBeenCalled();
    });
  });

  describe("updateNodeAbl", () => {
    it("rejects an empty update", async () => {
      await expect(updateNodeAbl("node1", "user1", {})).rejects.toThrow(ValidationError);
      expect(updateNodeDao).not.toHaveBeenCalled();
    });

    it("rejects an invalid type", async () => {
      await expect(
        updateNodeAbl("node1", "user1", { type: "NotARealType" }),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects an invalid symbolOverride", async () => {
      await expect(
        updateNodeAbl("node1", "user1", { symbolOverride: "star" }),
      ).rejects.toThrow(ValidationError);
      expect(updateNodeDao).not.toHaveBeenCalled();
    });

    it("passes a zone name through, trimmed, and rejects one over 40 characters", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { zoneName: "  Marketing  " });
      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { zoneName: "Marketing" });

      await expect(
        updateNodeAbl("node1", "user1", { zoneName: "x".repeat(41) }),
      ).rejects.toThrow(ValidationError);
    });

    it("passes a valid symbolOverride through to the DAO", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { symbolOverride: "check" });

      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { symbolOverride: "check" });
    });

    it("passes explicit null through to clear symbolOverride back to the type's default", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { symbolOverride: null });

      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { symbolOverride: null });
    });

    it("rejects an order that isn't a whole number from 1 to 9999", async () => {
      for (const order of [0, -1, 1.5, 10000, "3"]) {
        await expect(updateNodeAbl("node1", "user1", { order })).rejects.toThrow(ValidationError);
      }
      expect(updateNodeDao).not.toHaveBeenCalled();
    });

    it("passes a valid order through, and explicit null to clear it", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { order: 3 });
      expect(updateNodeDao).toHaveBeenLastCalledWith("node1", "user1", { order: 3 });

      await updateNodeAbl("node1", "user1", { order: null });
      expect(updateNodeDao).toHaveBeenLastCalledWith("node1", "user1", { order: null });
    });

    it("passes only the provided fields through to the DAO", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { text: "Updated text" });

      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { text: "Updated text" });
      expect(findNodeByPublicIdDao).not.toHaveBeenCalled();
    });

    // parentId used to be passed straight through unresolved here — a real
    // public nodeId always failed the ObjectId cast server-side. Same
    // resolution (and same three failure modes) createNodeAbl already does.
    it("resolves a public parentId to the parent's internal _id", async () => {
      vi.mocked(findNodeByPublicIdDao)
        .mockResolvedValueOnce({ _id: "parentInternal1", mapId: "m1", userId: "user1" } as never)
        .mockResolvedValueOnce({ _id: "nodeInternal1", mapId: "m1", userId: "user1" } as never);
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { parentId: "parentPublic1" });

      expect(findNodeByPublicIdDao).toHaveBeenNthCalledWith(1, "parentPublic1");
      expect(findNodeByPublicIdDao).toHaveBeenNthCalledWith(2, "node1");
      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { parentId: "parentInternal1" });
    });

    it("passes explicit null straight through to clear parentId, no lookup needed", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { parentId: null });

      expect(findNodeByPublicIdDao).not.toHaveBeenCalled();
      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { parentId: null });
    });

    it("throws SelfParentError when parentId is the node's own id", async () => {
      await expect(updateNodeAbl("node1", "user1", { parentId: "node1" })).rejects.toThrow(SelfParentError);
      expect(findNodeByPublicIdDao).not.toHaveBeenCalled();
      expect(updateNodeDao).not.toHaveBeenCalled();
    });

    it("throws ParentNotFoundError when parentId doesn't resolve to a real node", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue(null as never);

      await expect(updateNodeAbl("node1", "user1", { parentId: "nope" })).rejects.toThrow(ParentNotFoundError);
      expect(updateNodeDao).not.toHaveBeenCalled();
    });

    it("throws ParentNotOwnedError when the parent wasn't created by the caller", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "parentInternal1",
        mapId: "m1",
        userId: "someoneElse",
      } as never);

      await expect(updateNodeAbl("node1", "user1", { parentId: "p1" })).rejects.toThrow(ParentNotOwnedError);
      expect(updateNodeDao).not.toHaveBeenCalled();
    });

    it("throws CrossMapParentError when the parent belongs to a different map", async () => {
      vi.mocked(findNodeByPublicIdDao)
        .mockResolvedValueOnce({ _id: "parentInternal1", mapId: "map-a", userId: "user1" } as never)
        .mockResolvedValueOnce({ _id: "nodeInternal1", mapId: "map-b", userId: "user1" } as never);

      await expect(updateNodeAbl("node1", "user1", { parentId: "p1" })).rejects.toThrow(CrossMapParentError);
      expect(updateNodeDao).not.toHaveBeenCalled();
    });
  });

  describe("setBranchHiddenAbl", () => {
    it("lets only the map's owner hide a branch", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({ mapId: "m1" } as never);
      vi.mocked(setBranchHiddenMutationDao).mockResolvedValue({ nodeId: "node1" } as never);

      vi.mocked(getMapByInternalIdDao).mockResolvedValue({ ownerId: "someoneElse" } as never);
      await expect(setBranchHiddenAbl("node1", "user1", { hidden: true })).rejects.toBeInstanceOf(NotMapOwnerError);
      expect(setBranchHiddenMutationDao).not.toHaveBeenCalled();

      vi.mocked(getMapByInternalIdDao).mockResolvedValue({ ownerId: "user1" } as never);
      await setBranchHiddenAbl("node1", "user1", { hidden: true });
      expect(setBranchHiddenMutationDao).toHaveBeenCalledWith("node1", true);
    });

    it("rejects a body without a boolean, and reports a missing node", async () => {
      await expect(setBranchHiddenAbl("node1", "user1", { hidden: "yes" })).rejects.toThrow(ValidationError);
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue(null as never);
      expect(await setBranchHiddenAbl("node1", "user1", { hidden: false })).toBeNull();
    });
  });
});
