import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useClipboardActions } from "./useClipboardActions";
import { writeNodeClipboard } from "../utils/nodeClipboard";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";
import type { Translation } from "../i18n/translations";

vi.mock("../api/nodes", () => ({
  createNode: vi.fn(),
}));
vi.mock("../api/edges", () => ({
  createEdge: vi.fn(),
}));

import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";

const t = {
  ui: {
    clipboard: {
      nothingToCopy: "NOTHING_TO_COPY",
      storeFailed: "STORE_FAILED",
      copied: (n: number) => `COPIED_${n}`,
      nothingToPaste: "NOTHING_TO_PASTE",
      pasted: (n: number) => `PASTED_${n}`,
    },
    errors: {
      clipboard: "CLIPBOARD_ERROR",
      paste: "PASTE_ERROR",
    },
  },
} as unknown as Translation;

function setup(overrides: Partial<Parameters<typeof useClipboardActions>[0]> = {}) {
  const upsertNode = vi.fn();
  const upsertEdge = vi.fn();
  const setActionError = vi.fn();
  const showNotice = vi.fn();
  const setSelectedId = vi.fn();
  const setMultiSelectIds = vi.fn();
  const setCelebrateIds = vi.fn();
  const setShowExportText = vi.fn();
  const setExtractClusterRootId = vi.fn();
  const refreshInsights = vi.fn();
  const ensureNodeText = vi.fn(async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, `real-${id}`])));

  const api = useClipboardActions({
    mapId: "m1",
    nodes: [],
    edges: [],
    visibleNodes: [],
    positions: new Map(),
    nodeGroups: [],
    multiSelectIds: new Set(),
    selectedId: null,
    ensureNodeText,
    upsertNode,
    upsertEdge,
    setActionError,
    showNotice,
    setSelectedId,
    setMultiSelectIds,
    setCelebrateIds,
    setShowExportText,
    setExtractClusterRootId,
    obstaclePoints: () => [],
    bigNodeObstacles: () => [],
    viewportBounds: () => ({ minX: 0, minY: 0, maxX: 2400, maxY: 1600 }),
    refreshInsights,
    t,
    ...overrides,
  });

  return {
    api,
    upsertNode,
    upsertEdge,
    setActionError,
    showNotice,
    setSelectedId,
    setMultiSelectIds,
    setCelebrateIds,
    setShowExportText,
    setExtractClusterRootId,
    refreshInsights,
    ensureNodeText,
  };
}

describe("useClipboardActions", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("copyNodes / copySelection / copyWholeMap", () => {
    it("does nothing without a mapId", async () => {
      const { api, showNotice } = setup({ mapId: undefined });
      await api.copyNodes(["a"]);
      expect(showNotice).not.toHaveBeenCalled();
      expect(localStorage.getItem("mc_node_clipboard")).toBeNull();
    });

    it("writes the picked nodes to the clipboard and notifies with the count", async () => {
      const nodes = [makeNode({ nodeId: "a" }), makeNode({ nodeId: "b" })];
      const { api, showNotice } = setup({ nodes, visibleNodes: nodes });
      await api.copyNodes(["a"]);
      expect(showNotice).toHaveBeenCalledWith("COPIED_1");
      const stored = JSON.parse(localStorage.getItem("mc_node_clipboard")!);
      expect(stored.nodes).toHaveLength(1);
      expect(stored.nodes[0].id).toBe("a");
    });

    it("uses the backfilled text, not whatever was already on the node", async () => {
      const nodes = [makeNode({ nodeId: "a", text: "" })];
      const { api } = setup({ nodes, visibleNodes: nodes });
      await api.copyNodes(["a"]);
      const stored = JSON.parse(localStorage.getItem("mc_node_clipboard")!);
      expect(stored.nodes[0].text).toBe("real-a");
    });

    it("notifies nothingToCopy and writes nothing when nothing eligible is picked", async () => {
      const nodes = [makeNode({ nodeId: "weapon", isWeapon: true })];
      const { api, showNotice } = setup({ nodes, visibleNodes: nodes });
      await api.copyNodes(["weapon"]);
      expect(showNotice).toHaveBeenCalledWith("NOTHING_TO_COPY");
      expect(localStorage.getItem("mc_node_clipboard")).toBeNull();
    });

    it("copySelection prefers the multi-selection over the single selectedId", async () => {
      const nodes = [makeNode({ nodeId: "a" }), makeNode({ nodeId: "b" })];
      const { api } = setup({ nodes, visibleNodes: nodes, multiSelectIds: new Set(["b"]), selectedId: "a" });
      await api.copySelection();
      const stored = JSON.parse(localStorage.getItem("mc_node_clipboard")!);
      expect(stored.nodes.map((n: { id: string }) => n.id)).toEqual(["b"]);
    });

    it("copySelection does nothing with no selection at all", async () => {
      const { api, showNotice } = setup();
      await api.copySelection();
      expect(showNotice).not.toHaveBeenCalled();
    });

    it("copyWholeMap copies every eligible node regardless of selection", async () => {
      const nodes = [makeNode({ nodeId: "a" }), makeNode({ nodeId: "b" })];
      const { api } = setup({ nodes, visibleNodes: nodes });
      await api.copyWholeMap();
      const stored = JSON.parse(localStorage.getItem("mc_node_clipboard")!);
      expect(stored.nodes.map((n: { id: string }) => n.id).sort()).toEqual(["a", "b"]);
    });
  });

  describe("copySelectionAsText", () => {
    const originalClipboard = navigator.clipboard;
    beforeEach(() => {
      Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    });
    afterEach(() => {
      Object.assign(navigator, { clipboard: originalClipboard });
    });

    it("does nothing with no selection", async () => {
      const { api } = setup();
      await api.copySelectionAsText();
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });

    it("writes the picked nodes' text, prefixed and typed, to the OS clipboard", async () => {
      const nodes = [makeNode({ nodeId: "a", type: "Problem", text: "" })];
      const { api } = setup({ nodes, selectedId: "a" });
      await api.copySelectionAsText();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("Problem: real-a"));
    });

    it("reports a clipboard error when the OS clipboard write is refused", async () => {
      Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
      const nodes = [makeNode({ nodeId: "a" })];
      const { api, setActionError } = setup({ nodes, selectedId: "a" });
      await api.copySelectionAsText();
      expect(setActionError).toHaveBeenCalledWith("CLIPBOARD_ERROR");
    });
  });

  describe("openExportText", () => {
    it("backfills every eligible visible node's text, then opens the modal", async () => {
      const nodes = [makeNode({ nodeId: "a" }), makeNode({ nodeId: "weapon", isWeapon: true })];
      const { api, ensureNodeText, setShowExportText } = setup({ nodes, visibleNodes: nodes });
      await api.openExportText();
      expect(ensureNodeText).toHaveBeenCalledWith(["a"]);
      expect(setShowExportText).toHaveBeenCalledWith(true);
    });

    it("opens the modal even with nothing to backfill", async () => {
      const { api, ensureNodeText, setShowExportText } = setup({ visibleNodes: [] });
      await api.openExportText();
      expect(ensureNodeText).not.toHaveBeenCalled();
      expect(setShowExportText).toHaveBeenCalledWith(true);
    });
  });

  describe("collectClusterSubtree / extractClusterText", () => {
    it("walks nested clusters recursively from the given root", () => {
      const root = makeNode({ nodeId: "root" });
      const child = makeNode({ nodeId: "child", parentId: "root" });
      const grandchild = makeNode({ nodeId: "grandchild", parentId: "child" });
      const nodeGroups = [
        { rootId: "root", members: [root, child], sentiment: "neutral" as const, cx: 0, cy: 0, r: 0, outline: [] },
        { rootId: "child", members: [child, grandchild], sentiment: "neutral" as const, cx: 0, cy: 0, r: 0, outline: [] },
      ];
      const { api } = setup({ nodeGroups });
      const subtree = api.collectClusterSubtree("root");
      expect(subtree.map((n) => n.nodeId).sort()).toEqual(["child", "grandchild", "root"]);
    });

    it("extractClusterText backfills the subtree's text and sets the root id", async () => {
      const root = makeNode({ nodeId: "root" });
      const child = makeNode({ nodeId: "child", parentId: "root" });
      const nodeGroups = [{ rootId: "root", members: [root, child], sentiment: "neutral" as const, cx: 0, cy: 0, r: 0, outline: [] }];
      const { api, ensureNodeText, setExtractClusterRootId } = setup({ nodeGroups });
      await api.extractClusterText("root");
      expect(ensureNodeText).toHaveBeenCalledWith(expect.arrayContaining(["root", "child"]));
      expect(setExtractClusterRootId).toHaveBeenCalledWith("root");
    });

    it("extractClusterText does nothing for a root with no cluster", async () => {
      const { api, setExtractClusterRootId } = setup({ nodeGroups: [] });
      await api.extractClusterText("nowhere");
      expect(setExtractClusterRootId).not.toHaveBeenCalled();
    });
  });

  describe("pasteClipboard", () => {
    it("does nothing without a mapId, even with something on the clipboard", async () => {
      writeNodeClipboard({ sourceMapId: "m1", nodes: [{ id: "a", text: "hi", type: "unknown", x: 0, y: 0, parentId: null }], edges: [] });
      const { api, showNotice } = setup({ mapId: undefined });
      await api.pasteClipboard();
      expect(showNotice).not.toHaveBeenCalled();
      expect(nodesApi.createNode).not.toHaveBeenCalled();
    });

    it("notifies nothingToPaste when the clipboard is empty", async () => {
      const { api, showNotice } = setup();
      await api.pasteClipboard();
      expect(showNotice).toHaveBeenCalledWith("NOTHING_TO_PASTE");
    });

    it("creates each clipboard node, parents-first, at its offset position, and selects the result", async () => {
      writeNodeClipboard({
        sourceMapId: "m1",
        nodes: [
          { id: "src-root", text: "root text", type: "unknown", x: 100, y: 100, parentId: null },
          // Far enough from the root (past getNodeMinDist's own spacing
          // radius) that placing them doesn't trigger avoidOverlap nudging
          // one clear of the other — keeps this test about wave ordering
          // and the plain PASTE_OFFSET, not the overlap math (covered on
          // its own in canvasLayout.test.ts).
          { id: "src-child", text: "child text", type: "Success", x: 100, y: 500, parentId: "src-root" },
        ],
        edges: [],
      });
      const created: Record<string, NodeDoc> = {
        "src-root": makeNode({ nodeId: "new-root", text: "root text" }),
        "src-child": makeNode({ nodeId: "new-child", text: "child text", parentId: "new-root" }),
      };
      vi.mocked(nodesApi.createNode).mockImplementation(async (_mapId, input) => {
        const match = input.text === "root text" ? created["src-root"] : created["src-child"];
        return { ...match, x: input.x, y: input.y };
      });

      const { api, upsertNode, setCelebrateIds, setMultiSelectIds, showNotice } = setup();
      await api.pasteClipboard();

      expect(nodesApi.createNode).toHaveBeenCalledTimes(2);
      // Same-map paste with no explicit drop point: offset by the fixed
      // PASTE_OFFSET (40,40) from each original position.
      expect(nodesApi.createNode).toHaveBeenCalledWith(
        "m1",
        expect.objectContaining({ text: "root text", x: 140, y: 140, parentId: null }),
      );
      expect(nodesApi.createNode).toHaveBeenCalledWith(
        "m1",
        expect.objectContaining({ text: "child text", x: 140, y: 540, parentId: "new-root" }),
      );
      expect(upsertNode).toHaveBeenCalledTimes(2);
      expect(setCelebrateIds).toHaveBeenCalledTimes(2);
      expect(setMultiSelectIds).toHaveBeenCalledWith(new Set(["new-root", "new-child"]));
      expect(showNotice).toHaveBeenCalledWith("PASTED_2");
    });

    it("also recreates the connections among the pasted nodes", async () => {
      writeNodeClipboard({
        sourceMapId: "m1",
        nodes: [
          { id: "src-a", text: "a", type: "unknown", x: 0, y: 0, parentId: null },
          { id: "src-b", text: "b", type: "unknown", x: 0, y: 0, parentId: null },
        ],
        edges: [{ from: "src-a", to: "src-b", sentiment: "positive" }],
      });
      vi.mocked(nodesApi.createNode).mockImplementation(async (_mapId, input) =>
        makeNode({ nodeId: input.text === "a" ? "new-a" : "new-b", text: input.text, x: input.x, y: input.y }),
      );
      const newEdge = { edgeId: "e1", mapId: "m1", fromNodeId: "new-a", toNodeId: "new-b", sentiment: "positive" as const, userId: "u1" };
      vi.mocked(edgesApi.createEdge).mockResolvedValue(newEdge);

      const { api, upsertEdge, refreshInsights } = setup();
      await api.pasteClipboard();

      expect(edgesApi.createEdge).toHaveBeenCalledWith("m1", { fromNodeId: "new-a", toNodeId: "new-b", sentiment: "positive" });
      expect(upsertEdge).toHaveBeenCalledWith(newEdge);
      expect(refreshInsights).toHaveBeenCalledWith("m1");
    });

    it("reports the API's own error message when a creation fails", async () => {
      writeNodeClipboard({ sourceMapId: "m1", nodes: [{ id: "a", text: "hi", type: "unknown", x: 0, y: 0, parentId: null }], edges: [] });
      vi.mocked(nodesApi.createNode).mockRejectedValue(new Error("boom"));
      const { api, setActionError } = setup();
      await api.pasteClipboard();
      expect(setActionError).toHaveBeenCalledWith("PASTE_ERROR");
    });
  });
});
