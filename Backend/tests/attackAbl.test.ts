import { describe, beforeEach, it, expect, vi } from "vitest";
import { findNodeByPublicIdDao, createWeaponNodeMutationDao } from "../src/dao/nodeDao.js";
import { isMapMemberDao, getMapByInternalIdDao } from "../src/dao/mapsDao.js";
import {
  getLastAttackDao,
  applyDamageDao,
  logAttackDao,
  getAttackHistoryByNodeDao,
} from "../src/dao/attackDao.js";
import {
  attackNodeAbl,
  getAttackHistoryAbl,
  CannotAttackOwnNodeError,
  CanOnlyAttackOwnNodeError,
  NodeAlreadyDefeatedError,
  WeaponOnCooldownError,
} from "../src/abl/attackAbl.js";
import { ValidationError } from "../src/abl/errors.js";

// An attack always carries the attacker's real objection now — every
// call below that isn't specifically testing that validation supplies
// this so the older "is this attack allowed" checks are still reachable.
const validContent = { type: "Problem" as const, text: "This has a real issue" };

// attackNodeAbl's own membership + discussionMode check both come off one
// getMapByInternalIdDao fetch now — this is the "normal rules, both
// attacker1 and victim1 are members" default every test below starts from
// unless it's specifically testing membership or discussion mode.
const normalMap = { members: ["attacker1", "victim1"], discussionMode: false };

vi.mock("../src/dao/nodeDao.js", () => ({
  findNodeByPublicIdDao: vi.fn(),
  createWeaponNodeMutationDao: vi.fn(),
}));
vi.mock("../src/dao/mapsDao.js", () => ({
  isMapMemberDao: vi.fn(),
  getMapByInternalIdDao: vi.fn(),
}));
vi.mock("../src/dao/attackDao.js", () => ({
  getLastAttackDao: vi.fn(),
  applyDamageDao: vi.fn(),
  logAttackDao: vi.fn(),
  getAttackHistoryByNodeDao: vi.fn(),
}));

describe("attackAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("attackNodeAbl", () => {
    it("returns null when the node doesn't exist", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue(null as never);

      const result = await attackNodeAbl("node1", "attacker1", "nitpick", validContent);

      expect(result).toBeNull();
      expect(getMapByInternalIdDao).not.toHaveBeenCalled();
    });

    it("returns null when the map can't be found", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "victim1", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(null as never);

      const result = await attackNodeAbl("node1", "attacker1", "nitpick", validContent);

      expect(result).toBeNull();
      expect(applyDamageDao).not.toHaveBeenCalled();
    });

    it("returns null when the attacker isn't a map member", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "victim1", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue({
        members: ["someoneElse"], discussionMode: false,
      } as never);

      const result = await attackNodeAbl("node1", "attacker1", "nitpick", validContent);

      expect(result).toBeNull();
      expect(applyDamageDao).not.toHaveBeenCalled();
    });

    it("rejects attacking your own node", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "attacker1", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);

      await expect(
        attackNodeAbl("node1", "attacker1", "nitpick", validContent),
      ).rejects.toThrow(CannotAttackOwnNodeError);
    });

    it("rejects attacking an already-defeated node", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "victim1", defeated: true, health: 0,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);

      await expect(
        attackNodeAbl("node1", "attacker1", "nitpick", validContent),
      ).rejects.toThrow(NodeAlreadyDefeatedError);
    });

    // Map.discussionMode inverts the own-node rule — see attackAbl.ts.
    // Attacking itself is never disabled, only who it can land on.
    it("in discussion mode, rejects attacking someone else's node", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "victim1", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue({
        members: ["attacker1", "victim1"], discussionMode: true,
      } as never);

      await expect(
        attackNodeAbl("node1", "attacker1", "nitpick", validContent),
      ).rejects.toThrow(CanOnlyAttackOwnNodeError);
    });

    it("in discussion mode, allows attacking your own node", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "attacker1", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue({
        members: ["attacker1"], discussionMode: true,
      } as never);
      vi.mocked(applyDamageDao).mockResolvedValue({ _id: "n1", health: 90, defeated: false } as never);
      vi.mocked(createWeaponNodeMutationDao).mockResolvedValue({ nodeId: "w1" } as never);

      const result = await attackNodeAbl("node1", "attacker1", "nitpick", validContent);

      expect(result).not.toBeNull();
      expect(applyDamageDao).toHaveBeenCalledWith("n1", 90, false);
    });

    it("deals damage, logs the attack, spawns a weapon node, and returns both", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "victim1", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);
      vi.mocked(applyDamageDao).mockResolvedValue({
        _id: "n1", health: 90, defeated: false,
      } as never);
      vi.mocked(createWeaponNodeMutationDao).mockResolvedValue({
        nodeId: "w1", isWeapon: true, weaponIcon: "sword",
      } as never);

      const result = await attackNodeAbl("node1", "attacker1", "nitpick", validContent);

      expect(applyDamageDao).toHaveBeenCalledWith("n1", 90, false);
      expect(logAttackDao).toHaveBeenCalledWith({
        mapId: "m1", targetNodeId: "n1", attackerId: "attacker1", weapon: "nitpick", damage: 10,
      });
      expect(createWeaponNodeMutationDao).toHaveBeenCalledWith("m1", {
        targetNodeId: "n1",
        weaponIcon: "sword",
        type: "Problem",
        text: "This has a real issue",
        userId: "attacker1",
      });
      expect(result).toEqual({
        node: { _id: "n1", health: 90, defeated: false },
        weaponNode: { nodeId: "w1", isWeapon: true, weaponIcon: "sword" },
      });
    });

    it("maps each combat weapon to its own icon", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "victim1", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);
      vi.mocked(getLastAttackDao).mockResolvedValue(null as never);
      vi.mocked(applyDamageDao).mockResolvedValue({} as never);
      vi.mocked(createWeaponNodeMutationDao).mockResolvedValue({} as never);

      await attackNodeAbl("node1", "attacker1", "counterpoint", validContent);
      expect(createWeaponNodeMutationDao).toHaveBeenCalledWith(
        "m1",
        expect.objectContaining({ weaponIcon: "axe" }),
      );

      await attackNodeAbl("node1", "attacker1", "fatalFlaw", validContent);
      expect(createWeaponNodeMutationDao).toHaveBeenCalledWith(
        "m1",
        expect.objectContaining({ weaponIcon: "spear" }),
      );
    });

    it("health can't drop below 0, and the node becomes defeated", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "victim1", defeated: false, health: 10,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);
      vi.mocked(getLastAttackDao).mockResolvedValue(null as never); // fatalFlaw has a cooldown
      vi.mocked(applyDamageDao).mockResolvedValue({
        _id: "n1", health: 0, defeated: true,
      } as never);

      await attackNodeAbl("node1", "attacker1", "fatalFlaw", validContent); // 50 damage vs 10 health

      expect(applyDamageDao).toHaveBeenCalledWith("n1", 0, true);
    });

    it("blocks a weapon that's still on cooldown", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "victim1", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);
      vi.mocked(getLastAttackDao).mockResolvedValue({ createdAt: new Date() } as never);

      await expect(
        attackNodeAbl("node1", "attacker1", "counterpoint", validContent),
      ).rejects.toThrow(WeaponOnCooldownError);
      expect(applyDamageDao).not.toHaveBeenCalled();
    });

    it("allows the attack once the cooldown has elapsed", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "victim1", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);
      const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      vi.mocked(getLastAttackDao).mockResolvedValue({ createdAt: anHourAgo } as never);
      vi.mocked(applyDamageDao).mockResolvedValue({
        _id: "n1", health: 75, defeated: false,
      } as never);
      vi.mocked(createWeaponNodeMutationDao).mockResolvedValue({ nodeId: "w2" } as never);

      const result = await attackNodeAbl("node1", "attacker1", "counterpoint", validContent);

      expect(result!.node).toEqual({ _id: "n1", health: 75, defeated: false });
      expect(result!.weaponNode).toEqual({ nodeId: "w2" });
    });

    // Content is validated before anything touches the database — same
    // "cheap checks first" convention edgeAbl/nodeAbl already follow.
    it("rejects a missing/empty text before looking anything up", async () => {
      await expect(
        attackNodeAbl("node1", "attacker1", "nitpick", { type: "Problem", text: "" }),
      ).rejects.toThrow(ValidationError);
      expect(findNodeByPublicIdDao).not.toHaveBeenCalled();
    });

    it("rejects a type outside the three attack-node types", async () => {
      await expect(
        attackNodeAbl("node1", "attacker1", "nitpick", { type: "Success", text: "Nice try" }),
      ).rejects.toThrow(ValidationError);
      expect(findNodeByPublicIdDao).not.toHaveBeenCalled();
    });
  });

  describe("getAttackHistoryAbl", () => {
    it("returns null when the caller isn't a map member", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({ _id: "n1", mapId: "m1" } as never);
      vi.mocked(isMapMemberDao).mockResolvedValue(false as never);

      const result = await getAttackHistoryAbl("node1", "user1");

      expect(result).toBeNull();
      expect(getAttackHistoryByNodeDao).not.toHaveBeenCalled();
    });

    it("returns the node's attack history for a member", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({ _id: "n1", mapId: "m1" } as never);
      vi.mocked(isMapMemberDao).mockResolvedValue(true as never);
      vi.mocked(getAttackHistoryByNodeDao).mockResolvedValue([{ weapon: "nitpick" }] as never);

      const result = await getAttackHistoryAbl("node1", "user1");

      expect(getAttackHistoryByNodeDao).toHaveBeenCalledWith("n1");
      expect(result).toEqual([{ weapon: "nitpick" }]);
    });
  });
});
