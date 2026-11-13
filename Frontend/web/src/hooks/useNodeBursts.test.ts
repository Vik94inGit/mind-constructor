import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useNodeBursts } from "./useNodeBursts";
import { newLocalId, noteSaved, firstShownAs } from "../offline/sync";
import { makeNode } from "../test/fixtures";
import type { NodeDoc } from "../types";

const at = (ids: string[]) => new Map(ids.map((id) => [id, { x: 1, y: 1 }]));

describe("useNodeBursts", () => {
  it("pops a node that leaves the map", () => {
    const a = makeNode({ nodeId: "a" }) as NodeDoc;
    const b = makeNode({ nodeId: "b" }) as NodeDoc;
    const { result, rerender } = renderHook(({ nodes }) => useNodeBursts("m", nodes, at(["a", "b"])), {
      initialProps: { nodes: [a, b] },
    });
    rerender({ nodes: [a] });
    expect(result.current).toHaveLength(1);
  });

  it("doesn't pop a draft when its saved self takes its place", () => {
    const draftId = newLocalId();
    const a = makeNode({ nodeId: "a" }) as NodeDoc;
    const draft = makeNode({ nodeId: draftId }) as NodeDoc;
    const { result, rerender } = renderHook(({ nodes }) => useNodeBursts("m", nodes, at(["a", draftId])), {
      initialProps: { nodes: [a, draft] },
    });
    noteSaved(draftId, "saved");
    expect(firstShownAs("saved")).toBe(draftId);
    rerender({ nodes: [a, makeNode({ nodeId: "saved" }) as NodeDoc] });
    expect(result.current).toHaveLength(0);
  });
});
