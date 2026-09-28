import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasFraming } from "./useCanvasFraming";
import { makeNode } from "../test/fixtures";
import type { NodeDisplay } from "../utils/nodeDisplay";

// useCanvasFraming calls no React hooks itself (wrapRef/state all come in
// as params) — it's safe to call directly as a plain function, no
// renderHook/act needed, just fake timers for its setTimeout-delayed
// centerOnPoint calls.
function setup(overrides: Partial<Parameters<typeof useCanvasFraming>[0]> = {}) {
  const zoomFromCenter = vi.fn();
  const centerOnPoint = vi.fn();
  const showNotice = vi.fn();
  const setNodeDisplay = vi.fn();
  const api = useCanvasFraming({
    visibleNodes: [],
    positions: new Map(),
    circleRootSentimentByNode: new Map(),
    zoom: 1,
    zoomFromCenter,
    centerOnPoint,
    wrapRef: { current: { clientWidth: 1000, clientHeight: 800 } as HTMLDivElement },
    showNotice,
    mapId: "m1",
    multiSelectIds: new Set(),
    nodeDisplay: {},
    setNodeDisplay,
    readingMode: "actual",
    stillOverlapNotice: "STILL_OVERLAP",
    zoomedToFitNotice: "ZOOMED_TO_FIT",
    ...overrides,
  });
  return { api, zoomFromCenter, centerOnPoint, showNotice, setNodeDisplay };
}

describe("useCanvasFraming", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("zoomToEditAt", () => {
    it("does nothing once already at or above 100% zoom", () => {
      const { api, zoomFromCenter, centerOnPoint } = setup({ zoom: 1.2 });
      api.zoomToEditAt(50, 60);
      expect(zoomFromCenter).not.toHaveBeenCalled();
      expect(centerOnPoint).not.toHaveBeenCalled();
    });

    it("zooms to exactly 100% and re-centers on the given point when zoomed out", () => {
      const { api, zoomFromCenter, centerOnPoint } = setup({ zoom: 0.7 });
      api.zoomToEditAt(50, 60);
      expect(zoomFromCenter).toHaveBeenCalledWith(0, 1);
      expect(centerOnPoint).not.toHaveBeenCalled();

      vi.advanceTimersByTime(250);
      expect(centerOnPoint).toHaveBeenCalledWith(50, 60);
    });
  });

  describe("showPoints", () => {
    it("does nothing with no mounted viewport", () => {
      const { api, zoomFromCenter, centerOnPoint } = setup({ wrapRef: { current: null } });
      api.showPoints([{ x: 0, y: 0 }]);
      expect(zoomFromCenter).not.toHaveBeenCalled();
      expect(centerOnPoint).not.toHaveBeenCalled();
    });

    it("does nothing with an empty point list", () => {
      const { api, centerOnPoint } = setup();
      api.showPoints([]);
      expect(centerOnPoint).not.toHaveBeenCalled();
    });

    it("just centers on the middle when every point already fits at the current zoom", () => {
      const { api, zoomFromCenter, centerOnPoint } = setup({ zoom: 1 });
      api.showPoints([
        { x: 100, y: 100 },
        { x: 120, y: 100 },
      ]);
      expect(zoomFromCenter).not.toHaveBeenCalled();
      expect(centerOnPoint).toHaveBeenCalledWith(110, 100);
    });

    it("zooms out to fit a spread-out set of points, then centers on their middle after a delay", () => {
      const { api, zoomFromCenter, centerOnPoint } = setup({ zoom: 1 });
      // Far enough apart that a 1000x800 viewport can't show both at zoom 1.
      api.showPoints([
        { x: 0, y: 400 },
        { x: 4000, y: 400 },
      ]);
      expect(zoomFromCenter).toHaveBeenCalledTimes(1);
      const [, target] = zoomFromCenter.mock.calls[0];
      expect(target).toBeLessThan(1);
      expect(centerOnPoint).not.toHaveBeenCalled();

      vi.advanceTimersByTime(260);
      expect(centerOnPoint).toHaveBeenCalledWith(2000, 400);
    });
  });

  describe("showNodes", () => {
    it("resolves ids through positions and skips any id with no known position", () => {
      const positions = new Map([
        ["a", { x: 100, y: 100 }],
        ["b", { x: 200, y: 100 }],
      ]);
      const { api, centerOnPoint } = setup({ positions, zoom: 1 });
      api.showNodes(["a", "b", "missing"]);
      expect(centerOnPoint).toHaveBeenCalledWith(150, 100);
    });
  });

  describe("fitZoomForDisplay", () => {
    it("does not zoom when nothing is drawn in an expanded (non-actual) mode", () => {
      const nodes = [makeNode({ nodeId: "a" }), makeNode({ nodeId: "b" })];
      const positions = new Map([
        ["a", { x: 0, y: 0 }],
        ["b", { x: 10, y: 0 }],
      ]);
      const { api, zoomFromCenter, showNotice } = setup({ visibleNodes: nodes, positions, zoom: 1 });
      api.fitZoomForDisplay({}, "actual");
      expect(zoomFromCenter).not.toHaveBeenCalled();
      expect(showNotice).not.toHaveBeenCalled();
    });

    it("zooms in (capped at MAX_ZOOM) and warns when even that can't separate everything", () => {
      const nodes = [makeNode({ nodeId: "a" }), makeNode({ nodeId: "b" })];
      const positions = new Map([
        ["a", { x: 0, y: 0 }],
        ["b", { x: 10, y: 0 }],
      ]);
      const { api, zoomFromCenter, showNotice } = setup({ visibleNodes: nodes, positions, zoom: 1 });
      api.fitZoomForDisplay({}, "classic");
      expect(zoomFromCenter).toHaveBeenCalledTimes(1);
      const [, target] = zoomFromCenter.mock.calls[0];
      expect(target).toBe(2.5); // MAX_ZOOM
      expect(showNotice).toHaveBeenCalledWith("STILL_OVERLAP");
    });

    it("zooms in just enough to separate a mildly-overlapping pair, without hitting the cap", () => {
      const nodes = [makeNode({ nodeId: "a" }), makeNode({ nodeId: "b" })];
      const positions = new Map([
        ["a", { x: 0, y: 0 }],
        ["b", { x: 80, y: 0 }],
      ]);
      const { api, zoomFromCenter, showNotice } = setup({ visibleNodes: nodes, positions, zoom: 1 });
      api.fitZoomForDisplay({}, "classic");
      expect(zoomFromCenter).toHaveBeenCalledTimes(1);
      const [, target] = zoomFromCenter.mock.calls[0];
      expect(target).toBeGreaterThan(1);
      expect(target).toBeLessThan(2.5);
      expect(showNotice).toHaveBeenCalledWith("ZOOMED_TO_FIT");
    });

    it("re-centers on the given point after the zoom, once it actually zoomed", () => {
      const nodes = [makeNode({ nodeId: "a" }), makeNode({ nodeId: "b" })];
      const positions = new Map([
        ["a", { x: 0, y: 0 }],
        ["b", { x: 80, y: 0 }],
      ]);
      const { api, centerOnPoint } = setup({ visibleNodes: nodes, positions, zoom: 1 });
      api.fitZoomForDisplay({}, "classic", { x: 85, y: 0 });
      expect(centerOnPoint).not.toHaveBeenCalled();
      vi.advanceTimersByTime(250);
      expect(centerOnPoint).toHaveBeenCalledWith(85, 0);
    });
  });

  describe("setDisplayForChosen", () => {
    it("does nothing with no chosen nodes", () => {
      const { api, setNodeDisplay } = setup({ multiSelectIds: new Set() });
      api.setDisplayForChosen("classic");
      expect(setNodeDisplay).not.toHaveBeenCalled();
    });

    it("sets the chosen ids to the given mode, merged with whatever else was already overridden", () => {
      const nodeDisplay: NodeDisplay = { z: "classic" };
      const { api, setNodeDisplay } = setup({
        multiSelectIds: new Set(["a", "b"]),
        nodeDisplay,
        visibleNodes: [],
        positions: new Map(),
      });
      api.setDisplayForChosen("iconText");
      expect(setNodeDisplay).toHaveBeenCalledWith({ z: "classic", a: "iconText", b: "iconText" });
    });

    it("clears the chosen ids back to the map default when given null", () => {
      const nodeDisplay: NodeDisplay = { a: "classic", b: "classic", z: "iconText" };
      const { api, setNodeDisplay } = setup({
        multiSelectIds: new Set(["a", "b"]),
        nodeDisplay,
        visibleNodes: [],
        positions: new Map(),
      });
      api.setDisplayForChosen(null);
      expect(setNodeDisplay).toHaveBeenCalledWith({ z: "iconText" });
    });

    it("persists the new display to storage under the current map", () => {
      const { api } = setup({ multiSelectIds: new Set(["a"]), mapId: "map-42" });
      api.setDisplayForChosen("classic");
      expect(localStorage.getItem("mc_node_display:map-42")).toBe(JSON.stringify({ a: "classic" }));
    });
  });
});
