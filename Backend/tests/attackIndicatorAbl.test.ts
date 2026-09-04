import { describe, beforeEach, it, expect, vi } from "vitest";
import { getMapByIdDao } from "../src/dao/mapsDao.js";
import { listNodesByMapInternalIdDao } from "../src/dao/nodeDao.js";
import { countIncomingEdgesByTargetDao } from "../src/dao/edgeDao.js";
import {
  computeAttackIndicatorsAbl,
  pickWeaponIcon,
  DEFAULT_ATTACK_INDICATOR_THRESHOLD,
} from "../src/abl/attackIndicatorAbl.js";
import { ValidationError } from "../src/abl/errors.js";

vi.mock("../src/dao/mapsDao.js", () => ({
  getMapByIdDao: vi.fn(),
}));
vi.mock("../src/dao/nodeDao.js", () => ({
  listNodesByMapInternalIdDao: vi.fn(),
}));
vi.mock("../src/dao/edgeDao.js", () => ({
  countIncomingEdgesByTargetDao: vi.fn(),
}));

const NODES = [
  { _id: "i1", nodeId: "n1" },
  { _id: "i2", nodeId: "n2" },
];

describe("pickWeaponIcon", () => {
  it("picks sword at or just above threshold", () => {
    expect(pickWeaponIcon(3, 3)).toBe("sword");
    expect(pickWeaponIcon(4, 3)).toBe("sword");
  });

  it("picks axe once well above threshold", () => {
    expect(pickWeaponIcon(5, 3)).toBe("axe");
    expect(pickWeaponIcon(6, 3)).toBe("axe");
  });

  it("picks spear at the highest severity", () => {
    expect(pickWeaponIcon(7, 3)).toBe("spear");
    expect(pickWeaponIcon(100, 3)).toBe("spear");
  });

  it("tiers scale with a custom threshold, not a fixed count", () => {
    expect(pickWeaponIcon(10, 10)).toBe("sword");
    expect(pickWeaponIcon(12, 10)).toBe("axe");
    expect(pickWeaponIcon(14, 10)).toBe("spear");
  });
});

describe("computeAttackIndicatorsAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the map doesn't exist or the user isn't a member", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue(null as never);

    const result = await computeAttackIndicatorsAbl("pub123", "user1", {});

    expect(result).toBeNull();
  });

  it("rejects an invalid threshold", async () => {
    await expect(
      computeAttackIndicatorsAbl("pub123", "user1", { threshold: "0" }),
    ).rejects.toThrow(ValidationError);
  });

  it("uses the default threshold when none is given", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "map1" } as never);
    vi.mocked(listNodesByMapInternalIdDao).mockResolvedValue(NODES as never);
    vi.mocked(countIncomingEdgesByTargetDao).mockResolvedValue([] as never);

    const result = await computeAttackIndicatorsAbl("pub123", "user1", {});

    expect(result!.threshold).toBe(DEFAULT_ATTACK_INDICATOR_THRESHOLD);
    expect(countIncomingEdgesByTargetDao).toHaveBeenCalledWith("map1", "negative");
  });

  it("flags a node at or above threshold, ignores one below it", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "map1" } as never);
    vi.mocked(listNodesByMapInternalIdDao).mockResolvedValue(NODES as never);
    vi.mocked(countIncomingEdgesByTargetDao).mockResolvedValue([
      { _id: "i1", count: 3 }, // meets threshold
      { _id: "i2", count: 2 }, // below threshold
    ] as never);

    const result = await computeAttackIndicatorsAbl("pub123", "user1", { threshold: "3" });

    expect(result!.indicators).toEqual([
      { nodeId: "n1", incomingNegativeEdges: 3, weapon: "sword" },
    ]);
  });

  it("produces exactly one indicator per qualifying node — no duplicates possible by construction", async () => {
    // countIncomingEdgesByTargetDao already groups by target node ($group in
    // the aggregation), so there's structurally only one row per node here;
    // this just confirms the mapping preserves that 1:1 shape.
    vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "map1" } as never);
    vi.mocked(listNodesByMapInternalIdDao).mockResolvedValue(NODES as never);
    vi.mocked(countIncomingEdgesByTargetDao).mockResolvedValue([
      { _id: "i1", count: 5 },
    ] as never);

    const result = await computeAttackIndicatorsAbl("pub123", "user1", { threshold: "3" });

    expect(result!.indicators.filter((i) => i.nodeId === "n1")).toHaveLength(1);
  });

  it("a node that drops below threshold simply isn't in the next computed result", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "map1" } as never);
    vi.mocked(listNodesByMapInternalIdDao).mockResolvedValue(NODES as never);

    vi.mocked(countIncomingEdgesByTargetDao).mockResolvedValue([
      { _id: "i1", count: 3 },
    ] as never);
    const before = await computeAttackIndicatorsAbl("pub123", "user1", { threshold: "3" });
    expect(before!.indicators).toHaveLength(1);

    // Simulates an edge being removed, dropping the count below threshold.
    vi.mocked(countIncomingEdgesByTargetDao).mockResolvedValue([
      { _id: "i1", count: 2 },
    ] as never);
    const after = await computeAttackIndicatorsAbl("pub123", "user1", { threshold: "3" });
    expect(after!.indicators).toHaveLength(0);
  });
});
