import { describe, beforeEach, it, expect, vi } from "vitest";
import { getMapByIdDao } from "../src/dao/mapsDao.js";
import { findNodeByPublicIdDao } from "../src/dao/nodeDao.js";
import { createEdgeMutationDao } from "../src/dao/edgeDao.js";
import {
  createEdgeAbl,
  MapNotFoundError,
  NodeNotFoundError,
  SelfLoopError,
  CrossMapEdgeError,
  NodeNotOwnedError,
} from "../src/abl/edgeAbl.js";
import { ValidationError } from "../src/abl/errors.js";

vi.mock("../src/dao/mapsDao.js", () => ({
  getMapByIdDao: vi.fn(),
}));
vi.mock("../src/dao/nodeDao.js", () => ({
  findNodeByPublicIdDao: vi.fn(),
}));
vi.mock("../src/dao/edgeDao.js", () => ({
  createEdgeMutationDao: vi.fn(),
}));

describe("createEdgeAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing fromNodeId/toNodeId", async () => {
    await expect(
      createEdgeAbl({ toNodeId: "n2" }, "pub123", "user1"),
    ).rejects.toThrow(ValidationError);
    expect(getMapByIdDao).not.toHaveBeenCalled();
  });

  it("rejects an invalid sentiment", async () => {
    await expect(
      createEdgeAbl({ fromNodeId: "n1", toNodeId: "n2", sentiment: "meh" }, "pub123", "user1"),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a self-loop before touching the database", async () => {
    await expect(
      createEdgeAbl({ fromNodeId: "n1", toNodeId: "n1" }, "pub123", "user1"),
    ).rejects.toThrow(SelfLoopError);
    expect(getMapByIdDao).not.toHaveBeenCalled();
  });

  it("throws MapNotFoundError when the caller isn't a map member", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue(null as never);

    await expect(
      createEdgeAbl({ fromNodeId: "n1", toNodeId: "n2" }, "pub123", "user1"),
    ).rejects.toThrow(MapNotFoundError);
    expect(findNodeByPublicIdDao).not.toHaveBeenCalled();
  });

  it("throws NodeNotFoundError when either node doesn't exist", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "map1" } as never);
    vi.mocked(findNodeByPublicIdDao)
      .mockResolvedValueOnce({ _id: "i1", mapId: "map1" } as never)
      .mockResolvedValueOnce(null as never);

    await expect(
      createEdgeAbl({ fromNodeId: "n1", toNodeId: "n2" }, "pub123", "user1"),
    ).rejects.toThrow(NodeNotFoundError);
    expect(createEdgeMutationDao).not.toHaveBeenCalled();
  });

  it("throws CrossMapEdgeError when a node belongs to a different map", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "map1" } as never);
    vi.mocked(findNodeByPublicIdDao)
      .mockResolvedValueOnce({ _id: "i1", mapId: "map1", userId: "user1" } as never)
      .mockResolvedValueOnce({ _id: "i2", mapId: "some-other-map", userId: "user1" } as never);

    await expect(
      createEdgeAbl({ fromNodeId: "n1", toNodeId: "n2" }, "pub123", "user1"),
    ).rejects.toThrow(CrossMapEdgeError);
    expect(createEdgeMutationDao).not.toHaveBeenCalled();
  });

  it("throws NodeNotOwnedError when either node wasn't created by the caller", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "map1" } as never);
    vi.mocked(findNodeByPublicIdDao)
      .mockResolvedValueOnce({ _id: "i1", mapId: "map1", userId: "user1" } as never)
      .mockResolvedValueOnce({ _id: "i2", mapId: "map1", userId: "someoneElse" } as never);

    await expect(
      createEdgeAbl({ fromNodeId: "n1", toNodeId: "n2" }, "pub123", "user1"),
    ).rejects.toThrow(NodeNotOwnedError);
    expect(createEdgeMutationDao).not.toHaveBeenCalled();
  });

  it("creates the edge once everything checks out", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "map1" } as never);
    vi.mocked(findNodeByPublicIdDao)
      .mockResolvedValueOnce({ _id: "i1", mapId: "map1", userId: "user1" } as never)
      .mockResolvedValueOnce({ _id: "i2", mapId: "map1", userId: "user1" } as never);
    vi.mocked(createEdgeMutationDao).mockResolvedValue({ edgeId: "e1" } as never);

    const result = await createEdgeAbl(
      { fromNodeId: "n1", toNodeId: "n2", sentiment: "negative" },
      "pub123",
      "user1",
    );

    expect(createEdgeMutationDao).toHaveBeenCalledWith({
      mapId: "map1",
      fromNodeId: "i1",
      toNodeId: "i2",
      sentiment: "negative",
      userId: "user1",
    });
    expect(result).toEqual({ edgeId: "e1" });
  });
});
