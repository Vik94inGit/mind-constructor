import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { usePresentation } from "./usePresentation";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

function setup(overrides: Partial<Parameters<typeof usePresentation>[0]> = {}) {
  const params = {
    visibleNodes: [] as NodeDoc[],
    hiddenBranchIds: new Set<string>(),
    multiSelectIds: new Set<string>(),
    selectedCircleNodeIds: undefined as string[] | undefined,
    posFor: (n: NodeDoc) => ({ x: n.x ?? 0, y: n.y ?? 0 }),
    centerOnPoint: vi.fn(),
    ensureNodeText: vi.fn(async () => ({})),
    setMultiSelectIds: vi.fn(),
    setSelectedId: vi.fn(),
    dispatchMode: vi.fn(),
    setActionError: vi.fn(),
    emptyMessage: "nothing to present",
    ...overrides,
  };
  const hook = renderHook(() => usePresentation(params));
  return { ...hook, params };
}

describe("usePresentation", () => {
  it("refuses to start with nothing eligible", () => {
    const { result, params } = setup({
      visibleNodes: [makeNode({ nodeId: "w", isWeapon: true }), makeNode({ nodeId: "s", isProtection: true })],
    });
    act(() => result.current.enterPresentation());
    expect(params.setActionError).toHaveBeenCalledWith("nothing to present");
    expect(result.current.presenting).toBe(false);
  });

  it("enters once the text is in, clearing the selection, and skips hidden or blank nodes", async () => {
    const { result, params } = setup({
      visibleNodes: [
        makeNode({ nodeId: "a", text: "A" }),
        makeNode({ nodeId: "hidden", text: "H" }),
        makeNode({ nodeId: "blank", text: "" }),
      ],
      hiddenBranchIds: new Set(["hidden"]),
    });
    act(() => result.current.enterPresentation());
    await waitFor(() => expect(result.current.presenting).toBe(true));
    expect(params.ensureNodeText).toHaveBeenCalledWith(["a", "blank"]);
    expect(params.setSelectedId).toHaveBeenCalledWith(null);
    expect(params.dispatchMode).toHaveBeenCalledWith({ type: "reset" });
    expect(result.current.slideNodes.map((n) => n.nodeId)).toEqual(["a"]);
    expect(params.centerOnPoint).toHaveBeenCalled();

    act(() => result.current.exitPresentation());
    expect(result.current.presenting).toBe(false);
    expect(result.current.slideNodes).toEqual([]);
  });

  it("scopes to a chosen zone and its whole branch", async () => {
    const { result } = setup({
      visibleNodes: [
        makeNode({ nodeId: "root", text: "R" }),
        makeNode({ nodeId: "child", text: "C", parentId: "root" }),
        makeNode({ nodeId: "grandchild", text: "G", parentId: "child" }),
        makeNode({ nodeId: "outside", text: "O" }),
      ],
      selectedCircleNodeIds: ["root", "child"],
    });
    act(() => result.current.enterPresentation());
    await waitFor(() => expect(result.current.presenting).toBe(true));
    expect(new Set(result.current.slideNodes.map((n) => n.nodeId))).toEqual(new Set(["root", "child", "grandchild"]));
  });
});
