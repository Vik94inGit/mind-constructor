import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLineDrawing } from "./useLineDrawing";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";
import type { NodeGroup } from "../utils/canvasLayout";

vi.mock("../api/lines", () => ({
  createLine: vi.fn(),
  deleteLine: vi.fn(),
}));
import * as linesApi from "../api/lines";

type Pt = { x: number; y: number };

function setup(overrides: Partial<Parameters<typeof useLineDrawing>[0]> = {}) {
  const dispatchMode = vi.fn();
  const setLines = vi.fn();
  const upsertLine = vi.fn();
  const setActionError = vi.fn();
  const setSelectedId = vi.fn();
  const setMultiSelectIds = vi.fn();
  const setContextMenu = vi.fn();
  const setCanvasContextMenu = vi.fn();
  const setPendingCreate = vi.fn();

  const { result } = renderHook(() =>
    useLineDrawing({
      drawMode: false,
      drawPoints: [],
      drawSaving: false,
      dispatchMode,
      visibleNodes: [],
      nodeGroups: [],
      linkCycles: [],
      posFor: () => ({ x: 0, y: 0 }),
      readingMode: "actual",
      lines: [],
      setLines,
      upsertLine,
      mapId: "m1",
      setActionError,
      screenToCanvas: (x, y) => ({ x, y }),
      setSelectedId,
      setMultiSelectIds,
      setContextMenu,
      setCanvasContextMenu,
      setPendingCreate,
      currentUserId: "me",
      mapOwnerId: "owner",
      createFailedMessage: "CREATE_FAILED",
      deleteConfirmMessage: "DELETE_CONFIRM",
      deleteFailedMessage: "DELETE_FAILED",
      ...overrides,
    }),
  );

  return {
    result,
    dispatchMode,
    setLines,
    upsertLine,
    setActionError,
    setSelectedId,
    setMultiSelectIds,
    setContextMenu,
    setCanvasContextMenu,
    setPendingCreate,
  };
}

describe("useLineDrawing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("toggleDrawMode / exitDrawMode", () => {
    it("closes every other panel/menu and starts drawing when not already in draw mode", () => {
      const { result, dispatchMode, setSelectedId, setMultiSelectIds, setContextMenu, setCanvasContextMenu, setPendingCreate } =
        setup({ drawMode: false });
      act(() => result.current.toggleDrawMode());
      expect(setSelectedId).toHaveBeenCalledWith(null);
      expect(setMultiSelectIds).toHaveBeenCalledWith(new Set());
      expect(setContextMenu).toHaveBeenCalledWith(null);
      expect(setCanvasContextMenu).toHaveBeenCalledWith(null);
      expect(setPendingCreate).toHaveBeenCalledWith(null);
      expect(dispatchMode).toHaveBeenCalledWith({ type: "drawStart" });
    });

    it("exits draw mode (and touches nothing else) when already drawing", () => {
      const { result, dispatchMode, setSelectedId } = setup({ drawMode: true });
      act(() => result.current.toggleDrawMode());
      expect(dispatchMode).toHaveBeenCalledWith({ type: "reset" });
      expect(setSelectedId).not.toHaveBeenCalled();
    });

    it("exitDrawMode always resets regardless of current mode", () => {
      const { result, dispatchMode } = setup();
      act(() => result.current.exitDrawMode());
      expect(dispatchMode).toHaveBeenCalledWith({ type: "reset" });
    });
  });

  describe("drawRefusal", () => {
    const nodePositions = new Map<string, Pt>([["n1", { x: 500, y: 500 }]]);
    const posFor = (n: NodeDoc) => nodePositions.get(n.nodeId) ?? { x: 0, y: 0 };
    const nodes = [makeNode({ nodeId: "n1" })];

    it("refuses a point that lands on a node's own footprint", () => {
      const { result } = setup({ visibleNodes: nodes, posFor });
      expect(result.current.drawRefusal({ x: 500, y: 500 })).toBe("spot");
    });

    it("refuses a point inside a manually-placed zone ring", () => {
      const zonedNode = makeNode({ nodeId: "n1", manualZone: "positive" as any });
      const { result } = setup({ visibleNodes: [zonedNode], posFor });
      expect(result.current.drawRefusal({ x: 500, y: 500 })).toBe("spot");
    });

    it("refuses a point inside a circle zone's outline polygon", () => {
      const nodeGroups: NodeGroup[] = [
        {
          rootId: "n1",
          members: nodes,
          sentiment: "neutral",
          cx: 500,
          cy: 500,
          r: 100,
          outline: [
            { x: 400, y: 400 },
            { x: 600, y: 400 },
            { x: 500, y: 600 },
          ],
        },
      ];
      const { result } = setup({ visibleNodes: [], nodeGroups, posFor });
      expect(result.current.drawRefusal({ x: 500, y: 450 })).toBe("spot");
    });

    it("allows a point that clears every node/zone", () => {
      const { result } = setup({ visibleNodes: nodes, posFor });
      expect(result.current.drawRefusal({ x: 1500, y: 1200 })).toBeNull();
    });

    it("refuses a point whose approach segment from the last point cuts through a node", () => {
      const { result } = setup({
        visibleNodes: nodes,
        posFor,
        drawPoints: [{ x: 100, y: 500 }],
      });
      // The new point itself is clear, but the straight line from the last
      // point to it passes right through the node at (500, 500).
      expect(result.current.drawRefusal({ x: 900, y: 500 })).toBe("crossing");
    });
  });

  describe("addDrawPoint", () => {
    it("does nothing while a line is mid-save", () => {
      const { result, dispatchMode } = setup({ drawSaving: true });
      act(() => result.current.addDrawPoint({ x: 1000, y: 1000 }));
      expect(dispatchMode).not.toHaveBeenCalled();
    });

    it("flashes the blocked reason and clears it again after a beat", () => {
      const nodePositions = new Map<string, Pt>([["n1", { x: 500, y: 500 }]]);
      const { result, dispatchMode } = setup({
        visibleNodes: [makeNode({ nodeId: "n1" })],
        posFor: (n) => nodePositions.get(n.nodeId) ?? { x: 0, y: 0 },
      });
      act(() => result.current.addDrawPoint({ x: 500, y: 500 }));
      expect(dispatchMode).toHaveBeenCalledWith({ type: "drawSetBlocked", blocked: "spot" });
      dispatchMode.mockClear();

      act(() => vi.advanceTimersByTime(2200));
      expect(dispatchMode).toHaveBeenCalledWith({ type: "drawSetBlocked", blocked: null });
    });

    it("adds a valid, sufficiently-far point and clears any stale blocked flash", () => {
      // The last point stays well clear of the canvas edge margin itself —
      // otherwise the approach segment's own start would clip it and read
      // as "crossing" rather than exercising the plain add path.
      const { result, dispatchMode } = setup({ drawPoints: [{ x: 100, y: 100 }] });
      act(() => result.current.addDrawPoint({ x: 500, y: 500 }));
      expect(dispatchMode).toHaveBeenCalledWith({ type: "drawSetBlocked", blocked: null });
      expect(dispatchMode).toHaveBeenCalledWith({ type: "drawAddPoint", point: { x: 500, y: 500 } });
    });

    it("ignores a point that lands within a few units of the last one (an accidental double-click)", () => {
      const { result, dispatchMode } = setup({ drawPoints: [{ x: 500, y: 500 }] });
      act(() => result.current.addDrawPoint({ x: 502, y: 500 }));
      expect(dispatchMode).not.toHaveBeenCalledWith({ type: "drawAddPoint", point: expect.anything() });
    });

    it("refuses to grow a line past the backend's own 200-point cap", () => {
      const drawPoints = Array.from({ length: 200 }, (_, i) => ({ x: i, y: 0 }));
      const { result, dispatchMode } = setup({ drawPoints });
      act(() => result.current.addDrawPoint({ x: 5000, y: 5000 }));
      expect(dispatchMode).not.toHaveBeenCalledWith({ type: "drawAddPoint", point: expect.anything() });
    });
  });

  describe("undoDrawPoint", () => {
    it("dispatches drawUndoPoint", () => {
      const { result, dispatchMode } = setup();
      act(() => result.current.undoDrawPoint());
      expect(dispatchMode).toHaveBeenCalledWith({ type: "drawUndoPoint" });
    });
  });

  describe("onDrawPointerMove", () => {
    it("ignores touch input — panning claims that gesture instead", () => {
      const rafSpy = vi.spyOn(window, "requestAnimationFrame");
      const { result } = setup();
      act(() =>
        result.current.onDrawPointerMove({ pointerType: "touch", clientX: 10, clientY: 10 } as any),
      );
      expect(rafSpy).not.toHaveBeenCalled();
    });

    it("throttles to one hover update per animation frame for mouse input", () => {
      let rafCallback: FrameRequestCallback | null = null;
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
        rafCallback = cb;
        return 1;
      });
      const { result, dispatchMode } = setup({ screenToCanvas: (x, y) => ({ x, y }) });
      act(() => result.current.onDrawPointerMove({ pointerType: "mouse", clientX: 42, clientY: 24 } as any));
      expect(dispatchMode).not.toHaveBeenCalled();
      act(() => rafCallback?.(0));
      expect(dispatchMode).toHaveBeenCalledWith({ type: "drawSetHover", hover: { x: 42, y: 24 } });
    });
  });

  describe("finishLine", () => {
    it("does nothing without a mapId", async () => {
      const { result } = setup({ mapId: undefined, drawPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
      await act(async () => result.current.finishLine());
      expect(linesApi.createLine).not.toHaveBeenCalled();
    });

    it("does nothing with fewer than 2 points", async () => {
      const { result } = setup({ drawPoints: [{ x: 0, y: 0 }] });
      await act(async () => result.current.finishLine());
      expect(linesApi.createLine).not.toHaveBeenCalled();
    });

    it("does nothing while already saving", async () => {
      const { result } = setup({ drawSaving: true, drawPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
      await act(async () => result.current.finishLine());
      expect(linesApi.createLine).not.toHaveBeenCalled();
    });

    it("saves the line, upserts it locally, and clears the in-progress points", async () => {
      const points = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
      const savedLine = { lineId: "l1", userId: "me", points };
      vi.mocked(linesApi.createLine).mockResolvedValue(savedLine);
      const { result, dispatchMode, upsertLine } = setup({ drawPoints: points });

      await act(async () => result.current.finishLine());

      expect(linesApi.createLine).toHaveBeenCalledWith("m1", points);
      expect(upsertLine).toHaveBeenCalledWith(savedLine);
      expect(dispatchMode).toHaveBeenCalledWith({ type: "drawSetSaving", saving: true });
      expect(dispatchMode).toHaveBeenCalledWith({ type: "drawClearPoints" });
      expect(dispatchMode).toHaveBeenCalledWith({ type: "drawSetSaving", saving: false });
    });

    it("reports an error and still clears the saving flag when the save fails", async () => {
      vi.mocked(linesApi.createLine).mockRejectedValue(new Error("boom"));
      const points = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
      const { result, dispatchMode, setActionError } = setup({ drawPoints: points });

      await act(async () => result.current.finishLine());

      expect(setActionError).toHaveBeenCalledWith("CREATE_FAILED");
      expect(dispatchMode).toHaveBeenCalledWith({ type: "drawSetSaving", saving: false });
    });
  });

  describe("canDeleteLine", () => {
    it("lets the line's own author delete it", () => {
      const { result } = setup({ currentUserId: "author" });
      expect(result.current.canDeleteLine({ lineId: "l1", userId: "author", points: [] })).toBe(true);
    });

    it("lets the map owner delete anyone's line", () => {
      const { result } = setup({ currentUserId: "owner", mapOwnerId: "owner" });
      expect(result.current.canDeleteLine({ lineId: "l1", userId: "someone-else", points: [] })).toBe(true);
    });

    it("refuses anyone else", () => {
      const { result } = setup({ currentUserId: "random", mapOwnerId: "owner" });
      expect(result.current.canDeleteLine({ lineId: "l1", userId: "author", points: [] })).toBe(false);
    });
  });

  describe("handleLineClick", () => {
    const originalConfirm = window.confirm;
    afterEach(() => {
      window.confirm = originalConfirm;
    });

    it("does nothing when not allowed to delete — doesn't even prompt", async () => {
      window.confirm = vi.fn().mockReturnValue(true);
      const { result } = setup({ currentUserId: "random", mapOwnerId: "owner" });
      await act(async () => result.current.handleLineClick({ lineId: "l1", userId: "author", points: [] }));
      expect(window.confirm).not.toHaveBeenCalled();
      expect(linesApi.deleteLine).not.toHaveBeenCalled();
    });

    it("does nothing when the confirm is declined", async () => {
      window.confirm = vi.fn().mockReturnValue(false);
      const { result } = setup({ currentUserId: "author" });
      await act(async () => result.current.handleLineClick({ lineId: "l1", userId: "author", points: [] }));
      expect(linesApi.deleteLine).not.toHaveBeenCalled();
    });

    it("deletes the line and removes it from local state once confirmed", async () => {
      window.confirm = vi.fn().mockReturnValue(true);
      vi.mocked(linesApi.deleteLine).mockResolvedValue({ success: true, deletedId: "l1" });
      const { result, setLines } = setup({ currentUserId: "author" });

      await act(async () => result.current.handleLineClick({ lineId: "l1", userId: "author", points: [] }));

      expect(linesApi.deleteLine).toHaveBeenCalledWith("l1");
      const updater = setLines.mock.calls[0][0];
      expect(updater([{ lineId: "l1", userId: "author", points: [] }, { lineId: "l2", userId: "x", points: [] }])).toEqual([
        { lineId: "l2", userId: "x", points: [] },
      ]);
    });

    it("reports an error when the delete is refused", async () => {
      window.confirm = vi.fn().mockReturnValue(true);
      vi.mocked(linesApi.deleteLine).mockRejectedValue(new Error("boom"));
      const { result, setActionError } = setup({ currentUserId: "author" });

      await act(async () => result.current.handleLineClick({ lineId: "l1", userId: "author", points: [] }));

      expect(setActionError).toHaveBeenCalledWith("DELETE_FAILED");
    });
  });
});
