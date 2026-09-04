import { describe, beforeEach, it, expect, vi } from "vitest";
import { Node } from "../src/models/Node.js";
import { Map } from "../src/models/Map.js";
import { Edge } from "../src/models/Edge.js";
import {
  findMapByPublicIdDao,
  getMapsDao,
  getMapByIdDao,
  getNodesByMapDao,
  createMapDao,
  updateMapDao,
  inviteUserToMapDao,
  deleteMapDao,
  listMapIdsDao,
  listMapsByOwnerDao,
  getMapSummaryDao,
  setMemberColorMutationDao,
} from "../src/dao/mapsDao.js";

// Mock Mongoose models for Vitest
vi.mock("../src/models/Node.js", () => ({
  Node: {
    deleteMany: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
  },
  NODE_TYPES: ["Problem", "Problematic option", "Solution", "Option", "Success", "Fail", "unknown"],
}));
vi.mock("../src/models/Edge.js", () => ({
  Edge: {
    deleteMany: vi.fn(),
  },
}));
vi.mock("../src/models/Map.js", () => ({
  Map: {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
    updateOne: vi.fn(),
    findById: vi.fn(),
  },
}));

describe("mapsDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findMapByPublicIdDao - looks up a map by its public mapId", async () => {
    const mockMap = { _id: "internal1", mapId: "pub123" };
    vi.mocked(Map.findOne).mockResolvedValue(mockMap as never);

    const result = await findMapByPublicIdDao("pub123");

    expect(Map.findOne).toHaveBeenCalledWith({ mapId: "pub123" });
    expect(result).toEqual(mockMap);
  });

  it("getMapsDao - 'owned' filter queries by ownerId", async () => {
    vi.mocked(Map.find).mockResolvedValue([] as never);

    await getMapsDao("user1", "owned");

    expect(Map.find).toHaveBeenCalledWith({ ownerId: "user1" });
  });

  it("getMapsDao - 'shared' filter excludes maps the user owns", async () => {
    vi.mocked(Map.find).mockResolvedValue([] as never);

    await getMapsDao("user1", "shared");

    expect(Map.find).toHaveBeenCalledWith({
      members: "user1",
      ownerId: { $ne: "user1" },
    });
  });

  it("getMapsDao - defaults to 'all' membership", async () => {
    vi.mocked(Map.find).mockResolvedValue([] as never);

    await getMapsDao("user1");

    expect(Map.find).toHaveBeenCalledWith({ $or: [{ members: "user1" }] });
  });

  it("getMapByIdDao - finds a map the user is a member of", async () => {
    const mockMap = { _id: "m1", mapId: "pub123" };
    const exec = vi.fn().mockResolvedValue(mockMap);
    vi.mocked(Map.findOne).mockReturnValue({ exec } as never);

    const result = await getMapByIdDao("pub123", "user1");

    expect(Map.findOne).toHaveBeenCalledWith({
      mapId: "pub123",
      $or: [{ members: "user1" }],
    });
    expect(result).toEqual(mockMap);
  });

  it("getNodesByMapDao - returns null when the user isn't a member", async () => {
    vi.mocked(Map.findOne).mockResolvedValue(null as never);

    const result = await getNodesByMapDao("pub123", "user1");

    expect(Map.findOne).toHaveBeenCalledWith({
      mapId: "pub123",
      members: "user1",
    });
    expect(result).toBeNull();
    expect(Node.find).not.toHaveBeenCalled();
  });

  it("getNodesByMapDao - returns all nodes on the map for a member", async () => {
    const map = { _id: "m1", mapId: "pub123" };
    vi.mocked(Map.findOne).mockResolvedValue(map as never);
    // Node.find(...).populate(...).populate(...).populate(...) — a real
    // Mongoose Query stays chainable across populate() and is itself
    // thenable, so the mock needs the same shape.
    const chain: any = {};
    chain.populate = vi.fn().mockReturnValue(chain);
    chain.then = (resolve: any) => resolve([{ text: "n1" }]);
    vi.mocked(Node.find).mockReturnValue(chain);

    const result = await getNodesByMapDao("pub123", "user1");

    expect(Node.find).toHaveBeenCalledWith({ mapId: "m1" });
    expect(chain.populate).toHaveBeenNthCalledWith(1, "userId", "username");
    expect(chain.populate).toHaveBeenNthCalledWith(2, "parentId", "nodeId text type");
    expect(chain.populate).toHaveBeenNthCalledWith(3, "targetNodeId", "nodeId text type");
    expect(result).toEqual([{ text: "n1" }]);
  });

  it("createMapDao - creates a map with a generated public mapId", async () => {
    vi.mocked(Map.create).mockResolvedValue({ _id: "m1" } as never);

    await createMapDao({
      name: "Test Map",
      ownerId: "user1",
      ownerColor: "#4f46e5",
    });

    const callArg = vi.mocked(Map.create).mock.calls[0][0] as any;
    expect(callArg.name).toBe("Test Map");
    expect(callArg.ownerId).toBe("user1");
    expect(callArg.members).toEqual(["user1"]);
    expect(callArg.memberColors).toEqual([{ userId: "user1", color: "#4f46e5" }]);
    expect(typeof callArg.mapId).toBe("string");
    expect(callArg.mapId.length).toBeGreaterThan(0);
  });

  it("updateMapDao - only the owner can update", async () => {
    const updates = { name: "New Name" };
    vi.mocked(Map.findOneAndUpdate).mockResolvedValue({ ...updates } as never);

    await updateMapDao("pub123", "user1", updates);

    expect(Map.findOneAndUpdate).toHaveBeenCalledWith(
      { mapId: "pub123", $or: [{ ownerId: "user1" }] },
      { $set: updates },
      { new: true, runValidators: true },
    );
  });

  it("inviteUserToMapDao - returns null when the map doesn't exist", async () => {
    vi.mocked(Map.findOne).mockResolvedValue(null as never);

    const result = await inviteUserToMapDao("pub123", "user2", "owner1");

    expect(result).toBeNull();
    expect(Map.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("inviteUserToMapDao - adds the invited user as a member", async () => {
    const map = { _id: "m1", mapId: "pub123" };
    vi.mocked(Map.findOne).mockResolvedValue(map as never);
    const populate = vi
      .fn()
      .mockResolvedValue({ _id: "m1", members: ["owner1", "user2"] });
    vi.mocked(Map.findOneAndUpdate).mockReturnValue({ populate } as never);

    await inviteUserToMapDao("pub123", "user2", "owner1");

    expect(Map.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "m1", ownerId: "owner1" },
      { $addToSet: { members: "user2" } },
      { new: true },
    );
  });

  it("deleteMapDao - returns null when the map doesn't exist or isn't owned by the user", async () => {
    vi.mocked(Map.findOne).mockResolvedValue(null as never);

    const result = await deleteMapDao("pub123", "user1");

    expect(result).toBeNull();
    expect(Edge.deleteMany).not.toHaveBeenCalled();
    expect(Node.deleteMany).not.toHaveBeenCalled();
  });

  it("deleteMapDao - deletes the map's edges, then its nodes, then the map", async () => {
    const map = { _id: "m1", mapId: "pub123" };
    vi.mocked(Map.findOne).mockResolvedValue(map as never);
    vi.mocked(Edge.deleteMany).mockResolvedValue({ deletedCount: 2 } as never);
    vi.mocked(Node.deleteMany).mockResolvedValue({ deletedCount: 3 } as never);
    vi.mocked(Map.findByIdAndDelete).mockResolvedValue(map as never);

    const result = await deleteMapDao("pub123", "user1");

    expect(Edge.deleteMany).toHaveBeenCalledWith({ mapId: "m1" });
    expect(Node.deleteMany).toHaveBeenCalledWith({ mapId: "m1" });
    expect(Map.findByIdAndDelete).toHaveBeenCalledWith("m1");
    expect(result).toEqual(map);
  });

  it("listMapIdsDao - selects only the public mapId field", async () => {
    const mockIds = [{ mapId: "a" }, { mapId: "b" }];
    vi.mocked(Map.find).mockResolvedValue(mockIds as never);

    const result = await listMapIdsDao();

    expect(Map.find).toHaveBeenCalledWith({}, "mapId");
    expect(result).toEqual(mockIds);
  });

  it("listMapsByOwnerDao - queries maps by ownerId", async () => {
    const mockMaps = [{ name: "Owner Map", ownerId: "user1" }];
    vi.mocked(Map.find).mockResolvedValue(mockMaps as never);

    const result = await listMapsByOwnerDao("user1");

    expect(Map.find).toHaveBeenCalledWith({ ownerId: "user1" });
    expect(result).toEqual(mockMaps);
  });

  it("getMapSummaryDao - returns null when the map doesn't exist or the user isn't a member", async () => {
    const lean = vi.fn().mockResolvedValue(null);
    vi.mocked(Map.findOne).mockReturnValue({ lean } as never);

    const result = await getMapSummaryDao("pub123", "user1");

    expect(Map.findOne).toHaveBeenCalledWith({ mapId: "pub123", members: "user1" });
    expect(result).toBeNull();
  });

  it("getMapSummaryDao - counts nodes by the map's internal _id, grouped by type", async () => {
    const map = { _id: "m1", mapId: "pub123", name: "Test", __v: 0 };
    const lean = vi.fn().mockResolvedValue(map);
    vi.mocked(Map.findOne).mockReturnValue({ lean } as never);
    vi.mocked(Node.countDocuments).mockResolvedValue(4 as never);
    vi.mocked(Node.aggregate).mockResolvedValue([
      { _id: "Problem", count: 3 },
      { _id: "Solution", count: 1 },
    ] as never);

    const result = await getMapSummaryDao("pub123", "user1");

    expect(Node.countDocuments).toHaveBeenCalledWith({ mapId: "m1" });
    expect(Node.aggregate).toHaveBeenCalledWith([
      { $match: { mapId: "m1" } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);
    // .lean() skips the schema's toJSON transform, so the DAO strips
    // _id/__v by hand — they shouldn't survive into the result. Every known
    // type gets a zero-filled entry, not just the ones present.
    expect(result).toEqual({
      mapId: "pub123",
      name: "Test",
      nodeCount: 4,
      nodesByType: {
        Problem: 3,
        "Problematic option": 0,
        Solution: 1,
        Option: 0,
        Success: 0,
        Fail: 0,
        unknown: 0,
      },
    });
  });

  // The "is this color taken" business rule now lives in abl/mapAbl.ts —
  // this is a pure mutation, nothing left to decide.
  it("setMemberColorMutationDao - pulls the old entry, pushes the new one, returns the map", async () => {
    vi.mocked(Map.updateOne).mockResolvedValue({} as never);
    vi.mocked(Map.findById).mockResolvedValue({
      _id: "m1",
      memberColors: [{ userId: "user1", color: "#4f46e5" }],
    } as never);

    const result = await setMemberColorMutationDao("m1", "user1", "#4f46e5");

    expect(Map.updateOne).toHaveBeenNthCalledWith(
      1,
      { _id: "m1" },
      { $pull: { memberColors: { userId: "user1" } } },
    );
    expect(Map.updateOne).toHaveBeenNthCalledWith(
      2,
      { _id: "m1" },
      { $push: { memberColors: { userId: "user1", color: "#4f46e5" } } },
    );
    expect(Map.findById).toHaveBeenCalledWith("m1");
    expect(result?.memberColors).toEqual([{ userId: "user1", color: "#4f46e5" }]);
  });
});
