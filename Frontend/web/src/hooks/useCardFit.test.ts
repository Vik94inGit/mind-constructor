import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCardFit } from "./useCardFit";
import { makeNode } from "../test/fixtures";
import type { FoldedParents } from "../utils/autoPack";
import type { NodeDoc } from "../types";

// A phone's viewport; cards not drawn in jsdom are taken at 200×60.
function viewport(w = 390, h = 700) {
  const el = document.createElement("div");
  Object.defineProperty(el, "clientWidth", { value: w });
  Object.defineProperty(el, "clientHeight", { value: h });
  return { current: el };
}

const branches = (roots: number, kids: number): NodeDoc[] =>
  Array.from({ length: roots }, (_, r) => [
    makeNode({ nodeId: `r${r}` }),
    ...Array.from({ length: kids }, (_, k) => makeNode({ nodeId: `r${r}k${k}`, parentId: `r${r}` })),
  ]).flat();

function setup(nodes: NodeDoc[], folded: FoldedParents = new Set()) {
  const setFolded = vi.fn();
  const toggleFold = vi.fn();
  const onRefolded = vi.fn();
  const viewportRef = viewport();
  const hook = renderHook(
    ({ active, folded }: { active: boolean; folded: FoldedParents }) =>
      useCardFit({ active, ready: true, nodes, folded, setFolded, toggleFold, viewportRef, onRefolded }),
    { initialProps: { active: true, folded } },
  );
  return { ...hook, setFolded, toggleFold, onRefolded };
}

describe("useCardFit", () => {
  it("leaves a board that fits alone", () => {
    const { result, setFolded } = setup(branches(2, 2));
    expect(result.current.warning).toBeNull();
    expect(setFolded).not.toHaveBeenCalled();
  });

  it("packs every branch, and says so, when the cards don't fit", () => {
    const { result, setFolded, onRefolded } = setup(branches(4, 15));
    expect([...setFolded.mock.calls[0][0]].sort()).toEqual(["r0", "r1", "r2", "r3"]);
    expect(onRefolded).toHaveBeenCalled();
    expect(result.current.warning).toEqual({ kind: "packed" });
  });

  it("names the top cards past what fits when even they don't", () => {
    const { result } = setup(branches(60, 0));
    const w = result.current.warning;
    expect(w?.kind).toBe("tooMany");
    if (w?.kind === "tooMany") {
      expect(w.extraRootIds.length).toBeGreaterThan(0);
      expect(w.extraRootIds[w.extraRootIds.length - 1]).toBe("r59");
    }
  });

  it("opening a branch that doesn't fit alone packs the others", () => {
    const nodes = branches(4, 30);
    // r0 is open already; opening r1 as well wouldn't fit.
    const { result, setFolded, toggleFold } = setup(nodes, new Set(["r1", "r2", "r3"]));
    setFolded.mockClear();
    act(() => result.current.openBranch("r1"));
    expect(toggleFold).not.toHaveBeenCalled();
    expect([...setFolded.mock.calls[0][0]].sort()).toEqual(["r0", "r2", "r3"]);
  });

  it("opening a branch that fits keeps the others as they are", () => {
    const nodes = branches(4, 3);
    const { result, setFolded } = setup(nodes, new Set(["r1", "r2", "r3"]));
    setFolded.mockClear();
    act(() => result.current.openBranch("r1"));
    expect([...setFolded.mock.calls[0][0]].sort()).toEqual(["r2", "r3"]);
  });

  it("outside the cards view a +N just opens its branch", () => {
    const { result, rerender, toggleFold } = setup(branches(2, 2));
    rerender({ active: false, folded: new Set(["r0"]) });
    act(() => result.current.openBranch("r0"));
    expect(toggleFold).toHaveBeenCalledWith("r0");
  });
});
