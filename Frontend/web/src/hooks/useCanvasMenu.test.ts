import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { canvasMenuReducer, useCanvasMenu } from "./useCanvasMenu";
import { makeNode } from "../test/fixtures";

describe("canvasMenuReducer", () => {
  it("opening a menu replaces whichever was open", () => {
    const zone = canvasMenuReducer(null, { type: "open", menu: { kind: "zone", rootId: "z", x: 1, y: 2 } });
    const canvas = canvasMenuReducer(zone, {
      type: "open",
      menu: { kind: "canvas", screenX: 1, screenY: 2, canvasX: 3, canvasY: 4 },
    });
    expect(canvas?.kind).toBe("canvas");
  });

  it("closing keeps the same null when nothing was open", () => {
    expect(canvasMenuReducer(null, { type: "close" })).toBeNull();
    expect(canvasMenuReducer({ kind: "zone", rootId: "z", x: 0, y: 0 }, { type: "close" })).toBeNull();
  });
});

describe("useCanvasMenu", () => {
  it("shows only the open menu, and closes it", () => {
    const { result } = renderHook(() => useCanvasMenu());
    const node = makeNode({ nodeId: "n" });
    act(() => result.current.openMenu({ kind: "node", node, x: 5, y: 6 }));
    expect(result.current.nodeMenu?.node).toBe(node);
    expect(result.current.zoneMenu).toBeNull();
    act(() => result.current.openMenu({ kind: "zone", rootId: "n", x: 0, y: 0 }));
    expect(result.current.nodeMenu).toBeNull();
    expect(result.current.zoneMenu?.rootId).toBe("n");
    act(() => result.current.closeMenu());
    expect(result.current.zoneMenu).toBeNull();
    expect(result.current.canvasMenu).toBeNull();
  });
});
