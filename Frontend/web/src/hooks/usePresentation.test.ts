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

  it("presents only the zone picked from its menu, nested zones included, whatever else is selected", async () => {
    const { result, params } = setup({
      visibleNodes: [
        makeNode({ nodeId: "top", text: "T" }),
        makeNode({ nodeId: "zone", text: "Z", parentId: "top" }),
        makeNode({ nodeId: "a", text: "A", parentId: "zone" }),
        makeNode({ nodeId: "castle", text: "C", parentId: "zone" }),
        makeNode({ nodeId: "inner", text: "I", parentId: "castle" }),
        makeNode({ nodeId: "hit", text: "H", parentId: "a", isWeapon: true }),
        makeNode({ nodeId: "sibling", text: "S", parentId: "top" }),
      ],
      multiSelectIds: new Set(["sibling"]),
      selectedCircleNodeIds: ["top", "sibling"],
    });
    act(() => result.current.presentZone("zone"));
    await waitFor(() => expect(result.current.presenting).toBe(true));
    expect(new Set(result.current.slideNodes.map((n) => n.nodeId))).toEqual(new Set(["zone", "a", "castle", "inner"]));
    expect(result.current.slideGroups[0].node.nodeId).toBe("zone");
    expect(params.setMultiSelectIds).toHaveBeenCalledWith(new Set());
  });
  it("keeps unanswered questions for the summary and narrows slides to the picked types", async () => {
    const { result } = setup({
      visibleNodes: [
        makeNode({ nodeId: "p", text: "P", type: "Problem" }),
        makeNode({ nodeId: "s", text: "S", type: "Solution", parentId: "p" }),
        makeNode({ nodeId: "q", text: "", ghost: true, prompt: "Why?", parentId: "p" }),
      ],
    });
    act(() => result.current.enterPresentation());
    await waitFor(() => expect(result.current.presenting).toBe(true));
    expect(result.current.summaryNodes.map((n) => n.nodeId)).toEqual(["p", "s", "q"]);
    act(() => result.current.setTypeFilter(["Solution"]));
    expect(result.current.slideNodes.map((n) => n.nodeId)).toEqual(["s"]);
    act(() => result.current.exitPresentation());
    expect(result.current.typeFilter).toEqual([]);
  });
});
