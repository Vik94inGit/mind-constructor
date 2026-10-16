import { describe, beforeEach, it, expect, vi } from "vitest";
import { getMapByIdDao, setFinishAgreementDao, setMapFinishedDao } from "../src/dao/mapsDao.js";
import { findLatestNodeOnMapDao, hasOpponentMovesDao } from "../src/dao/nodeDao.js";
import {
  agreeToFinishAbl,
  finishMapAbl,
  finishRule,
  FinishNotAllowedError,
  NotMapOwnerError,
  OwnerCannotAgreeError,
  reopenMapAbl,
} from "../src/abl/finishAbl.js";

vi.mock("../src/dao/mapsDao.js", () => ({
  getMapByIdDao: vi.fn(),
  setMapFinishedDao: vi.fn(),
  setFinishAgreementDao: vi.fn(),
}));
vi.mock("../src/dao/nodeDao.js", () => ({
  findLatestNodeOnMapDao: vi.fn(),
  hasOpponentMovesDao: vi.fn(),
}));
vi.mock("../src/dao/attackDao.js", () => ({ listAttacksByMapDao: vi.fn() }));
vi.mock("../src/dao/visibilityDao.js", () => ({
  getHiddenNodesDao: vi.fn().mockResolvedValue({ ids: new Set(), publicIds: new Set() }),
}));

const duel = (agreed: string[] = []) => ({
  _id: "m1",
  ownerId: "owner",
  members: ["owner", "rival"],
  finishAgreedBy: agreed,
  finishedAt: null,
});
const solo = () => ({ _id: "m1", ownerId: "owner", members: ["owner"], finishAgreedBy: [], finishedAt: null });

describe("finishRule", () => {
  it("lets the owner finish an empty map", () => {
    expect(finishRule(duel(), null, false)).toMatchObject({ allowed: true, reason: "empty" });
  });

  it("lets the owner finish once the opponent had the last word", () => {
    expect(finishRule(duel(), { userId: "rival" }, false)).toMatchObject({ allowed: true, reason: "opponentLastWord" });
  });

  it("counts the owner's imitated opponent move as the opponent's word", () => {
    expect(finishRule(solo(), { userId: "owner", byOpponent: true }, true)).toMatchObject({
      allowed: true,
      reason: "opponentLastWord",
    });
  });

  it("refuses when the owner had the last word and nobody agreed", () => {
    expect(finishRule(duel(), { userId: "owner" }, false)).toMatchObject({ allowed: false, waitingFor: ["rival"] });
  });

  it("refuses when the owner answered their own imitated opponent last", () => {
    expect(finishRule(solo(), { userId: "owner" }, true)).toMatchObject({ allowed: false });
  });

  it("allows it when every other member agreed", () => {
    expect(finishRule(duel(["rival"]), { userId: "owner" }, false)).toMatchObject({
      allowed: true,
      reason: "everyoneAgreed",
    });
  });

  it("still waits when only some members agreed", () => {
    const map = { ...duel(["rival"]), members: ["owner", "rival", "third"] };
    expect(finishRule(map, { userId: "owner" }, false)).toMatchObject({ allowed: false, waitingFor: ["third"] });
  });

  it("allows a map with no opponent at all", () => {
    expect(finishRule(solo(), { userId: "owner" }, false)).toMatchObject({ allowed: true, reason: "noOpponent" });
  });
});

describe("finishMapAbl / reopenMapAbl / agreeToFinishAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasOpponentMovesDao).mockResolvedValue(false);
  });

  it("finishes when allowed", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue(duel() as never);
    vi.mocked(findLatestNodeOnMapDao).mockResolvedValue({ userId: "rival" } as never);
    vi.mocked(setMapFinishedDao).mockResolvedValue({ mapId: "pub" } as never);
    await finishMapAbl("pub", "owner");
    expect(setMapFinishedDao).toHaveBeenCalledWith("m1", expect.any(Date));
  });

  it("refuses to finish right after the owner's own point", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue(duel() as never);
    vi.mocked(findLatestNodeOnMapDao).mockResolvedValue({ userId: "owner" } as never);
    await expect(finishMapAbl("pub", "owner")).rejects.toThrow(FinishNotAllowedError);
    expect(setMapFinishedDao).not.toHaveBeenCalled();
  });

  it("only the owner may finish or reopen", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue(duel() as never);
    vi.mocked(findLatestNodeOnMapDao).mockResolvedValue({ userId: "rival" } as never);
    await expect(finishMapAbl("pub", "rival")).rejects.toThrow(NotMapOwnerError);
    await expect(reopenMapAbl("pub", "rival")).rejects.toThrow(NotMapOwnerError);
  });

  it("reopening clears finishedAt", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue({ ...duel(), finishedAt: new Date() } as never);
    await reopenMapAbl("pub", "owner");
    expect(setMapFinishedDao).toHaveBeenCalledWith("m1", null);
  });

  it("members agree, the owner cannot", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue(duel() as never);
    await agreeToFinishAbl("pub", "rival", { agree: true });
    expect(setFinishAgreementDao).toHaveBeenCalledWith("m1", "rival", true);
    await expect(agreeToFinishAbl("pub", "owner", { agree: true })).rejects.toThrow(OwnerCannotAgreeError);
  });
});
