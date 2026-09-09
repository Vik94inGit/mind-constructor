import { describe, beforeEach, it, expect, vi } from "vitest";
import {
  findNodeByPublicIdDao,
  listNodesByMapInternalIdDao,
  countPackedMembersDao,
  packNodesMutationDao,
  unpackNodeMutationDao,
  bumpSizeTierIfDefaultDao,
} from "../src/dao/nodeDao.js";
import { findEdgesByNodeInternalIdDao } from "../src/dao/edgeDao.js";
import {
  packNodesAbl,
  unpackNodeAbl,
  PackContainerNotFoundError,
  PackNotOwnedError,
  PackMemberNotFoundError,
  PackMemberNotEligibleError,
} from "../src/abl/packAbl.js";
import { ValidationError } from "../src/abl/errors.js";

vi.mock("../src/dao/nodeDao.js", () => ({
  findNodeByPublicIdDao: vi.fn(),
  listNodesByMapInternalIdDao: vi.fn(),
  countPackedMembersDao: vi.fn(),
  packNodesMutationDao: vi.fn(),
  unpackNodeMutationDao: vi.fn(),
  bumpSizeTierIfDefaultDao: vi.fn(),
}));
vi.mock("../src/dao/edgeDao.js", () => ({
  findEdgesByNodeInternalIdDao: vi.fn(),
}));

const container = { _id: "c1", mapId: "m1", userId: "owner1", parentId: null };

describe("packAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Neutral defaults every test can override: no branch neighbors, no
    // edges, container not yet packed with anything.
    vi.mocked(listNodesByMapInternalIdDao).mockResolvedValue([]);
    vi.mocked(findEdgesByNodeInternalIdDao).mockResolvedValue([]);
    vi.mocked(countPackedMembersDao).mockResolvedValue(0);
  });

  describe("packNodesAbl", () => {
    it("rejects an empty nodeIds list before looking anything up", async () => {
      await expect(
        packNodesAbl("container1", "owner1", { nodeIds: [] }),
      ).rejects.toThrow(ValidationError);
      expect(findNodeByPublicIdDao).not.toHaveBeenCalled();
    });

    it("throws PackContainerNotFoundError when the container doesn't exist", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue(null as never);

      await expect(
        packNodesAbl("container1", "owner1", { nodeIds: ["m1"] }),
      ).rejects.toThrow(PackContainerNotFoundError);
    });

    it("throws PackNotOwnedError when the caller doesn't own the container", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue(container as never);

      await expect(
        packNodesAbl("container1", "someoneElse", { nodeIds: ["m1"] }),
      ).rejects.toThrow(PackNotOwnedError);
    });

    it("throws PackMemberNotFoundError when a picked node doesn't exist", async () => {
      vi.mocked(findNodeByPublicIdDao).mockImplementation(async (id) =>
        (id === "container1" ? container : null) as never,
      );

      await expect(
        packNodesAbl("container1", "owner1", { nodeIds: ["ghost"] }),
      ).rejects.toThrow(PackMemberNotFoundError);
    });

    it("throws PackMemberNotEligibleError for a node that's neither Edge- nor branch-linked to the container", async () => {
      vi.mocked(findNodeByPublicIdDao).mockImplementation(async (id) =>
        (id === "container1"
          ? container
          : { _id: "stranger1", mapId: "m1", userId: "owner1" }) as never,
      );
      // No edges, no branch relationship set up in beforeEach's defaults.

      await expect(
        packNodesAbl("container1", "owner1", { nodeIds: ["stranger1"] }),
      ).rejects.toThrow(PackMemberNotEligibleError);
      expect(packNodesMutationDao).not.toHaveBeenCalled();
    });

    it("accepts a direct branch child as eligible", async () => {
      vi.mocked(findNodeByPublicIdDao).mockImplementation(async (id) =>
        (id === "container1"
          ? container
          : { _id: "child1", mapId: "m1", userId: "owner1" }) as never,
      );
      vi.mocked(listNodesByMapInternalIdDao).mockResolvedValue([
        { _id: "child1", nodeId: "child1", parentId: "c1" },
      ] as never);
      vi.mocked(packNodesMutationDao).mockResolvedValue({
        container: { nodeId: "container1" },
        members: [{ nodeId: "child1" }],
      } as never);

      const result = await packNodesAbl("container1", "owner1", { nodeIds: ["child1"] });

      expect(packNodesMutationDao).toHaveBeenCalledWith("c1", ["child1"]);
      expect(result).toEqual({ container: { nodeId: "container1" }, members: [{ nodeId: "child1" }] });
    });

    it("accepts the container's own branch parent as eligible", async () => {
      const withParent = { ...container, parentId: "grandparent1" };
      vi.mocked(findNodeByPublicIdDao).mockImplementation(async (id) =>
        (id === "container1"
          ? withParent
          : { _id: "grandparent1", mapId: "m1", userId: "owner1" }) as never,
      );
      vi.mocked(packNodesMutationDao).mockResolvedValue({} as never);

      await packNodesAbl("container1", "owner1", { nodeIds: ["grandparent1"] });

      expect(packNodesMutationDao).toHaveBeenCalledWith("c1", ["grandparent1"]);
    });

    it("accepts an Edge-linked node (either direction) as eligible", async () => {
      vi.mocked(findNodeByPublicIdDao).mockImplementation(async (id) =>
        (id === "container1"
          ? container
          : { _id: "linked1", mapId: "m1", userId: "owner1" }) as never,
      );
      vi.mocked(findEdgesByNodeInternalIdDao).mockResolvedValue([
        { fromNodeId: "linked1", toNodeId: "c1" },
      ] as never);
      vi.mocked(packNodesMutationDao).mockResolvedValue({} as never);

      await packNodesAbl("container1", "owner1", { nodeIds: ["linked1"] });

      expect(packNodesMutationDao).toHaveBeenCalledWith("c1", ["linked1"]);
    });

    it("bumps the container's sizeTier to 2 on its first-ever pack, before the mutation", async () => {
      vi.mocked(findNodeByPublicIdDao).mockImplementation(async (id) =>
        (id === "container1"
          ? container
          : { _id: "child1", mapId: "m1", userId: "owner1" }) as never,
      );
      vi.mocked(listNodesByMapInternalIdDao).mockResolvedValue([
        { _id: "child1", nodeId: "child1", parentId: "c1" },
      ] as never);
      vi.mocked(countPackedMembersDao).mockResolvedValue(0);
      vi.mocked(packNodesMutationDao).mockResolvedValue({} as never);

      await packNodesAbl("container1", "owner1", { nodeIds: ["child1"] });

      expect(bumpSizeTierIfDefaultDao).toHaveBeenCalledWith("c1", 2);
    });

    it("does not bump sizeTier when the container already had a packed member", async () => {
      vi.mocked(findNodeByPublicIdDao).mockImplementation(async (id) =>
        (id === "container1"
          ? container
          : { _id: "child2", mapId: "m1", userId: "owner1" }) as never,
      );
      vi.mocked(listNodesByMapInternalIdDao).mockResolvedValue([
        { _id: "child2", nodeId: "child2", parentId: "c1" },
      ] as never);
      vi.mocked(countPackedMembersDao).mockResolvedValue(1); // already has one
      vi.mocked(packNodesMutationDao).mockResolvedValue({} as never);

      await packNodesAbl("container1", "owner1", { nodeIds: ["child2"] });

      expect(bumpSizeTierIfDefaultDao).not.toHaveBeenCalled();
    });
  });

  describe("unpackNodeAbl", () => {
    it("returns null when the member doesn't exist or isn't owned by the caller", async () => {
      vi.mocked(unpackNodeMutationDao).mockResolvedValue(null as never);

      const result = await unpackNodeAbl("member1", "someone");

      expect(result).toBeNull();
    });

    it("clears packedIntoNodeId for the member's own owner", async () => {
      vi.mocked(unpackNodeMutationDao).mockResolvedValue({ nodeId: "member1", packedIntoNodeId: null } as never);

      const result = await unpackNodeAbl("member1", "owner1");

      expect(unpackNodeMutationDao).toHaveBeenCalledWith("member1", "owner1");
      expect(result).toEqual({ nodeId: "member1", packedIntoNodeId: null });
    });
  });
});
