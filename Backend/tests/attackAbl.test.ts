import { describe, beforeEach, it, expect, vi } from "vitest";
import { findNodeByPublicIdDao, findNodeByInternalIdDao, createWeaponNodeMutationDao } from "../src/dao/nodeDao.js";
import { isMapMemberDao, getMapByInternalIdDao } from "../src/dao/mapsDao.js";
import { applyDamageDao, logAttackDao, healNodeDao, getAttackHistoryByNodeDao } from "../src/dao/attackDao.js";
import { attackNodeAbl, getAttackHistoryAbl } from "../src/abl/attackAbl.js";
import { ValidationError } from "../src/abl/errors.js";

// An attack always carries the attacker's real objection now — every
// call below that isn't specifically testing validation supplies this so
// the "does this attack actually land" checks are still reachable.
const validContent = { type: "Problem" as const, text: "This has a real issue" };

// attackNodeAbl's own membership check comes off this same
// getMapByInternalIdDao fetch — this is the "both attacker1 and victim1
// are members" default every test below starts from unless it's
// specifically testing membership.
const normalMap = { members: ["attacker1", "victim1"] };

vi.mock("../src/dao/nodeDao.js", () => ({
  findNodeByPublicIdDao: vi.fn(),
  findNodeByInternalIdDao: vi.fn(),
  createWeaponNodeMutationDao: vi.fn(),
}));
vi.mock("../src/dao/mapsDao.js", () => ({
  isMapMemberDao: vi.fn(),
  getMapByInternalIdDao: vi.fn(),
}));
vi.mock("../src/dao/attackDao.js", () => ({
  applyDamageDao: vi.fn(),
  logAttackDao: vi.fn(),
  healNodeDao: vi.fn(),
  getAttackHistoryByNodeDao: vi.fn(),
}));

describe("attackAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("attackNodeAbl — combat is fully open (no own-node rule, no weapon-node exclusion, no already-defeated block, no cooldowns)", () => {
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
      vi.mocked(getMapByInternalIdDao).mockResolvedValue({ members: ["someoneElse"] } as never);

      const result = await attackNodeAbl("node1", "attacker1", "nitpick", validContent);

      expect(result).toBeNull();
      expect(applyDamageDao).not.toHaveBeenCalled();
    });

    it("allows attacking a node you don't own", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "victim1", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);
      vi.mocked(applyDamageDao).mockResolvedValue({ _id: "n1", health: 90, defeated: false } as never);
      vi.mocked(createWeaponNodeMutationDao).mockResolvedValue({ nodeId: "w1" } as never);

      const result = await attackNodeAbl("node1", "attacker1", "nitpick", validContent);

      expect(result).not.toBeNull();
      expect(applyDamageDao).toHaveBeenCalledWith("n1", 90, false);
    });

    it("allows attacking your own node", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "attacker1", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);
      vi.mocked(applyDamageDao).mockResolvedValue({ _id: "n1", health: 90, defeated: false } as never);
      vi.mocked(createWeaponNodeMutationDao).mockResolvedValue({ nodeId: "w1" } as never);

      const result = await attackNodeAbl("node1", "attacker1", "nitpick", validContent);

      expect(result).not.toBeNull();
      expect(applyDamageDao).toHaveBeenCalledWith("n1", 90, false);
    });

    it("allows attacking an already-defeated node", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "victim1", defeated: true, health: 0,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);
      vi.mocked(applyDamageDao).mockResolvedValue({ _id: "n1", health: 0, defeated: true } as never);
      vi.mocked(createWeaponNodeMutationDao).mockResolvedValue({ nodeId: "w1" } as never);

      const result = await attackNodeAbl("node1", "attacker1", "nitpick", validContent);

      expect(result).not.toBeNull();
      // Health was already 0 — clamped, not driven negative.
      expect(applyDamageDao).toHaveBeenCalledWith("n1", 0, true);
    });

    it("allows attacking a weapon node with no target of its own — heals nothing", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "w1", mapId: "m1", userId: "attacker1", isWeapon: true, targetNodeId: null, defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);
      vi.mocked(applyDamageDao).mockResolvedValue({ _id: "w1", health: 90, defeated: false } as never);
      vi.mocked(createWeaponNodeMutationDao).mockResolvedValue({ nodeId: "w2" } as never);

      const result = await attackNodeAbl("weapon1", "victim1", "nitpick", validContent);

      expect(findNodeByInternalIdDao).not.toHaveBeenCalled();
      expect(applyDamageDao).toHaveBeenCalledWith("w1", 90, false);
      expect(healNodeDao).not.toHaveBeenCalled();
      expect(result!.healedParent).toBeNull();
    });

    it("attacking a weapon node heals its own target's parent, for any attacker — not just the one it hit", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "w1", mapId: "m1", userId: "attacker1", isWeapon: true, targetNodeId: "n2", defeated: false, health: 100,
      } as never);
      // n2 (the node w1 actually hit) belongs to someone else entirely —
      // this attacker ("someoneElse", a map member but neither w1's owner
      // nor n2's owner) still lands the hit and still heals n2's parent.
      vi.mocked(getMapByInternalIdDao).mockResolvedValue({
        members: ["attacker1", "victim1", "someoneElse"],
      } as never);
      vi.mocked(findNodeByInternalIdDao).mockResolvedValue({
        _id: "n2", userId: "victim1", parentId: "n-parent",
      } as never);
      vi.mocked(applyDamageDao).mockResolvedValue({ _id: "w1", health: 90, defeated: false } as never);
      vi.mocked(createWeaponNodeMutationDao).mockResolvedValue({ nodeId: "w2" } as never);
      vi.mocked(healNodeDao).mockResolvedValue({ _id: "n-parent", health: 60 } as never);

      const result = await attackNodeAbl("weapon1", "someoneElse", "nitpick", validContent);

      expect(applyDamageDao).toHaveBeenCalledWith("w1", 90, false);
      expect(healNodeDao).toHaveBeenCalledWith("n-parent", 10);
      expect(result!.healedParent).toEqual({ _id: "n-parent", health: 60 });
    });

    it("attacking a weapon that hit a root node (no parent) heals nothing", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "w1", mapId: "m1", userId: "attacker1", isWeapon: true, targetNodeId: "n2", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);
      vi.mocked(findNodeByInternalIdDao).mockResolvedValue({
        _id: "n2", userId: "victim1", parentId: null,
      } as never);
      vi.mocked(applyDamageDao).mockResolvedValue({ _id: "w1", health: 90, defeated: false } as never);
      vi.mocked(createWeaponNodeMutationDao).mockResolvedValue({ nodeId: "w2" } as never);

      const result = await attackNodeAbl("weapon1", "victim1", "nitpick", validContent);

      expect(healNodeDao).not.toHaveBeenCalled();
      expect(result!.healedParent).toBeNull();
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
        // The target here is an ordinary content node, not a weapon node —
        // nothing gets healed.
        healedParent: null,
      });
      expect(healNodeDao).not.toHaveBeenCalled();
    });

    it("maps each combat weapon to its own icon", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "victim1", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);
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
      vi.mocked(applyDamageDao).mockResolvedValue({
        _id: "n1", health: 0, defeated: true,
      } as never);

      await attackNodeAbl("node1", "attacker1", "fatalFlaw", validContent); // 50 damage vs 10 health

      expect(applyDamageDao).toHaveBeenCalledWith("n1", 0, true);
    });

    // No cooldown check left at all — landing the same weapon twice in a
    // row (previously blocked, WeaponOnCooldownError) now just lands
    // twice.
    it("allows the same weapon to land twice in a row, with no cooldown in between", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "victim1", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);
      vi.mocked(applyDamageDao).mockResolvedValue({ _id: "n1", health: 75, defeated: false } as never);
      vi.mocked(createWeaponNodeMutationDao).mockResolvedValue({ nodeId: "w2" } as never);

      await attackNodeAbl("node1", "attacker1", "counterpoint", validContent);
      const result = await attackNodeAbl("node1", "attacker1", "counterpoint", validContent);

      expect(applyDamageDao).toHaveBeenCalledTimes(2);
      expect(result!.node).toEqual({ _id: "n1", health: 75, defeated: false });
    });

    // Content is validated before anything touches the database — same
    // "cheap checks first" convention edgeAbl/nodeAbl already follow.
    it("rejects a missing/empty text before looking anything up", async () => {
      await expect(
        attackNodeAbl("node1", "attacker1", "nitpick", { type: "Problem", text: "" }),
      ).rejects.toThrow(ValidationError);
      expect(findNodeByPublicIdDao).not.toHaveBeenCalled();
    });

    // Every outcome type is a valid attack-node type now (retaliation is
    // naturally a positive claim — see ATTACK_NODE_TYPES's own doc
    // comment), "unknown" alone stays excluded: it draws no ring/framing
    // at all, so it never reads as an attack's own claim one way or the
    // other.
    it("rejects 'unknown' as an attack-node type", async () => {
      await expect(
        attackNodeAbl("node1", "attacker1", "nitpick", { type: "unknown", text: "Nice try" }),
      ).rejects.toThrow(ValidationError);
      expect(findNodeByPublicIdDao).not.toHaveBeenCalled();
    });

    it("accepts a positive outcome type as an attack-node type", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "attacker1", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);
      vi.mocked(applyDamageDao).mockResolvedValue({ _id: "n1", health: 90, defeated: false } as never);
      vi.mocked(createWeaponNodeMutationDao).mockResolvedValue({ nodeId: "w1" } as never);

      const result = await attackNodeAbl("node1", "attacker1", "nitpick", {
        type: "Solution",
        text: "My defense holds",
      });

      expect(createWeaponNodeMutationDao).toHaveBeenCalledWith(
        "m1",
        expect.objectContaining({ type: "Solution" }),
      );
      expect(result).not.toBeNull();
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
