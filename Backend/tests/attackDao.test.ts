import { describe, beforeEach, it, expect, vi } from "vitest";
import { Node } from "../src/models/Node.js";
import { Attack } from "../src/models/Attack.js";
import {
  getLastAttackDao,
  applyDamageDao,
  logAttackDao,
  getAttackHistoryByNodeDao,
} from "../src/dao/attackDao.js";

vi.mock("../src/models/Node.js", () => ({
  Node: { findByIdAndUpdate: vi.fn() },
}));
vi.mock("../src/models/Attack.js", async () => {
  const actual = await vi.importActual<typeof import("../src/models/Attack.js")>(
    "../src/models/Attack.js",
  );
  return {
    ...actual,
    Attack: { findOne: vi.fn(), create: vi.fn(), find: vi.fn() },
  };
});

describe("attackDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getLastAttackDao - looks up the attacker's most recent use of a weapon", async () => {
    const lean = vi.fn().mockResolvedValue({ createdAt: new Date() });
    vi.mocked(Attack.findOne).mockReturnValue({ sort: () => ({ lean }) } as never);

    await getLastAttackDao("attacker1", "nitpick");

    expect(Attack.findOne).toHaveBeenCalledWith({ attackerId: "attacker1", weapon: "nitpick" });
  });

  it("applyDamageDao - sets health and defeated on the node", async () => {
    // findByIdAndUpdate(...).populate(...) — a real Mongoose Query stays
    // chainable across populate() and is itself thenable.
    const query: any = {};
    query.populate = vi.fn().mockResolvedValue({ _id: "n1" });
    vi.mocked(Node.findByIdAndUpdate).mockReturnValue(query);

    const result = await applyDamageDao("n1", 50, false);

    expect(Node.findByIdAndUpdate).toHaveBeenCalledWith(
      "n1",
      { $set: { health: 50, defeated: false } },
      { new: true },
    );
    expect(query.populate).toHaveBeenCalled();
    expect(result).toEqual({ _id: "n1" });
  });

  it("logAttackDao - records the attack", async () => {
    vi.mocked(Attack.create).mockResolvedValue({} as never);

    const attackData = {
      mapId: "m1", targetNodeId: "n1", attackerId: "a1", weapon: "nitpick" as const, damage: 10,
    };
    await logAttackDao(attackData);

    expect(Attack.create).toHaveBeenCalledWith(attackData);
  });

  it("getAttackHistoryByNodeDao - newest first, attacker populated", async () => {
    const populate = vi.fn().mockResolvedValue([{ weapon: "nitpick" }]);
    const sort = vi.fn().mockReturnValue({ populate });
    vi.mocked(Attack.find).mockReturnValue({ sort } as never);

    const result = await getAttackHistoryByNodeDao("n1");

    expect(Attack.find).toHaveBeenCalledWith({ targetNodeId: "n1" });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(populate).toHaveBeenCalledWith("attackerId", "username");
    expect(result).toEqual([{ weapon: "nitpick" }]);
  });
});
