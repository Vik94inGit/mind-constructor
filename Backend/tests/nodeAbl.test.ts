import { describe, beforeEach, it, expect, vi } from "vitest";
import { getMapByIdDao, getMapByInternalIdDao } from "../src/dao/mapsDao.js";
import {
  createNodeMutationDao,
  countNodesByMapInternalIdDao,
  updateNodeDao,
  findNodeByPublicIdDao,
  setBranchHiddenMutationDao,
  zoneColorTakenDao,
  moveNodesDao,
} from "../src/dao/nodeDao.js";
import { getHiddenNodesDao } from "../src/dao/visibilityDao.js";
import {
  createNodeAbl,
  updateNodeAbl,
  moveNodesAbl,
  setBranchHiddenAbl,
  NotMapOwnerError,
  MapNotFoundError,
  ParentNotFoundError,
  CrossMapParentError,
  ParentNotOwnedError,
  SelfParentError,
  ZoneColorTakenError,
} from "../src/abl/nodeAbl.js";
import { ValidationError } from "../src/abl/errors.js";
import { createImageDao, findNodeImageIdsDao, deleteNodeImagesExceptDao } from "../src/dao/imageDao.js";

vi.mock("../src/dao/mapsDao.js", () => ({
  getMapByIdDao: vi.fn(),
  getMapByInternalIdDao: vi.fn(),
}));
vi.mock("../src/dao/nodeDao.js", () => ({
  createNodeMutationDao: vi.fn(),
  countNodesByMapInternalIdDao: vi.fn(),
  updateNodeDao: vi.fn(),
  zoneColorTakenDao: vi.fn(),
  findNodeByPublicIdDao: vi.fn(),
  setBranchHiddenMutationDao: vi.fn(),
  moveNodesDao: vi.fn(),
}));
vi.mock("../src/dao/visibilityDao.js", () => ({
  getHiddenNodesDao: vi.fn(),
}));

vi.mock("../src/dao/imageDao.js", () => ({
  createImageDao: vi.fn(),
  findNodeImageIdsDao: vi.fn(),
  deleteNodeImagesExceptDao: vi.fn(),
}));

// The node a picture edit is made on, owned by user1.
const pictureNode = { _id: "n1", mapId: "m1", userId: "user1", images: [], iconImage: "", cardImage: "" };
function mockImageStore(known: string[] = []) {
  let next = 0;
  vi.mocked(findNodeByPublicIdDao).mockResolvedValue(pictureNode as never);
  vi.mocked(createImageDao).mockImplementation(async () => `/api/images/stored0000${++next}`);
  vi.mocked(findNodeImageIdsDao).mockImplementation(async (_n, ids) => new Set(ids.filter((id) => known.includes(id))));
}

describe("nodeAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createNodeAbl", () => {
    it("rejects a missing text", async () => {
      await expect(
        createNodeAbl({ type: "Problem" }, "pub123", "user1"),
      ).rejects.toThrow(ValidationError);
      expect(getMapByIdDao).not.toHaveBeenCalled();
    });

    it("accepts an empty text — a node sketched first and written later", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "m1" } as never);
      vi.mocked(countNodesByMapInternalIdDao).mockResolvedValue(1 as never);
      vi.mocked(createNodeMutationDao).mockResolvedValue({ nodeId: "n1" } as never);

      await createNodeAbl({ text: "", type: "Option", prompt: "  What could go wrong?  " }, "pub123", "user1");

      const created = vi.mocked(createNodeMutationDao).mock.calls[0][1];
      expect(created.text).toBe("");
      expect(created.ghost).toBe(true);
      expect(created.prompt).toBe("What could go wrong?");
    });

    it("rejects an invalid order at creation too", async () => {
      await expect(
        createNodeAbl({ text: "Step", type: "Option", order: 0 }, "pub123", "user1"),
      ).rejects.toThrow(ValidationError);
      expect(getMapByIdDao).not.toHaveBeenCalled();
    });

    it("rejects a missing or invalid type — mandatory on purpose", async () => {
      await expect(
        createNodeAbl({ text: "Ship it" }, "pub123", "user1"),
      ).rejects.toThrow(ValidationError);

      await expect(
        createNodeAbl({ text: "Ship it", type: "NotARealType" }, "pub123", "user1"),
      ).rejects.toThrow(ValidationError);
    });

    it("throws MapNotFoundError when the caller isn't a map member", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue(null as never);

      await expect(
        createNodeAbl({ text: "Ship it", type: "Problem" }, "pub123", "user1"),
      ).rejects.toThrow(MapNotFoundError);
      expect(createNodeMutationDao).not.toHaveBeenCalled();
    });

    it("computes isFirstNode from the map's current node count", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "m1" } as never);
      vi.mocked(countNodesByMapInternalIdDao).mockResolvedValue(0 as never);
      vi.mocked(createNodeMutationDao).mockResolvedValue({ nodeId: "n1" } as never);

      await createNodeAbl({ text: "Ship it", type: "Problem" }, "pub123", "user1");

      expect(countNodesByMapInternalIdDao).toHaveBeenCalledWith("m1");
      expect(createNodeMutationDao).toHaveBeenCalledWith("m1", {
        text: "Ship it",
        type: "Problem",
        userId: "user1",
        isFirstNode: true,
        ghost: false,
        parentId: null,
      });
      expect(findNodeByPublicIdDao).not.toHaveBeenCalled();
    });

    it("isFirstNode is false once the map already has nodes", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "m1" } as never);
      vi.mocked(countNodesByMapInternalIdDao).mockResolvedValue(3 as never);
      vi.mocked(createNodeMutationDao).mockResolvedValue({ nodeId: "n2" } as never);

      await createNodeAbl({ text: "Cut scope", type: "Option" }, "pub123", "user1");

      const callArg = vi.mocked(createNodeMutationDao).mock.calls[0][1];
      expect(callArg.isFirstNode).toBe(false);
    });

    // parentId arrives as a public nodeId and has to be resolved to the
    // parent's internal _id — same shape of rule (and same three failure
    // modes) as linking two nodes in edgeAbl.ts.
    it("resolves a public parentId to the parent's internal _id when branching from your own node", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "m1" } as never);
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "parentInternal1",
        mapId: "m1",
        userId: "user1",
      } as never);
      vi.mocked(countNodesByMapInternalIdDao).mockResolvedValue(1 as never);
      vi.mocked(createNodeMutationDao).mockResolvedValue({ nodeId: "n2" } as never);

      await createNodeAbl(
        { text: "Branch", type: "Option", parentId: "parentPublic1" },
        "pub123",
        "user1",
      );

      expect(findNodeByPublicIdDao).toHaveBeenCalledWith("parentPublic1");
      expect(createNodeMutationDao).toHaveBeenCalledWith("m1", {
        text: "Branch",
        type: "Option",
        userId: "user1",
        isFirstNode: false,
        ghost: false,
        parentId: "parentInternal1",
      });
    });

    it("throws ParentNotFoundError when parentId doesn't resolve to a real node", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "m1" } as never);
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue(null as never);

      await expect(
        createNodeAbl({ text: "Branch", type: "Option", parentId: "nope" }, "pub123", "user1"),
      ).rejects.toThrow(ParentNotFoundError);
      expect(createNodeMutationDao).not.toHaveBeenCalled();
    });

    it("throws CrossMapParentError when the parent belongs to a different map", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "m1" } as never);
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "parentInternal1",
        mapId: "some-other-map",
        userId: "user1",
      } as never);

      await expect(
        createNodeAbl({ text: "Branch", type: "Option", parentId: "p1" }, "pub123", "user1"),
      ).rejects.toThrow(CrossMapParentError);
      expect(createNodeMutationDao).not.toHaveBeenCalled();
    });

    it("throws ParentNotOwnedError when the parent wasn't created by the caller", async () => {
      vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "m1" } as never);
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "parentInternal1",
        mapId: "m1",
        userId: "someoneElse",
      } as never);

      await expect(
        createNodeAbl({ text: "Branch", type: "Option", parentId: "p1" }, "pub123", "user1"),
      ).rejects.toThrow(ParentNotOwnedError);
      expect(createNodeMutationDao).not.toHaveBeenCalled();
    });
  });

  describe("updateNodeAbl", () => {
    it("rejects an empty update", async () => {
      await expect(updateNodeAbl("node1", "user1", {})).rejects.toThrow(ValidationError);
      expect(updateNodeDao).not.toHaveBeenCalled();
    });

    it("rejects an invalid type", async () => {
      await expect(
        updateNodeAbl("node1", "user1", { type: "NotARealType" }),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects an invalid symbolOverride", async () => {
      await expect(
        updateNodeAbl("node1", "user1", { symbolOverride: "star" }),
      ).rejects.toThrow(ValidationError);
      expect(updateNodeDao).not.toHaveBeenCalled();
    });

    it("fills a ghost in when text is written, and leaves it alone otherwise", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { text: "Users churn" });
      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { text: "Users churn", ghost: false });

      await updateNodeAbl("node1", "user1", { prompt: "Why?" });
      expect(updateNodeDao).toHaveBeenLastCalledWith("node1", "user1", { prompt: "Why?" });
    });

    it("passes a zone name through, trimmed, and rejects one over 40 characters", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { zoneName: "  Marketing  " });
      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { zoneName: "Marketing" });

      await expect(
        updateNodeAbl("node1", "user1", { zoneName: "x".repeat(41) }),
      ).rejects.toThrow(ValidationError);
    });

    it("stores pictures in the image store and keeps only their addresses on the node", async () => {
      mockImageStore(["kept000001"]);
      vi.mocked(updateNodeDao).mockImplementation(async (_id, _u, updates) => ({ ...pictureNode, ...updates }) as never);
      const png = "data:image/png;base64,iVBORw0KGgo=";

      await updateNodeAbl("node1", "user1", { images: ["/api/images/kept000001", png] });

      expect(createImageDao).toHaveBeenCalledWith({
        mapId: "m1",
        nodeId: "n1",
        userId: "user1",
        mime: "image/png",
        data: Buffer.from("iVBORw0KGgo=", "base64"),
      });
      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", {
        images: ["/api/images/kept000001", "/api/images/stored00001"],
      });
      // Whatever the node no longer points at is deleted from the store.
      expect(deleteNodeImagesExceptDao).toHaveBeenCalledWith("n1", ["kept000001", "stored00001"]);
    });

    it("refuses a stored picture that isn't this node's, and anything that isn't a picture", async () => {
      mockImageStore();
      const png = "data:image/png;base64,iVBORw0KGgo=";

      await expect(updateNodeAbl("node1", "user1", { images: ["/api/images/someoneelse"] })).rejects.toThrow(
        "unknown picture",
      );
      await expect(updateNodeAbl("node1", "user1", { images: ["https://example.com/a.png"] })).rejects.toThrow(
        ValidationError,
      );
      await expect(updateNodeAbl("node1", "user1", { images: ["data:image/svg+xml;base64,PHN2Zz4="] })).rejects.toThrow(
        ValidationError,
      );
      await expect(updateNodeAbl("node1", "user1", { images: Array(7).fill(png) })).rejects.toThrow(ValidationError);
      expect(createImageDao).not.toHaveBeenCalled();
      expect(updateNodeDao).not.toHaveBeenCalled();
    });

    it("stores nothing for someone who doesn't own the node", async () => {
      mockImageStore();

      const result = await updateNodeAbl("node1", "user2", { images: ["data:image/png;base64,iVBORw0KGgo="] });

      expect(result).toBeNull();
      expect(createImageDao).not.toHaveBeenCalled();
      expect(updateNodeDao).not.toHaveBeenCalled();
    });

    it("passes an emoji through, \"\" to clear it, and refuses plain text", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { emoji: " 🔥 " });
      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { emoji: "🔥" });
      await updateNodeAbl("node1", "user1", { emoji: "👩‍💻" });
      await updateNodeAbl("node1", "user1", { emoji: "" });
      expect(updateNodeDao).toHaveBeenLastCalledWith("node1", "user1", { emoji: "" });

      await expect(updateNodeAbl("node1", "user1", { emoji: "ok" })).rejects.toThrow(ValidationError);
      await expect(updateNodeAbl("node1", "user1", { emoji: "🔥".repeat(20) })).rejects.toThrow(ValidationError);
    });

    it("passes a picture icon through, \"\" to clear it, and refuses a non-image or a too-large one", async () => {
      mockImageStore();
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);
      const jpeg = "data:image/jpeg;base64,/9j/4AAQ";

      await updateNodeAbl("node1", "user1", { iconImage: jpeg });
      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { iconImage: "/api/images/stored00001" });
      await updateNodeAbl("node1", "user1", { iconImage: "" });
      expect(updateNodeDao).toHaveBeenLastCalledWith("node1", "user1", { iconImage: "" });

      await expect(updateNodeAbl("node1", "user1", { iconImage: "https://x/y.png" })).rejects.toThrow(ValidationError);
      await expect(
        updateNodeAbl("node1", "user1", { iconImage: "data:image/jpeg;base64," + "A".repeat(40_000) }),
      ).rejects.toThrow(ValidationError);
    });

    it("passes a picture card through, \"\" to clear it, and refuses a non-image or a too-large one", async () => {
      mockImageStore();
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);
      const jpeg = "data:image/jpeg;base64,/9j/4AAQ";

      await updateNodeAbl("node1", "user1", { cardImage: jpeg });
      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { cardImage: "/api/images/stored00001" });
      await updateNodeAbl("node1", "user1", { cardImage: "" });
      expect(updateNodeDao).toHaveBeenLastCalledWith("node1", "user1", { cardImage: "" });

      await expect(updateNodeAbl("node1", "user1", { cardImage: "not an image" })).rejects.toThrow(ValidationError);
      await expect(
        updateNodeAbl("node1", "user1", { cardImage: "data:image/jpeg;base64," + "A".repeat(80_000) }),
      ).rejects.toThrow(ValidationError);
    });

    it("passes a valid symbolOverride through to the DAO", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { symbolOverride: "check" });

      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { symbolOverride: "check" });
    });

    it("passes explicit null through to clear symbolOverride back to the type's default", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { symbolOverride: null });

      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { symbolOverride: null });
    });

    it("passes a puzzle-card position through apart from x/y, and null to forget it", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { cardX: 120, cardY: 340 });
      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { cardX: 120, cardY: 340 });

      await updateNodeAbl("node1", "user1", { cardX: null, cardY: null });
      expect(updateNodeDao).toHaveBeenLastCalledWith("node1", "user1", { cardX: null, cardY: null });
    });

    it("passes a card's size, text size, shape and a still emoji through, and rejects out-of-range values", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { cardW: 220, cardH: 140, cardFont: 14, cardShape: "round", emojiStill: true });
      expect(updateNodeDao).toHaveBeenLastCalledWith("node1", "user1", {
        cardW: 220,
        cardH: 140,
        cardFont: 14,
        cardShape: "round",
        emojiStill: true,
      });
      await updateNodeAbl("node1", "user1", { cardW: null, cardH: null, cardFont: null, cardShape: null });
      expect(updateNodeDao).toHaveBeenLastCalledWith("node1", "user1", { cardW: null, cardH: null, cardFont: null, cardShape: null });

      await expect(updateNodeAbl("node1", "user1", { cardW: 5 })).rejects.toThrow(ValidationError);
      await expect(updateNodeAbl("node1", "user1", { cardFont: 100 })).rejects.toThrow(ValidationError);
      await expect(updateNodeAbl("node1", "user1", { cardShape: "star" })).rejects.toThrow(ValidationError);
    });

    it("passes a valid shape through, null back to the circle, and rejects anything else", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { shape: "triangle" });
      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { shape: "triangle" });
      await updateNodeAbl("node1", "user1", { shape: null });
      expect(updateNodeDao).toHaveBeenLastCalledWith("node1", "user1", { shape: null });

      await expect(updateNodeAbl("node1", "user1", { shape: "hexagon" })).rejects.toThrow(ValidationError);
    });

    it("passes a zone pattern and palette colour through, null back to the defaults, and rejects anything else", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { zonePattern: "chess", zoneColor: "sage" });
      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { zonePattern: "chess", zoneColor: "sage" });
      await updateNodeAbl("node1", "user1", { zonePattern: null, zoneColor: null });
      expect(updateNodeDao).toHaveBeenLastCalledWith("node1", "user1", { zonePattern: null, zoneColor: null });

      await expect(updateNodeAbl("node1", "user1", { zonePattern: "plaid" })).rejects.toThrow(ValidationError);
      await expect(updateNodeAbl("node1", "user1", { zoneColor: "#ff0000" })).rejects.toThrow(ValidationError);
    });

    it("passes a zone edge brightness from 0 to 1 through, null back to the default", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { zoneEdge: 0.8 });
      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { zoneEdge: 0.8 });
      await updateNodeAbl("node1", "user1", { zoneEdge: null });
      expect(updateNodeDao).toHaveBeenLastCalledWith("node1", "user1", { zoneEdge: null });

      await expect(updateNodeAbl("node1", "user1", { zoneEdge: 1.5 })).rejects.toThrow(ValidationError);
      await expect(updateNodeAbl("node1", "user1", { zoneEdge: "bright" })).rejects.toThrow(ValidationError);
    });

    it("rejects an order that isn't a whole number from 1 to 9999", async () => {
      for (const order of [0, -1, 1.5, 10000, "3"]) {
        await expect(updateNodeAbl("node1", "user1", { order })).rejects.toThrow(ValidationError);
      }
      expect(updateNodeDao).not.toHaveBeenCalled();
    });

    it("passes a valid order through, and explicit null to clear it", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { order: 3 });
      expect(updateNodeDao).toHaveBeenLastCalledWith("node1", "user1", { order: 3 });

      await updateNodeAbl("node1", "user1", { order: null });
      expect(updateNodeDao).toHaveBeenLastCalledWith("node1", "user1", { order: null });
    });

    it("refuses a zone colour another member's zones already wear", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({ _id: "n1", mapId: "m1", userId: "user1" } as never);
      vi.mocked(zoneColorTakenDao).mockResolvedValue(true);
      await expect(updateNodeAbl("node1", "user1", { zoneColor: "sky" })).rejects.toThrow(ZoneColorTakenError);
      expect(zoneColorTakenDao).toHaveBeenCalledWith("m1", "sky", "user1");
      expect(updateNodeDao).not.toHaveBeenCalled();
    });

    it("allows a free zone colour", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({ _id: "n1", mapId: "m1", userId: "user1" } as never);
      vi.mocked(zoneColorTakenDao).mockResolvedValue(false);
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);
      await updateNodeAbl("node1", "user1", { zoneColor: "sky" });
      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { zoneColor: "sky" });
    });

    it("passes only the provided fields through to the DAO", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { text: "Updated text" });

      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { text: "Updated text", ghost: false });
      // Read once, only for the discussion history (historyAbl.ts) — a text edit is recorded there.
      expect(findNodeByPublicIdDao).toHaveBeenCalledTimes(1);
    });

    // parentId used to be passed straight through unresolved here — a real
    // public nodeId always failed the ObjectId cast server-side. Same
    // resolution (and same three failure modes) createNodeAbl already does.
    it("resolves a public parentId to the parent's internal _id", async () => {
      vi.mocked(findNodeByPublicIdDao)
        .mockResolvedValueOnce({ _id: "parentInternal1", mapId: "m1", userId: "user1" } as never)
        .mockResolvedValueOnce({ _id: "nodeInternal1", mapId: "m1", userId: "user1" } as never);
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { parentId: "parentPublic1" });

      expect(findNodeByPublicIdDao).toHaveBeenNthCalledWith(1, "parentPublic1");
      expect(findNodeByPublicIdDao).toHaveBeenNthCalledWith(2, "node1");
      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { parentId: "parentInternal1" });
    });

    it("passes explicit null straight through to clear parentId, no lookup needed", async () => {
      vi.mocked(updateNodeDao).mockResolvedValue({ nodeId: "node1" } as never);

      await updateNodeAbl("node1", "user1", { parentId: null });

      expect(findNodeByPublicIdDao).not.toHaveBeenCalled();
      expect(updateNodeDao).toHaveBeenCalledWith("node1", "user1", { parentId: null });
    });

    it("throws SelfParentError when parentId is the node's own id", async () => {
      await expect(updateNodeAbl("node1", "user1", { parentId: "node1" })).rejects.toThrow(SelfParentError);
      expect(findNodeByPublicIdDao).not.toHaveBeenCalled();
      expect(updateNodeDao).not.toHaveBeenCalled();
    });

    it("throws ParentNotFoundError when parentId doesn't resolve to a real node", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue(null as never);

      await expect(updateNodeAbl("node1", "user1", { parentId: "nope" })).rejects.toThrow(ParentNotFoundError);
      expect(updateNodeDao).not.toHaveBeenCalled();
    });

    it("throws ParentNotOwnedError when the parent wasn't created by the caller", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({
        _id: "parentInternal1",
        mapId: "m1",
        userId: "someoneElse",
      } as never);

      await expect(updateNodeAbl("node1", "user1", { parentId: "p1" })).rejects.toThrow(ParentNotOwnedError);
      expect(updateNodeDao).not.toHaveBeenCalled();
    });

    it("throws CrossMapParentError when the parent belongs to a different map", async () => {
      vi.mocked(findNodeByPublicIdDao)
        .mockResolvedValueOnce({ _id: "parentInternal1", mapId: "map-a", userId: "user1" } as never)
        .mockResolvedValueOnce({ _id: "nodeInternal1", mapId: "map-b", userId: "user1" } as never);

      await expect(updateNodeAbl("node1", "user1", { parentId: "p1" })).rejects.toThrow(CrossMapParentError);
      expect(updateNodeDao).not.toHaveBeenCalled();
    });
  });

  describe("setBranchHiddenAbl", () => {
    it("lets only the map's owner hide a branch", async () => {
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue({ mapId: "m1" } as never);
      vi.mocked(setBranchHiddenMutationDao).mockResolvedValue({ nodeId: "node1" } as never);

      vi.mocked(getMapByInternalIdDao).mockResolvedValue({ ownerId: "someoneElse" } as never);
      await expect(setBranchHiddenAbl("node1", "user1", { hidden: true })).rejects.toBeInstanceOf(NotMapOwnerError);
      expect(setBranchHiddenMutationDao).not.toHaveBeenCalled();

      vi.mocked(getMapByInternalIdDao).mockResolvedValue({ ownerId: "user1" } as never);
      await setBranchHiddenAbl("node1", "user1", { hidden: true });
      expect(setBranchHiddenMutationDao).toHaveBeenCalledWith("node1", true);
    });

    it("rejects a body without a boolean, and reports a missing node", async () => {
      await expect(setBranchHiddenAbl("node1", "user1", { hidden: "yes" })).rejects.toThrow(ValidationError);
      vi.mocked(findNodeByPublicIdDao).mockResolvedValue(null as never);
      expect(await setBranchHiddenAbl("node1", "user1", { hidden: false })).toBeNull();
    });
  });

  describe("moveNodesAbl", () => {
    const moved = (nodeId: string, mapId = "pub1") => ({ nodeId, mapId: { _id: `int-${mapId}`, mapId } });

    it("rejects an empty or malformed list", async () => {
      await expect(moveNodesAbl("user1", { moves: [] })).rejects.toThrow(ValidationError);
      await expect(moveNodesAbl("user1", { moves: [{ nodeId: "a", x: "1" }] })).rejects.toThrow(ValidationError);
      expect(moveNodesDao).not.toHaveBeenCalled();
    });

    it("saves only the spot fields that were sent", async () => {
      vi.mocked(moveNodesDao).mockResolvedValue([] as never);
      await moveNodesAbl("user1", { moves: [{ nodeId: "a", x: 1, y: 2 }, { nodeId: "b", cardX: 3, cardY: null }] });
      expect(moveNodesDao).toHaveBeenCalledWith(
        [
          { nodeId: "a", spot: { x: 1, y: 2 } },
          { nodeId: "b", spot: { cardX: 3, cardY: null } },
        ],
        "user1",
      );
    });

    it("tells each map once, keeping hidden nodes in a batch of their own", async () => {
      vi.mocked(moveNodesDao).mockResolvedValue([moved("a"), moved("b"), moved("c", "pub2")] as never);
      vi.mocked(getHiddenNodesDao).mockImplementation(async (id) =>
        String(id) === "int-pub1" ? { ids: new Set(["x"]), publicIds: new Set(["b"]) } : { ids: new Set(), publicIds: new Set() },
      );
      const { nodes, broadcasts } = await moveNodesAbl("user1", { moves: [{ nodeId: "a", x: 1, y: 1 }] });
      expect(nodes).toHaveLength(3);
      expect(broadcasts.map((b) => [b.publicMapId, b.nodes.map((n) => n.nodeId)])).toEqual([
        ["pub1", ["a"]],
        ["pub1", ["b"]],
        ["pub2", ["c"]],
      ]);
    });
  });
});
