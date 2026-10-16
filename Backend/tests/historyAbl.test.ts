import { describe, beforeEach, it, expect, vi } from "vitest";
import { getMapByIdDao, getMapByInternalIdDao } from "../src/dao/mapsDao.js";
import { listRevisionsByMapDao, logRevisionsDao } from "../src/dao/historyDao.js";
import { getHiddenNodesDao } from "../src/dao/visibilityDao.js";
import { listMapHistoryAbl, recordDeletionsAbl, recordEditAbl } from "../src/abl/historyAbl.js";

vi.mock("../src/dao/mapsDao.js", () => ({ getMapByIdDao: vi.fn(), getMapByInternalIdDao: vi.fn() }));
vi.mock("../src/dao/historyDao.js", () => ({ logRevisionsDao: vi.fn(), listRevisionsByMapDao: vi.fn() }));
vi.mock("../src/dao/visibilityDao.js", () => ({ getHiddenNodesDao: vi.fn() }));

const node = (text: string, extra = {}) => ({ nodeId: "n1", mapId: "m1", text, title: "", type: "Problem", ...extra });

describe("historyAbl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMapByInternalIdDao).mockResolvedValue({ discussionMode: true } as never);
  });

  it("records an edit of what a node says, in a discussion", async () => {
    await recordEditAbl(node("old"), node("new"), "u1");
    expect(logRevisionsDao).toHaveBeenCalledWith([
      expect.objectContaining({
        nodeId: "n1",
        action: "edit",
        before: { text: "old", title: "", type: "Problem" },
        after: { text: "new", title: "", type: "Problem" },
      }),
    ]);
  });

  it("records nothing when nothing it tracks changed, or outside a discussion", async () => {
    await recordEditAbl(node("same"), node("same"), "u1");
    vi.mocked(getMapByInternalIdDao).mockResolvedValue({ discussionMode: false } as never);
    await recordEditAbl(node("old"), node("new"), "u1");
    expect(logRevisionsDao).not.toHaveBeenCalled();
  });

  it("records a deletion with what the node said", async () => {
    await recordDeletionsAbl([node("gone", { mapId: { _id: "m1", mapId: "pub" } })], "u1");
    expect(logRevisionsDao).toHaveBeenCalledWith([
      expect.objectContaining({ mapId: "m1", action: "delete", before: expect.objectContaining({ text: "gone" }), after: null }),
    ]);
  });

  it("never fails the edit itself when recording does", async () => {
    vi.mocked(logRevisionsDao).mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(recordEditAbl(node("old"), node("new"), "u1")).resolves.toBeUndefined();
  });

  it("hides changes on hidden branches from members", async () => {
    vi.mocked(getMapByIdDao).mockResolvedValue({ _id: "m1", ownerId: "owner" } as never);
    vi.mocked(getHiddenNodesDao).mockResolvedValue({ ids: new Set(), publicIds: new Set(["secret"]) });
    const row = (nodeId: string) => ({ toJSON: () => ({ nodeId }) });
    vi.mocked(listRevisionsByMapDao).mockResolvedValue([row("open"), row("secret")] as never);
    expect(await listMapHistoryAbl("pub", "member")).toEqual([{ nodeId: "open" }]);
    expect(await listMapHistoryAbl("pub", "owner")).toEqual([{ nodeId: "open" }, { nodeId: "secret" }]);
  });
});
