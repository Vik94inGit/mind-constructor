import { describe, beforeEach, it, expect, vi } from "vitest";
import { Node } from "../src/models/Node.js";
import { Edge } from "../src/models/Edge.js";
import { deleteNodeDao, incrementBlockedDamageDao } from "../src/dao/nodeDao.js";

vi.mock("../src/models/Node.js", () => ({
  Node: {
    findOneAndDelete: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    updateMany: vi.fn().mockResolvedValue(undefined),
    deleteMany: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("../src/models/Edge.js", () => ({
  Edge: { deleteMany: vi.fn().mockResolvedValue(undefined) },
}));

// findByIdAndUpdate(...).populate(...) — a real Mongoose Query stays
// chainable across populate() and is itself thenable, same pattern
// attackDao.test.ts's own applyDamageDao test already uses.
function populatedQuery(result: unknown) {
  return { populate: vi.fn().mockResolvedValue(result) } as never;
}

describe("nodeDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deleteNodeDao", () => {
    it("returns null when the node doesn't exist or isn't owned by the caller", async () => {
      vi.mocked(Node.findOneAndDelete).mockResolvedValue(null as never);

      const result = await deleteNodeDao("node1", "user1");

      expect(result).toBeNull();
      expect(Node.findById).not.toHaveBeenCalled();
    });

    it("skips the damage-release step for a plain (non-protection) node", async () => {
      vi.mocked(Node.findOneAndDelete).mockResolvedValue({
        _id: "n1", isProtection: false, protectsNodeId: null, blockedDamage: 0,
      } as never);

      const result = await deleteNodeDao("node1", "user1");

      expect(Node.findById).not.toHaveBeenCalled();
      expect(result).toEqual({ node: expect.objectContaining({ _id: "n1" }), damagedProtectedNode: null });
      // The usual cascade still runs regardless.
      expect(Edge.deleteMany).toHaveBeenCalled();
      expect(Node.updateMany).toHaveBeenCalledWith({ parentId: "n1" }, { $set: { parentId: null } });
    });

    it("skips the damage-release step for a protection node with nothing banked", async () => {
      vi.mocked(Node.findOneAndDelete).mockResolvedValue({
        _id: "shield1", isProtection: true, protectsNodeId: "target1", blockedDamage: 0,
      } as never);

      const result = await deleteNodeDao("shield1", "owner1");

      expect(Node.findById).not.toHaveBeenCalled();
      expect(result!.damagedProtectedNode).toBeNull();
    });

    it("releases the protector's whole banked blockedDamage onto the node it defended", async () => {
      vi.mocked(Node.findOneAndDelete).mockResolvedValue({
        _id: "shield1", isProtection: true, protectsNodeId: "target1", blockedDamage: 35,
      } as never);
      vi.mocked(Node.findById).mockResolvedValue({ _id: "target1", health: 60 } as never);
      const damagedNode = { _id: "target1", health: 25, defeated: false };
      vi.mocked(Node.findByIdAndUpdate).mockReturnValue(populatedQuery(damagedNode));

      const result = await deleteNodeDao("shield1", "owner1");

      expect(Node.findById).toHaveBeenCalledWith("target1");
      expect(Node.findByIdAndUpdate).toHaveBeenCalledWith(
        "target1",
        { $set: { health: 25, defeated: false } },
        { new: true },
      );
      expect(result!.damagedProtectedNode).toEqual(damagedNode);
    });

    it("floors the release at 0 health and marks the target defeated", async () => {
      vi.mocked(Node.findOneAndDelete).mockResolvedValue({
        _id: "shield1", isProtection: true, protectsNodeId: "target1", blockedDamage: 999,
      } as never);
      vi.mocked(Node.findById).mockResolvedValue({ _id: "target1", health: 40 } as never);
      vi.mocked(Node.findByIdAndUpdate).mockReturnValue(populatedQuery({ _id: "target1", health: 0, defeated: true }));

      await deleteNodeDao("shield1", "owner1");

      expect(Node.findByIdAndUpdate).toHaveBeenCalledWith(
        "target1",
        { $set: { health: 0, defeated: true } },
        { new: true },
      );
    });

    it("skips the release when the protected node was itself already deleted", async () => {
      vi.mocked(Node.findOneAndDelete).mockResolvedValue({
        _id: "shield1", isProtection: true, protectsNodeId: "target1", blockedDamage: 20,
      } as never);
      vi.mocked(Node.findById).mockResolvedValue(null as never);

      const result = await deleteNodeDao("shield1", "owner1");

      expect(Node.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(result!.damagedProtectedNode).toBeNull();
    });
  });

  describe("incrementBlockedDamageDao", () => {
    it("increments the protector's own blockedDamage by the given amount", async () => {
      const updated = { _id: "shield1", blockedDamage: 60 };
      vi.mocked(Node.findByIdAndUpdate).mockReturnValue(populatedQuery(updated));

      const result = await incrementBlockedDamageDao("shield1", 25);

      expect(Node.findByIdAndUpdate).toHaveBeenCalledWith(
        "shield1",
        { $inc: { blockedDamage: 25 } },
        { new: true },
      );
      expect(result).toEqual(updated);
    });
  });
});
