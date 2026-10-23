import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useNodeDragAndDrop } from "./useNodeDragAndDrop";
import { makeNode } from "../test/fixtures";
import { TRAIL_TICK_MS } from "../utils/followTrail";
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
      placeNode: (p: Pt) => p,
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

      // A drop no longer moves the camera — that jump read as a glitch.
      expect(zoomToEditAt).not.toHaveBeenCalled();
      expect(setNodes).toHaveBeenCalled(); // optimistic local update
      expect(nodesApi.updateNode).toHaveBeenCalledWith("a", { x: 400, y: 300 });
      expect(upsertNode).toHaveBeenCalledWith(updated);
      expect(result.current.dragState).toBeNull();
      expect(result.current.groupDragState).toBeNull();
      expect(result.current.dropTarget).toBeNull();
    });

    it("joins the target's circle when dropped anywhere on its card, landing in free mode", async () => {
      const dragged = makeNode({ nodeId: "a", x: 0, y: 0 });
      const target = makeNode({ nodeId: "b", x: 500, y: 500 });
      const nodes = [dragged, target];
      const positions = new Map<string, Pt>([
        ["a", { x: 0, y: 0 }],
        ["b", { x: 500, y: 500 }],
      ]);
      const placeNode = vi.fn((p: Pt) => p);
      const listeners = captureWindowListeners();
      const { result } = setup({ nodes, positions, placeNode, posFor: (n) => positions.get(n.nodeId)! });

      act(() => result.current.onNodePointerDown(dragged, fakePointerDownEvent({ clientX: 0, clientY: 0 })));
      // Near the card's right edge, well off its center.
      act(() => listeners.pointermove({ clientX: 585, clientY: 540 }));
      expect(result.current.dropTarget).toEqual({ nodeId: "b", valid: true });

      vi.mocked(nodesApi.updateNode).mockResolvedValue({ ...dragged, x: 585, y: 540, parentId: "b" });
      await act(async () => {
        listeners.pointerup({ clientX: 585, clientY: 540 });
        await vi.runAllTimersAsync();
      });

      expect(placeNode).toHaveBeenCalledWith({ x: 585, y: 540 }, [{ nodeId: "a", parentId: "b" }], [], { free: true });
      expect(nodesApi.updateNode).toHaveBeenCalledWith("a", expect.objectContaining({ parentId: "b" }));
    });

    it("is a plain move when dropped clear of every card", async () => {
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
      act(() => listeners.pointermove({ clientX: 700, clientY: 500 }));
      expect(result.current.dropTarget).toBeNull();

      vi.mocked(nodesApi.updateNode).mockResolvedValue({ ...dragged, x: 700, y: 500 });
      await act(async () => {
        listeners.pointerup({ clientX: 700, clientY: 500 });
        await vi.runAllTimersAsync();
      });

      expect(nodesApi.updateNode).toHaveBeenCalledWith("a", { x: 700, y: 500 });
    });

    it("joins the target's circle when dropped right next to its center", async () => {
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

    it("keeps a member dragged a little past the zone's reach in its circle", async () => {
      const root = makeNode({ nodeId: "root", x: 0, y: 0, parentId: null });
      const child = makeNode({ nodeId: "child", parentId: "root", x: 200, y: 0 });
      const nodes = [root, child];
      const positions = new Map<string, Pt>([
        ["root", { x: 0, y: 0 }],
        ["child", { x: 200, y: 0 }],
      ]);
      const nodeGroups: NodeGroup[] = [
        { rootId: "root", members: [root, child], sentiment: "neutral", cx: 0, cy: 0, r: 100, outline: [] },
      ];
      const listeners = captureWindowListeners();
      const { result } = setup({ nodes, positions, nodeGroups, posFor: (n) => positions.get(n.nodeId)! });

      act(() => result.current.onNodePointerDown(child, fakePointerDownEvent({ clientX: 200, clientY: 0 })));
      // Past the reach (two pack spacings), inside one and a half of it.
      act(() => listeners.pointermove({ clientX: 420, clientY: 0 }));

      vi.mocked(nodesApi.updateNode).mockResolvedValue({ ...child, x: 420, y: 0 });
      await act(async () => {
        listeners.pointerup({ clientX: 420, clientY: 0 });
        await vi.runAllTimersAsync();
      });

      expect(nodesApi.updateNode).toHaveBeenCalledWith("child", { x: 420, y: 0 });
    });

    it("keeps a member that already sat past the zone's reach when it's moved without going farther out", async () => {
      const root = makeNode({ nodeId: "root", x: 0, y: 0, parentId: null });
      const child = makeNode({ nodeId: "child", parentId: "root", x: 1200, y: 0 });
      const nodes = [root, child];
      const positions = new Map<string, Pt>([
        ["root", { x: 0, y: 0 }],
        ["child", { x: 1200, y: 0 }],
      ]);
      const nodeGroups: NodeGroup[] = [
        { rootId: "root", members: [root, child], sentiment: "neutral", cx: 0, cy: 0, r: 100, outline: [] },
      ];
      const listeners = captureWindowListeners();
      const { result } = setup({ nodes, positions, nodeGroups, posFor: (n) => positions.get(n.nodeId)! });

      act(() => result.current.onNodePointerDown(child, fakePointerDownEvent({ clientX: 1200, clientY: 0 })));
      // Pulled in toward the root, but still well past the reach.
      act(() => listeners.pointermove({ clientX: 900, clientY: 300 }));

      vi.mocked(nodesApi.updateNode).mockResolvedValue({ ...child, x: 900, y: 300 });
      await act(async () => {
        listeners.pointerup({ clientX: 900, clientY: 300 });
        await vi.runAllTimersAsync();
      });

      expect(nodesApi.updateNode).toHaveBeenCalledWith("child", { x: 900, y: 300 });
    });

    it("lands a drop where placeNode's free mode puts it", async () => {
      const node = makeNode({ nodeId: "a", x: 100, y: 100, parentId: null });
      const nodes = [node];
      const positions = new Map<string, Pt>([["a", { x: 100, y: 100 }]]);
      const placeNode = vi.fn(() => ({ x: 333, y: 444 }));
      const listeners = captureWindowListeners();
      const { result } = setup({ nodes, positions, placeNode, posFor: (n) => positions.get(n.nodeId)! });

      act(() => result.current.onNodePointerDown(node, fakePointerDownEvent({ clientX: 100, clientY: 100 })));
      act(() => listeners.pointermove({ clientX: 400, clientY: 300 }));

      vi.mocked(nodesApi.updateNode).mockResolvedValue({ ...node, x: 333, y: 444 });
      await act(async () => {
        listeners.pointerup({ clientX: 400, clientY: 300 });
        await vi.runAllTimersAsync();
      });

      expect(placeNode).toHaveBeenCalledWith({ x: 400, y: 300 }, [{ nodeId: "a" }], [], { free: true });
      expect(nodesApi.updateNode).toHaveBeenCalledWith("a", { x: 333, y: 444 });
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

  describe("touch", () => {
    it("a finger held still and lifted toggles the node into the multi-selection", async () => {
      const node = makeNode({ nodeId: "a" });
      const listeners = captureWindowListeners();
      const { result, setSelectedId, setMultiSelectIds, handleNodeClick } = setup({ moveMode: false });

      act(() =>
        result.current.onNodePointerDown(node, fakePointerDownEvent({ clientX: 0, clientY: 0, pointerType: "touch" })),
      );
      act(() => vi.advanceTimersByTime(500));
      // Nothing happens while the finger is still down.
      expect(setMultiSelectIds).not.toHaveBeenCalled();
      await act(async () => {
        listeners.pointerup({ clientX: 0, clientY: 0 });
      });

      expect(setSelectedId).toHaveBeenCalledWith(null);
      const updater = setMultiSelectIds.mock.calls[0][0];
      expect(updater(new Set())).toEqual(new Set(["a"]));
      expect(handleNodeClick).not.toHaveBeenCalled();
      expect(nodesApi.updateNode).not.toHaveBeenCalled();
    });

    it("hands the hold to onHold instead when it handles it (a puzzle card opening its menu)", async () => {
      const node = makeNode({ nodeId: "a" });
      const onHold = vi.fn(() => true);
      const listeners = captureWindowListeners();
      const { result, setMultiSelectIds } = setup({ moveMode: false, onHold });

      act(() =>
        result.current.onNodePointerDown(node, fakePointerDownEvent({ clientX: 12, clientY: 34, pointerType: "touch" })),
      );
      act(() => vi.advanceTimersByTime(500));
      await act(async () => {
        listeners.pointerup({ clientX: 12, clientY: 34 });
      });

      expect(onHold).toHaveBeenCalledWith(node, 12, 34);
      expect(setMultiSelectIds).not.toHaveBeenCalled();
    });

    it("drags a node in move mode once the finger really travels", async () => {
      const node = makeNode({ nodeId: "a", x: 300, y: 300 });
      const listeners = captureWindowListeners();
      const { result, handleNodeClick } = setup({ moveMode: true, nodes: [node] });
      vi.mocked(nodesApi.updateNode).mockImplementation(async (_id, updates) => ({ ...node, ...updates }));

      act(() =>
        result.current.onNodePointerDown(node, fakePointerDownEvent({ clientX: 300, clientY: 300, pointerType: "touch" })),
      );
      act(() => listeners.pointermove({ clientX: 500, clientY: 400 }));
      expect(result.current.dragState).toEqual({ nodeId: "a", x: 500, y: 400 });

      await act(async () => {
        listeners.pointerup({ clientX: 500, clientY: 400 });
      });
      expect(handleNodeClick).not.toHaveBeenCalled();
      expect(nodesApi.updateNode).toHaveBeenCalledWith("a", { x: 500, y: 400 });
    });

    it("a swipe that starts on a node outside move mode pans the map and moves nothing", async () => {
      const node = makeNode({ nodeId: "a", x: 300, y: 300 });
      const listeners = captureWindowListeners();
      const { result, setMultiSelectIds } = setup({ moveMode: false, nodes: [node] });
      const e = fakePointerDownEvent({ clientX: 300, clientY: 300, pointerType: "touch" });

      act(() => result.current.onNodePointerDown(node, e));
      // The canvas still gets the finger, so the browser can pan with it.
      expect(e.stopPropagation).not.toHaveBeenCalled();
      act(() => listeners.pointermove({ clientX: 500, clientY: 400 }));
      expect(result.current.dragState).toBeNull();
      // The browser takes the finger over for the pan, past the long press.
      act(() => listeners.pointercancel({}));
      act(() => vi.advanceTimersByTime(800));
      await act(async () => {
        listeners.pointerup?.({ clientX: 500, clientY: 400 });
      });

      expect(nodesApi.updateNode).not.toHaveBeenCalled();
      expect(setMultiSelectIds).not.toHaveBeenCalled();
    });

    it("holding a node a moment and then dragging it moves it instead of opening it", async () => {
      const node = makeNode({ nodeId: "a", x: 300, y: 300 });
      const onHold = vi.fn(() => true);
      const listeners = captureWindowListeners();
      const { result, handleNodeClick, setMultiSelectIds } = setup({ moveMode: true, nodes: [node], onHold });
      vi.mocked(nodesApi.updateNode).mockImplementation(async (_id, updates) => ({ ...node, ...updates }));

      act(() =>
        result.current.onNodePointerDown(node, fakePointerDownEvent({ clientX: 300, clientY: 300, pointerType: "touch" })),
      );
      act(() => vi.advanceTimersByTime(800));
      act(() => listeners.pointermove({ clientX: 450, clientY: 300 }));
      await act(async () => {
        listeners.pointerup({ clientX: 450, clientY: 300 });
      });

      expect(onHold).not.toHaveBeenCalled();
      expect(setMultiSelectIds).not.toHaveBeenCalled();
      expect(handleNodeClick).not.toHaveBeenCalled();
      expect(nodesApi.updateNode).toHaveBeenCalledWith("a", { x: 450, y: 300 });
    });

    it("a finger's jitter below the drag distance stays a tap", async () => {
      const node = makeNode({ nodeId: "a", x: 300, y: 300 });
      const listeners = captureWindowListeners();
      const { result, handleNodeClick } = setup({ moveMode: true, nodes: [node] });

      act(() =>
        result.current.onNodePointerDown(node, fakePointerDownEvent({ clientX: 300, clientY: 300, pointerType: "touch" })),
      );
      act(() => listeners.pointermove({ clientX: 305, clientY: 304 }));
      expect(result.current.dragState).toEqual({ nodeId: "a", x: 300, y: 300 });
      await act(async () => {
        listeners.pointerup({ clientX: 305, clientY: 304 });
      });

      expect(handleNodeClick).toHaveBeenCalledWith(node);
      expect(nodesApi.updateNode).not.toHaveBeenCalled();
    });

    it("a second finger coming down (a pinch) drops the drag without saving or opening", () => {
      const node = makeNode({ nodeId: "a", x: 300, y: 300 });
      const listeners = captureWindowListeners();
      const { result, handleNodeClick } = setup({ moveMode: true, nodes: [node] });

      act(() =>
        result.current.onNodePointerDown(node, fakePointerDownEvent({ clientX: 300, clientY: 300, pointerType: "touch" })),
      );
      act(() => listeners.pointermove({ clientX: 400, clientY: 300 }));
      act(() => listeners.pointerdown({ pointerId: 2 }));

      expect(result.current.dragState).toBeNull();
      expect(listeners.pointerup).toBeUndefined();
      expect(handleNodeClick).not.toHaveBeenCalled();
      expect(nodesApi.updateNode).not.toHaveBeenCalled();
    });

    it("a locked node never drags, even with a finger", () => {
      const node = makeNode({ nodeId: "a", x: 100, y: 100, locked: true });
      const listeners = captureWindowListeners();
      const { result } = setup({ moveMode: false, nodes: [node] });

      act(() =>
        result.current.onNodePointerDown(node, fakePointerDownEvent({ clientX: 0, clientY: 0, pointerType: "touch" })),
      );
      act(() => listeners.pointermove({ clientX: 100, clientY: 100 }));

      expect(result.current.dragState).toBeNull();
      expect(nodesApi.updateNode).not.toHaveBeenCalled();
    });
  });

  describe("group drag", () => {
    it("moves every selected member by the same offset, live and on the drop", async () => {
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
      // The leader moves under the finger at once; the follower trails after
      // it in small hops and catches up while the finger rests.
      expect(result.current.groupDragState?.get("leader")).toEqual({ x: 400, y: 200 });
      expect(result.current.groupDragState?.get("follower")).toEqual({ x: 300, y: 600 });
      act(() => vi.advanceTimersByTime(TRAIL_TICK_MS * 10));
      const hop = result.current.groupDragState!.get("follower")!;
      expect(hop.x).toBeGreaterThan(300);
      expect(hop.x).toBeLessThan(500);
      act(() => vi.advanceTimersByTime(TRAIL_TICK_MS * 40));
      expect(result.current.groupDragState?.get("follower")).toEqual({ x: 500, y: 600 });

      await act(async () => {
        listeners.pointerup({ clientX: 400, clientY: 200 });
        await vi.runAllTimersAsync();
      });

      expect(zoomToEditAt).not.toHaveBeenCalled();
      expect(nodesApi.updateNode).toHaveBeenCalledWith("leader", { x: 400, y: 200 });
      expect(nodesApi.updateNode).toHaveBeenCalledWith("follower", { x: 500, y: 600 });
      expect(result.current.groupDragState).toBeNull();
    });

    it("cards glued together follow the dragged one in hops, then save where they landed", async () => {
      const a = makeNode({ nodeId: "a", x: 400, y: 400 });
      const b = makeNode({ nodeId: "b", x: 500, y: 400 });
      const listeners = captureWindowListeners();
      const { result } = setup({ nodes: [a, b], clusterFor: () => ["a", "b"] });
      vi.mocked(nodesApi.updateNode).mockImplementation(async (nodeId, updates) => ({
        ...(nodeId === "a" ? a : b),
        ...updates,
      }));

      act(() => result.current.onNodePointerDown(a, fakePointerDownEvent({ clientX: 400, clientY: 400 })));
      act(() => listeners.pointermove({ clientX: 400, clientY: 600 }));
      expect(result.current.groupDragState?.get("a")).toEqual({ x: 400, y: 600 });
      expect(result.current.groupDragState?.get("b")).toEqual({ x: 500, y: 400 });
      act(() => vi.advanceTimersByTime(TRAIL_TICK_MS * 10));
      const hop = result.current.groupDragState!.get("b")!;
      expect(hop.y).toBeGreaterThan(400);
      expect(hop.y).toBeLessThan(600);

      await act(async () => {
        listeners.pointerup({ clientX: 400, clientY: 600 });
        await vi.runAllTimersAsync();
      });
      expect(nodesApi.updateNode).toHaveBeenCalledWith("a", { x: 400, y: 600 });
      expect(nodesApi.updateNode).toHaveBeenCalledWith("b", { x: 500, y: 600 });
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
