import { describe, beforeEach, it, expect, vi } from "vitest";
import { getMapByIdDao, setSelectedCircleDao } from "../src/dao/mapsDao.js";
import { listNodesByMapInternalIdDao, setLockedNodesDao } from "../src/dao/nodeDao.js";
import {
  computeNodeCirclesAbl,
  selectCircleAbl,
  deselectCircleAbl,
  CircleNotFoundError,
} from "../src/abl/circleAbl.js";
import { ValidationError } from "../src/abl/errors.js";

vi.mock("../src/dao/mapsDao.js", () => ({
  getMapByIdDao: vi.fn(),
  setSelectedCircleDao: vi.fn(),
}));
vi.mock("../src/dao/nodeDao.js", () => ({
  listNodesByMapInternalIdDao: vi.fn(),
  setLockedNodesDao: vi.fn(),
}));

// A root node with two children — the minimal shape that reads as a circle.
// _id values are plain strings; circleAbl only ever calls .toString() on
// them, which is a no-op for a string, so real ObjectIds aren't needed here.
const ROOT = { _id: "root-internal", nodeId: "root-pub", parentId: null };
const CHILD_A = { _id: "childA-internal", nodeId: "childA-pub", parentId: "root-internal" };
const CHILD_B = { _id: "childB-internal", nodeId: "childB-pub", parentId: "root-internal" };
const LONE_CHILD = { _id: "lone-internal", nodeId: "lone-pub", parentId: "root-internal" };

describe("computeNodeCirclesAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the map doesn't exist or the caller isn't a member", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue(null as never);

    const result = await computeNodeCirclesAbl("pub123", "user1");

    expect(result).toBeNull();
    expect(listNodesByMapInternalIdDao).not.toHaveBeenCalled();
  });

  it("groups a root with 2+ children into one circle", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "map1" } as never);
    vi.mocked(listNodesByMapInternalIdDao).mockResolvedValue([ROOT, CHILD_A, CHILD_B] as never);

    const result = await computeNodeCirclesAbl("pub123", "user1");

    expect(result!.circles).toEqual([
      { rootId: "root-pub", nodeIds: ["root-pub", "childA-pub", "childB-pub"] },
    ]);
  });

  it("drops a parent with only one child — not a circle", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "map1" } as never);
    vi.mocked(listNodesByMapInternalIdDao).mockResolvedValue([ROOT, LONE_CHILD] as never);

    const result = await computeNodeCirclesAbl("pub123", "user1");

    expect(result!.circles).toEqual([]);
  });

  it("is stable across repeated calls on an unchanged graph", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "map1" } as never);
    vi.mocked(listNodesByMapInternalIdDao).mockResolvedValue([ROOT, CHILD_A, CHILD_B] as never);

    const first = await computeNodeCirclesAbl("pub123", "user1");
    const second = await computeNodeCirclesAbl("pub123", "user1");

    expect(first).toEqual(second);
  });
});

describe("selectCircleAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a missing rootId", async () => {
    await expect(selectCircleAbl("pub123", "user1", {})).rejects.toThrow(ValidationError);
    expect(getMapByIdDao).not.toHaveBeenCalled();
  });

  it("throws CircleNotFoundError when rootId doesn't match any current circle", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "map1" } as never);
    vi.mocked(listNodesByMapInternalIdDao).mockResolvedValue([ROOT, CHILD_A, CHILD_B] as never);

    await expect(
      selectCircleAbl("pub123", "user1", { rootId: "does-not-exist" }),
    ).rejects.toThrow(CircleNotFoundError);
    expect(setLockedNodesDao).not.toHaveBeenCalled();
  });

  it("locks the circle's members and persists the selection", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "map1" } as never);
    vi.mocked(listNodesByMapInternalIdDao).mockResolvedValue([ROOT, CHILD_A, CHILD_B] as never);
    vi.mocked(setSelectedCircleDao).mockResolvedValue({ _id: "map1" } as never);

    const result = await selectCircleAbl("pub123", "user1", { rootId: "root-pub" });

    expect(setLockedNodesDao).toHaveBeenCalledWith("map1", ["root-pub", "childA-pub", "childB-pub"]);
    expect(setSelectedCircleDao).toHaveBeenCalledWith("map1", {
      rootId: "root-pub",
      nodeIds: ["root-pub", "childA-pub", "childB-pub"],
    });
    expect(result!.selectedCircle).toEqual({
      rootId: "root-pub",
      nodeIds: ["root-pub", "childA-pub", "childB-pub"],
    });
  });
});

describe("deselectCircleAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the map doesn't exist or the caller isn't a member", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue(null as never);

    const result = await deselectCircleAbl("pub123", "user1");

    expect(result).toBeNull();
    expect(setLockedNodesDao).not.toHaveBeenCalled();
  });

  it("unlocks every node and clears the selection", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "map1" } as never);
    vi.mocked(setSelectedCircleDao).mockResolvedValue({ _id: "map1" } as never);

    await deselectCircleAbl("pub123", "user1");

    expect(setLockedNodesDao).toHaveBeenCalledWith("map1", []);
    expect(setSelectedCircleDao).toHaveBeenCalledWith("map1", null);
  });
});
