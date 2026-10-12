import { describe, beforeEach, it, expect, vi } from "vitest";
import { findImageDao } from "../src/dao/imageDao.js";
import { findNodeByInternalIdDao, findNodeDao } from "../src/dao/nodeDao.js";
import { getImageAbl } from "../src/abl/imageAbl.js";

vi.mock("../src/dao/imageDao.js", () => ({ findImageDao: vi.fn() }));
vi.mock("../src/dao/nodeDao.js", () => ({ findNodeByInternalIdDao: vi.fn(), findNodeDao: vi.fn() }));

const bytes = Buffer.from([1, 2, 3]);

describe("getImageAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findImageDao).mockResolvedValue({ mime: "image/jpeg", data: bytes, nodeId: "n1" } as never);
    vi.mocked(findNodeByInternalIdDao).mockResolvedValue({ nodeId: "node1" } as never);
  });

  it("returns the picture to someone who may open its node", async () => {
    vi.mocked(findNodeDao).mockResolvedValue({ nodeId: "node1" } as never);
    expect(await getImageAbl("img1", "user1")).toEqual({ mime: "image/jpeg", data: bytes });
    expect(findNodeDao).toHaveBeenCalledWith("node1", "user1");
  });

  it("returns null when they may not open the node (not a member, or a hidden branch)", async () => {
    vi.mocked(findNodeDao).mockResolvedValue(null as never);
    expect(await getImageAbl("img1", "user2")).toBeNull();
  });

  it("returns null for a picture that doesn't exist, or whose node is gone", async () => {
    vi.mocked(findImageDao).mockResolvedValueOnce(null as never);
    expect(await getImageAbl("nope", "user1")).toBeNull();
    vi.mocked(findNodeByInternalIdDao).mockResolvedValueOnce(null as never);
    expect(await getImageAbl("img1", "user1")).toBeNull();
  });
});
