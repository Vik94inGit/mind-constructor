import { describe, beforeEach, it, expect, vi } from "vitest";
import { findNodeByPublicIdDao, findNodeByInternalIdDao, createWeaponNodeMutationDao } from "../src/dao/nodeDao.js";
import { isMapMemberDao, getMapByInternalIdDao } from "../src/dao/mapsDao.js";
import {
  getLastAttackDao,
  applyDamageDao,
  logAttackDao,
  healNodeDao,
  getAttackHistoryByNodeDao,
} from "../src/dao/attackDao.js";
import {
  attackNodeAbl,
  getAttackHistoryAbl,
  CanOnlyAttackOwnNodeError,
  CannotRetaliateError,
  NodeAlreadyDefeatedError,
  WeaponOnCooldownError,
} from "../src/abl/attackAbl.js";
import { ValidationError } from "../src/abl/errors.js";

// An attack always carries the attacker's real objection now — every
// call below that isn't specifically testing that validation supplies
// this so the older "is this attack allowed" checks are still reachable.
const validContent = { type: "Problem" as const, text: "This has a real issue" };

// attackNodeAbl's own membership check comes off this same
// getMapByInternalIdDao fetch — this is the "both attacker1 and victim1 are
// members" default every test below starts from unless it's specifically
// testing membership. discussionMode is deliberately false here to prove
// it no longer affects the (now unconditional) own-node rule.
const normalMap = { members: ["attacker1", "victim1"], discussionMode: false };

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
  getLastAttackDao: vi.fn(),
  applyDamageDao: vi.fn(),
  logAttackDao: vi.fn(),
  healNodeDao: vi.fn(),
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

    it("rejects attacking someone else's node — only your own node is a valid target", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "victim1", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);

      await expect(
        attackNodeAbl("node1", "attacker1", "nitpick", validContent),
      ).rejects.toThrow(CanOnlyAttackOwnNodeError);
    });

    // Retaliation: the one case a weapon node can be attacked at all — see
    // CannotRetaliateError's own doc comment in attackAbl.ts.
    it("rejects retaliating against a weapon node with no target of its own", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "w1", mapId: "m1", userId: "attacker1", isWeapon: true, targetNodeId: null, defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);

      await expect(
        attackNodeAbl("weapon1", "victim1", "nitpick", validContent),
      ).rejects.toThrow(CannotRetaliateError);
      expect(findNodeByInternalIdDao).not.toHaveBeenCalled();
      expect(applyDamageDao).not.toHaveBeenCalled();
    });

    it("rejects retaliating against a weapon node that targeted someone else's node", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "w1", mapId: "m1", userId: "attacker1", isWeapon: true, targetNodeId: "n2", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);
      // n2 belongs to someone other than victim1, the one trying to retaliate.
      vi.mocked(findNodeByInternalIdDao).mockResolvedValue({
        _id: "n2", userId: "someoneElse", parentId: null,
      } as never);

      await expect(
        attackNodeAbl("weapon1", "victim1", "nitpick", validContent),
      ).rejects.toThrow(CannotRetaliateError);
      expect(applyDamageDao).not.toHaveBeenCalled();
    });

    it("allows retaliating against the weapon node that hit your own node, and heals its parent", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "w1", mapId: "m1", userId: "attacker1", isWeapon: true, targetNodeId: "n2", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);
      // n2 (the node the weapon actually hit) belongs to victim1, the one
      // retaliating here, and itself branches off n-parent.
      vi.mocked(findNodeByInternalIdDao).mockResolvedValue({
        _id: "n2", userId: "victim1", parentId: "n-parent",
      } as never);
      vi.mocked(applyDamageDao).mockResolvedValue({ _id: "w1", health: 90, defeated: false } as never);
      vi.mocked(createWeaponNodeMutationDao).mockResolvedValue({ nodeId: "w2" } as never);
      vi.mocked(healNodeDao).mockResolvedValue({ _id: "n-parent", health: 60 } as never);

      const result = await attackNodeAbl("weapon1", "victim1", "nitpick", validContent);

      // Retaliation bypasses the normal own-node rule entirely — no
      // discussion-mode/own-node error, even though w1.userId
      // ("attacker1") isn't victim1.
      expect(applyDamageDao).toHaveBeenCalledWith("w1", 90, false);
      expect(healNodeDao).toHaveBeenCalledWith("n-parent", 10);
      expect(result!.healedParent).toEqual({ _id: "n-parent", health: 60 });
    });

    it("retaliating against a weapon that hit a root node (no parent) heals nothing", async () => {
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

    it("rejects attacking an already-defeated node", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "attacker1", defeated: true, health: 0,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);

      await expect(
        attackNodeAbl("node1", "attacker1", "nitpick", validContent),
      ).rejects.toThrow(NodeAlreadyDefeatedError);
    });

    // The own-node rule is now the app's only combat rule, unconditionally —
    // Map.discussionMode no longer branches this (see attackAbl.ts's own
    // comment). `normalMap` below still carries discussionMode: false to
    // prove the stored flag's value is irrelevant to the outcome.
    it("rejects attacking someone else's node regardless of Map.discussionMode", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "victim1", defeated: false, health: 100,
      } as never);
      vi.mocked(getMapByInternalIdDao).mockResolvedValue(normalMap as never);

      await expect(
        attackNodeAbl("node1", "attacker1", "nitpick", validContent),
      ).rejects.toThrow(CanOnlyAttackOwnNodeError);
    });

    it("allows attacking your own node regardless of Map.discussionMode", async () => {
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

    it("deals damage, logs the attack, spawns a weapon node, and returns both", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "attacker1", defeated: false, health: 100,
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
        // Not a retaliation (the target here is an ordinary content node,
        // not a weapon node) — nothing gets healed.
        healedParent: null,
      });
      expect(healNodeDao).not.toHaveBeenCalled();
    });

    it("maps each combat weapon to its own icon", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "n1", mapId: "m1", userId: "attacker1", defeated: false, health: 100,
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
        _id: "n1", mapId: "m1", userId: "attacker1", defeated: false, health: 10,
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
        _id: "n1", mapId: "m1", userId: "attacker1", defeated: false, health: 100,
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
        _id: "n1", mapId: "m1", userId: "attacker1", defeated: false, health: 100,
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
