import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLevelReveal } from "./useLevelReveal";
import type { NodeDoc } from "../types";

const node = (nodeId: string, parentId: string | null, level: number | null, filled = false) =>
  ({ nodeId, parentId, level, ghost: !filled, text: filled ? "answer" : "" }) as NodeDoc;

describe("useLevelReveal", () => {
  it("keeps a later round off the map and tells once it opens", () => {
    const onReveal = vi.fn();
    const first = [node("root", null, null), node("a", "root", 1), node("b", "root", 2), node("c", "root", 2)];
    const { result, rerender } = renderHook(({ nodes }) => useLevelReveal(nodes, onReveal), {
      initialProps: { nodes: first },
    });
    expect([...result.current.hidden].sort()).toEqual(["b", "c"]);
    expect(onReveal).not.toHaveBeenCalled();
    rerender({ nodes: first.map((n) => (n.nodeId === "a" ? { ...n, ghost: false, text: "done" } : n)) });
    expect(result.current.hidden.size).toBe(0);
    expect(onReveal).toHaveBeenCalledWith({ level: 2, count: 2 });
  });

  it("tells nothing on the first look at a map", () => {
    const onReveal = vi.fn();
    renderHook(() => useLevelReveal([node("root", null, null), node("a", "root", 1, true), node("b", "root", 2)], onReveal));
    expect(onReveal).not.toHaveBeenCalled();
  });
});
