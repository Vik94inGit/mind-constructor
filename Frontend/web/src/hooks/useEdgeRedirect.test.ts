import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useEdgeRedirect } from "./useEdgeRedirect";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

const root = makeNode({ nodeId: "root", parentId: null });
const a = makeNode({ nodeId: "a", parentId: "root" });
const b = makeNode({ nodeId: "b", parentId: "root" });
const a1 = makeNode({ nodeId: "a1", parentId: "a" });
const nodes = [root, a, b, a1];

// The node under the pointer, the way the canvas marks a node's card.
function pointAt(nodeId: string | null) {
  const el = document.createElement("div");
  if (nodeId) el.setAttribute("data-reveal-node", nodeId);
  document.elementFromPoint = vi.fn(() => el);
}

function grab(overrides: Partial<Parameters<typeof useEdgeRedirect>[0]> = {}) {
  const onRedirect = vi.fn();
  const onRefused = vi.fn();
  const hook = renderHook(() =>
    useEdgeRedirect({
      nodes,
      isOwnNode: (_n: NodeDoc) => true,
      screenToCanvas: (x, y) => ({ x, y }),
      onRedirect,
      onRefused,
      ...overrides,
    }),
  );
  pointAt(null);
  act(() =>
    hook.result.current.startEdgeRedirect(a, { clientX: 5, clientY: 5, stopPropagation: vi.fn(), preventDefault: vi.fn() } as never),
  );
  return { ...hook, onRedirect, onRefused };
}

const release = (x = 10, y = 10) => act(() => void window.dispatchEvent(new MouseEvent("pointerup", { clientX: x, clientY: y })));

afterEach(() => vi.restoreAllMocks());

describe("useEdgeRedirect", () => {
  it("follows the pointer and says whether the node under it can be the parent", () => {
    const { result } = grab();
    pointAt("b");
    act(() => void window.dispatchEvent(new MouseEvent("pointermove", { clientX: 40, clientY: 50 })));
    expect(result.current.edgeRedirect).toEqual({ childId: "a", to: { x: 40, y: 50 }, overId: "b", valid: true });
    pointAt("a1");
    act(() => void window.dispatchEvent(new MouseEvent("pointermove", { clientX: 41, clientY: 50 })));
    expect(result.current.edgeRedirect!.valid).toBe(false);
    release();
  });

  it("let go over another node, hangs the child from it", () => {
    const { result, onRedirect } = grab();
    pointAt("b");
    release();
    expect(onRedirect).toHaveBeenCalledWith(a, b);
    expect(result.current.edgeRedirect).toBeNull();
  });

  it("let go over its own branch, says why and changes nothing", () => {
    const { onRedirect, onRefused } = grab();
    pointAt("a1");
    release();
    expect(onRedirect).not.toHaveBeenCalled();
    expect(onRefused).toHaveBeenCalledWith("ownBranch");
  });

  it("let go over empty canvas or its own parent, quietly does nothing", () => {
    const first = grab();
    release();
    pointAt("root");
    const second = grab();
    pointAt("root");
    release();
    for (const g of [first, second]) {
      expect(g.onRedirect).not.toHaveBeenCalled();
      expect(g.onRefused).not.toHaveBeenCalled();
    }
  });
});
