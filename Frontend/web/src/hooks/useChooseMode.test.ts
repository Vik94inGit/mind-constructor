import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useChooseMode } from "./useChooseMode";
import { makeNode } from "../test/fixtures";

function setup(multiSelectIds: Set<string> = new Set()) {
  const nodes = [
    makeNode({ nodeId: "root" }),
    makeNode({ nodeId: "a", parentId: "root" }),
    makeNode({ nodeId: "theirs", parentId: "root", userId: "u2" }),
  ];
  const params = {
    nodes,
    visibleNodes: nodes,
    isOwnNode: (n: { userId: unknown }) => n.userId === "u1",
    multiSelectIds,
    setMultiSelectIds: vi.fn(),
    setSelectedId: vi.fn(),
    dispatchMode: vi.fn(),
    setPendingLink: vi.fn(),
  };
  const { result } = renderHook(() => useChooseMode(params));
  return { result, params };
}

describe("useChooseMode", () => {
  it("starts with the node and its own branch chosen", () => {
    const { result, params } = setup();
    act(() => result.current.startChooseFrom("root"));
    expect(params.setSelectedId).toHaveBeenCalledWith(null);
    expect(params.dispatchMode).toHaveBeenCalledWith({ type: "chooseStart" });
    expect(params.setMultiSelectIds).toHaveBeenCalledWith(new Set(["root", "a"]));
  });

  it("links two or more chosen nodes, and then stops choosing", () => {
    const one = setup(new Set(["a"]));
    act(() => one.result.current.linkSelection());
    expect(one.params.setPendingLink).not.toHaveBeenCalled();
    const two = setup(new Set(["root", "a"]));
    act(() => two.result.current.linkSelection());
    expect(two.params.setPendingLink).toHaveBeenCalledWith([two.params.nodes[0], two.params.nodes[1]]);
    expect(two.params.dispatchMode).toHaveBeenCalledWith({ type: "reset" });
    expect(two.params.setMultiSelectIds).toHaveBeenCalledWith(new Set());
  });
});
