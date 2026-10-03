import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useNodeDragAndDrop } from "./useNodeDragAndDrop";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";
import type { NodeGroup } from "../utils/canvasLayout";
import type { Translation } from "../i18n/translations";

vi.mock("../api/nodes", () => ({
  updateNode: vi.fn(),
}));
import * as nodesApi from "../api/nodes";

type Pt = { x: number; y: number };

const t = {
  ui: {
    errors: {
      dropOnOwnBranch: "OWN_BRANCH",
      moveNodes: "MOVE_ERROR",
      cannotJoin: "CANNOT_JOIN",
      joinCircle: "JOIN_ERROR",
      leaveCircle: "LEAVE_ERROR",
    },
  },
} as unknown as Translation;

// Captures whatever the hook registers on `window` via addEventListener, so
// a test can fire the pointermove/pointerup it attached mid-drag directly —
// simpler and more robust under jsdom than constructing real PointerEvents.
function captureWindowListeners() {
  const listeners: Record<string, (e: any) => void> = {};
  vi.spyOn(window, "addEventListener").mockImplementation((type: string, cb: any) => {
    listeners[type] = cb;
  });
  vi.spyOn(window, "removeEventListener").mockImplementation((type: string, cb: any) => {
    if (listeners[type] === cb) delete listeners[type];
  });
  return listeners;
}

function fakePointerDownEvent(opts: { clientX: number; clientY: number; pointerType?: string }) {
  return {
    clientX: opts.clientX,
    clientY: opts.clientY,
    pointerType: opts.pointerType ?? "mouse",
    pointerId: 1,
    stopPropagation: vi.fn(),
    target: { setPointerCapture: vi.fn() },
  } as any;
}

function setup(overrides: Partial<Parameters<typeof useNodeDragAndDrop>[0]> = {}) {
  const isOwnNode = vi.fn().mockReturnValue(true);
  const handleNodeClick = vi.fn();
  const zoomToEditAt = vi.fn();
  const upsertNode = vi.fn();
  const setActionError = vi.fn();
  const setNodes = vi.fn();
  const setSelectedId = vi.fn();
  const setMultiSelectIds = vi.fn();
  const suppressNextClick = { current: false };

  const { result } = renderHook(() =>
    useNodeDragAndDrop({
      nodes: [],
      positions: new Map(),
      nodeGroups: [],
      chooseMode: false,
      packMode: false,
      drawMode: false,
      multiSelectIds: new Set(),
      moveMode: true,
      isOwnNode,
      handleNodeClick,
      posFor: (n: NodeDoc) => ({ x: n.x ?? 0, y: n.y ?? 0 }),
      screenToCanvas: (x: number, y: number) => ({ x, y }),
      viewportBounds: () => ({ minX: 0, minY: 0, maxX: 2400, maxY: 1600 }),
      obstaclePoints: () => [],
      zoomToEditAt,
      upsertNode,
      setActionError,
      setNodes,
      setSelectedId,
      setMultiSelectIds,
      suppressNextClick,
      t,
      ...overrides,
    }),
  );

  return {
    result,
    isOwnNode,
    handleNodeClick,
    zoomToEditAt,
    upsertNode,
    setActionError,
    setNodes,
    setSelectedId,
    setMultiSelectIds,
    suppressNextClick,
  };
}

describe("useNodeDragAndDrop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does nothing while choosing, packing or drawing", () => {
    const listeners = captureWindowListeners();
    const { result } = setup({ chooseMode: true });
    const node = makeNode({ nodeId: "a" });
    act(() => result.current.onNodePointerDown(node, fakePointerDownEvent({ clientX: 0, clientY: 0 })));
    expect(listeners.pointermove).toBeUndefined();
    expect(result.current.dragState).toBeNull();
  });

  it("does nothing on someone else's node", () => {
    const listeners = captureWindowListeners();
    const { result, isOwnNode } = setup();
    isOwnNode.mockReturnValue(false);
    const node = makeNode({ nodeId: "a" });
    act(() => result.current.onNodePointerDown(node, fakePointerDownEvent({ clientX: 0, clientY: 0 })));
    expect(listeners.pointermove).toBeUndefined();
  });

  it("a bare mouse pointerdown outside move mode never arms a drag", () => {
    const listeners = captureWindowListeners();
    const { result } = setup({ moveMode: false });
    const node = makeNode({ nodeId: "a" });
    act(() => result.current.onNodePointerDown(node, fakePointerDownEvent({ clientX: 0, clientY: 0 })));
    expect(listeners.pointermove).toBeUndefined();
    expect(result.current.dragState).toBeNull();
  });

  describe("single-node drag", () => {
    it("repositions a node with nothing else in the way", async () => {
      const nodes = [makeNode({ nodeId: "a", x: 100, y: 100 })];
      const positions = new Map<string, Pt>([["a", { x: 100, y: 100 }]]);
      const listeners = captureWindowListeners();
      const { result, zoomToEditAt, setNodes, upsertNode } = setup({
        nodes,
        positions,
        posFor: (n) => positions.get(n.nodeId)!,
      });
      const node = nodes[0];

      act(() => result.current.onNodePointerDown(node, fakePointerDownEvent({ clientX: 100, clientY: 100 })));
      expect(result.current.dragState).toEqual({ nodeId: "a", x: 100, y: 100 });

      act(() => listeners.pointermove({ clientX: 400, clientY: 300 }));
      expect(result.current.dragState).toEqual({ nodeId: "a", x: 400, y: 300 });
      expect(result.current.dropTarget).toBeNull();

      const updated = { ...node, x: 400, y: 300 };
      vi.mocked(nodesApi.updateNode).mockResolvedValue(updated);
      await act(async () => {
        listeners.pointerup({ clientX: 400, clientY: 300 });
        await vi.runAllTimersAsync();
      });

      expect(zoomToEditAt).toHaveBeenCalledWith(400, 300);
      expect(setNodes).toHaveBeenCalled(); // optimistic local update
      expect(nodesApi.updateNode).toHaveBeenCalledWith("a", { x: 400, y: 300 });
      expect(upsertNode).toHaveBeenCalledWith(updated);
      expect(result.current.dragState).toBeNull();
      expect(result.current.groupDragState).toBeNull();
      expect(result.current.dropTarget).toBeNull();
    });

    it("joins the target's circle when dropped within CIRCLE_DROP_RADIUS of it", async () => {
      const dragged = makeNode({ nodeId: "a", x: 0, y: 0 });
      const target = makeNode({ nodeId: "b", x: 500, y: 500 });
      const nodes = [dragged, target];
      const positions = new Map<string, Pt>([
        ["a", { x: 0, y: 0 }],
        ["b", { x: 500, y: 500 }],
      ]);
      const listeners = captureWindowListeners();
      const { result } = setup({ nodes, positions, posFor: (n) => positions.get(n.nodeId)! });

      act(() => result.current.onNodePointerDown(dragged, fakePointerDownEvent({ clientX: 0, clientY: 0 })));
      // Land just inside the drop radius of "b".
      act(() => listeners.pointermove({ clientX: 520, clientY: 500 }));
      expect(result.current.dropTarget).toEqual({ nodeId: "b", valid: true });

      const updated = { ...dragged, x: 520, y: 500, parentId: "b" };
      vi.mocked(nodesApi.updateNode).mockResolvedValue(updated);
      await act(async () => {
        listeners.pointerup({ clientX: 520, clientY: 500 });
        await vi.runAllTimersAsync();
      });

      expect(nodesApi.updateNode).toHaveBeenCalledWith(
        "a",
        expect.objectContaining({ parentId: "b" }),
      );
    });

    it("refuses (and reports) a drop onto its own descendant instead of closing a cycle", async () => {
      const root = makeNode({ nodeId: "root", x: 0, y: 0 });
      const child = makeNode({ nodeId: "child", parentId: "root", x: 500, y: 500 });
      const nodes = [root, child];
      const positions = new Map<string, Pt>([
        ["root", { x: 0, y: 0 }],
        ["child", { x: 500, y: 500 }],
      ]);
      const listeners = captureWindowListeners();
      const { result, setActionError } = setup({ nodes, positions, posFor: (n) => positions.get(n.nodeId)! });

      act(() => result.current.onNodePointerDown(root, fakePointerDownEvent({ clientX: 0, clientY: 0 })));
      act(() => listeners.pointermove({ clientX: 510, clientY: 500 }));
      expect(result.current.dropTarget).toEqual({ nodeId: "child", valid: false });

      await act(async () => {
        listeners.pointerup({ clientX: 510, clientY: 500 });
        await vi.runAllTimersAsync();
      });

      expect(setActionError).toHaveBeenCalledWith("OWN_BRANCH");
      expect(nodesApi.updateNode).not.toHaveBeenCalled();
    });

    it("clears parentId when dragged clear of its own circle's backdrop", async () => {
      const root = makeNode({ nodeId: "root", x: 0, y: 0 });
      const child = makeNode({ nodeId: "child", parentId: "root", x: 50, y: 0 });
      const nodes = [root, child];
      const positions = new Map<string, Pt>([
        ["root", { x: 0, y: 0 }],
        ["child", { x: 50, y: 0 }],
      ]);
      const nodeGroups: NodeGroup[] = [
        { rootId: "root", members: [root, child], sentiment: "neutral", cx: 0, cy: 0, r: 100, outline: [] },
      ];
      const listeners = captureWindowListeners();
      const { result } = setup({ nodes, positions, nodeGroups, posFor: (n) => positions.get(n.nodeId)! });

      act(() => result.current.onNodePointerDown(child, fakePointerDownEvent({ clientX: 50, clientY: 0 })));
      // Well outside the circle's own radius (100) and nowhere near another node.
      act(() => listeners.pointermove({ clientX: 1000, clientY: 1000 }));

      const updated = { ...child, x: 1000, y: 1000, parentId: null };
      vi.mocked(nodesApi.updateNode).mockResolvedValue(updated);
      await act(async () => {
        listeners.pointerup({ clientX: 1000, clientY: 1000 });
        await vi.runAllTimersAsync();
      });

      expect(nodesApi.updateNode).toHaveBeenCalledWith("child", { x: 1000, y: 1000, parentId: null });
    });

    it("lands a drop inside a zone where it was let go instead of pushing it out of the zone", async () => {
      // Zones used to be obstacles for a drop: a node released anywhere
      // inside one (even its own circle's root) got pushed past the zone's
      // whole radius, far from the pointer.
      const root = makeNode({ nodeId: "root", x: 200, y: 200, parentId: null });
      const child = makeNode({ nodeId: "child", parentId: "root", x: 900, y: 900 });
      const nodes = [root, child];
      const positions = new Map<string, Pt>([
        ["root", { x: 200, y: 200 }],
        ["child", { x: 900, y: 900 }],
      ]);
      const nodeGroups: NodeGroup[] = [
        { rootId: "root", members: [root, child], sentiment: "neutral", cx: 200, cy: 200, r: 300, outline: [] },
      ];
      const listeners = captureWindowListeners();
      const { result } = setup({
        nodes,
        positions,
        nodeGroups,
        posFor: (n) => positions.get(n.nodeId)!,
      });

      act(() => result.current.onNodePointerDown(root, fakePointerDownEvent({ clientX: 200, clientY: 200 })));
      act(() => listeners.pointermove({ clientX: 250, clientY: 250 }));

      vi.mocked(nodesApi.updateNode).mockResolvedValue({ ...root, x: 250, y: 250 });
      await act(async () => {
        listeners.pointerup({ clientX: 250, clientY: 250 });
        await vi.runAllTimersAsync();
      });

      expect(nodesApi.updateNode).toHaveBeenCalledWith("root", { x: 250, y: 250 });
    });

    it("reverts the optimistic move and reports an error when the save fails", async () => {
      const node = makeNode({ nodeId: "a", x: 100, y: 100, parentId: null });
      const nodes = [node];
      const positions = new Map<string, Pt>([["a", { x: 100, y: 100 }]]);
      const listeners = captureWindowListeners();
      const { result, setNodes, setActionError } = setup({ nodes, positions, posFor: (n) => positions.get(n.nodeId)! });

      act(() => result.current.onNodePointerDown(node, fakePointerDownEvent({ clientX: 100, clientY: 100 })));
      act(() => listeners.pointermove({ clientX: 400, clientY: 300 }));

      vi.mocked(nodesApi.updateNode).mockRejectedValue(new Error("boom"));
      await act(async () => {
        listeners.pointerup({ clientX: 400, clientY: 300 });
        await vi.runAllTimersAsync();
      });

      expect(setActionError).toHaveBeenCalledWith("MOVE_ERROR");
      // Second setNodes call reverts back to the node's pre-drag x/y/parentId.
      const revertUpdater = setNodes.mock.calls[1][0];
      expect(revertUpdater([{ ...node, x: 400, y: 300 }])).toEqual([node]);
    });

    it("treats a pointerdown-then-up with no movement as a plain click, not a drag", async () => {
      const node = makeNode({ nodeId: "a", x: 100, y: 100 });
      const positions = new Map<string, Pt>([["a", { x: 100, y: 100 }]]);
      const listeners = captureWindowListeners();
      const { result, handleNodeClick } = setup({ nodes: [node], positions, posFor: (n) => positions.get(n.nodeId)! });

      act(() => result.current.onNodePointerDown(node, fakePointerDownEvent({ clientX: 100, clientY: 100 })));
      await act(async () => {
        listeners.pointerup({ clientX: 100, clientY: 100 });
      });

      expect(handleNodeClick).toHaveBeenCalledWith(node);
      expect(nodesApi.updateNode).not.toHaveBeenCalled();
    });

    it("locked nodes never start a mouse drag", () => {
      const listeners = captureWindowListeners();
      const node = makeNode({ nodeId: "a", locked: true });
      const { result } = setup();
      act(() => result.current.onNodePointerDown(node, fakePointerDownEvent({ clientX: 0, clientY: 0 })));
      expect(listeners.pointermove).toBeUndefined();
    });
  });

  describe("touch long-press outside move mode", () => {
    it("toggles the node into the multi-selection instead of dragging", () => {
      const node = makeNode({ nodeId: "a" });
      const { result, setSelectedId, setMultiSelectIds } = setup({ moveMode: false });

      act(() =>
        result.current.onNodePointerDown(node, fakePointerDownEvent({ clientX: 0, clientY: 0, pointerType: "touch" })),
      );
      act(() => vi.advanceTimersByTime(500));

      expect(setSelectedId).toHaveBeenCalledWith(null);
      const updater = setMultiSelectIds.mock.calls[0][0];
      expect(updater(new Set())).toEqual(new Set(["a"]));
      expect(nodesApi.updateNode).not.toHaveBeenCalled();
    });

    it("does not drag on real movement either — moveMode gates touch the same as mouse now", () => {
      // Regression test: touch used to bypass moveMode entirely, arming a
      // live single-node drag regardless of its value — only a *held-still*
      // long-press toggled multi-select instead. Real movement past the
      // long-press tolerance now has to stay a no-op too when moveMode is
      // off, same as a bare mouse pointerdown already was.
      const node = makeNode({ nodeId: "a", x: 100, y: 100 });
      const listeners = captureWindowListeners();
      const { result } = setup({ moveMode: false, nodes: [node], posFor: () => ({ x: 100, y: 100 }) });

      act(() =>
        result.current.onNodePointerDown(node, fakePointerDownEvent({ clientX: 0, clientY: 0, pointerType: "touch" })),
      );
      act(() => listeners.pointermove({ clientX: 100, clientY: 100 }));

      expect(result.current.dragState).toBeNull();
      act(() => vi.advanceTimersByTime(500));
      expect(nodesApi.updateNode).not.toHaveBeenCalled();
    });
  });

  describe("group drag", () => {
    it("moves every selected member by the same offset, staggering the followers' own catch-up", async () => {
      // Kept well clear of the drop's own 60px canvas-edge clamp margin —
      // starting near (0,0) would get the target silently clamped back
      // toward the margin instead of landing at the plain offset math this
      // test is actually checking. The follower also starts far enough
      // from the leader (past NODE_FOOTPRINT's own box) that its own final
      // target doesn't land inside the leader's — a real, separate case
      // (member-vs-member overlap avoidance) that isn't what this test is
      // about.
      const leader = makeNode({ nodeId: "leader", x: 200, y: 200 });
      const follower = makeNode({ nodeId: "follower", x: 300, y: 600 });
      const nodes = [leader, follower];
      const positions = new Map<string, Pt>([
        ["leader", { x: 200, y: 200 }],
        ["follower", { x: 300, y: 600 }],
      ]);
      const listeners = captureWindowListeners();
      const { result, zoomToEditAt } = setup({
        nodes,
        positions,
        posFor: (n) => positions.get(n.nodeId)!,
        multiSelectIds: new Set(["leader", "follower"]),
      });

      vi.mocked(nodesApi.updateNode).mockImplementation(async (nodeId, updates) => ({
        ...(nodeId === "leader" ? leader : follower),
        ...updates,
      }));

      act(() => result.current.onNodePointerDown(leader, fakePointerDownEvent({ clientX: 200, clientY: 200 })));
      expect(result.current.groupDragState?.get("leader")).toEqual({ x: 200, y: 200 });
      expect(result.current.groupDragState?.get("follower")).toEqual({ x: 300, y: 600 });

      act(() => listeners.pointermove({ clientX: 400, clientY: 200 }));
      // Only the leader tracks the pointer live — the follower stays put
      // until the drop.
      expect(result.current.groupDragState?.get("leader")).toEqual({ x: 400, y: 200 });
      expect(result.current.groupDragState?.get("follower")).toEqual({ x: 300, y: 600 });

      await act(async () => {
        listeners.pointerup({ clientX: 400, clientY: 200 });
        await vi.runAllTimersAsync();
      });

      expect(zoomToEditAt).toHaveBeenCalledWith(400, 200);
      expect(nodesApi.updateNode).toHaveBeenCalledWith("leader", { x: 400, y: 200 });
      expect(nodesApi.updateNode).toHaveBeenCalledWith("follower", { x: 500, y: 600 });
      expect(result.current.groupDragState).toBeNull();
    });

    it("a group drag with no movement runs the leader's own click instead of persisting anything", async () => {
      const leader = makeNode({ nodeId: "leader", x: 0, y: 0 });
      const follower = makeNode({ nodeId: "follower", x: 100, y: 0 });
      const nodes = [leader, follower];
      const positions = new Map<string, Pt>([
        ["leader", { x: 0, y: 0 }],
        ["follower", { x: 100, y: 0 }],
      ]);
      const listeners = captureWindowListeners();
      const { result, handleNodeClick } = setup({
        nodes,
        positions,
        posFor: (n) => positions.get(n.nodeId)!,
        multiSelectIds: new Set(["leader", "follower"]),
      });

      act(() => result.current.onNodePointerDown(leader, fakePointerDownEvent({ clientX: 0, clientY: 0 })));
      await act(async () => {
        listeners.pointerup({ clientX: 0, clientY: 0 });
      });

      expect(handleNodeClick).toHaveBeenCalledWith(leader, false);
      expect(nodesApi.updateNode).not.toHaveBeenCalled();
      expect(result.current.groupDragState).toBeNull();
    });

    it("a locked member caught up in the selection never moves, even as the drag's own leader", () => {
      const leader = makeNode({ nodeId: "leader", x: 0, y: 0, locked: true });
      const { result } = setup({
        nodes: [leader],
        multiSelectIds: new Set(["leader", "other"]),
      });
      const listeners = captureWindowListeners();
      act(() => result.current.onNodePointerDown(leader, fakePointerDownEvent({ clientX: 0, clientY: 0 })));
      // Locked leader skips the group branch entirely and falls through to
      // the single-node path, which (outside move mode or with locked=true)
      // never arms a mouse drag either.
      expect(listeners.pointermove).toBeUndefined();
    });
  });
});
