import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { TOP_ZONE, useCardFit } from "./useCardFit";
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

function setup(nodes: NodeDoc[], initialFolded: FoldedParents = new Set()) {
  const setFoldedSpy = vi.fn();
  const toggleFold = vi.fn();
  const onRefolded = vi.fn();
  const viewportRef = viewport();
  const hook = renderHook(
    ({ active }: { active: boolean }) => {
      const [folded, setFoldedState] = useState(initialFolded);
      const [zone, setZone] = useState<string | null>(null);
      const setFolded = (next: FoldedParents) => {
        setFoldedSpy(next);
        setFoldedState(next);
      };
      const fit = useCardFit({ active, ready: true, nodes, folded, setFolded, toggleFold, viewportRef, onRefolded, zone, setZone });
      return { ...fit, folded, zone };
    },
    { initialProps: { active: true } },
  );
  return { ...hook, setFolded: setFoldedSpy, toggleFold, onRefolded };
}

const sorted = (set: Set<string>) => [...set].sort();

describe("useCardFit", () => {
  it("leaves a board that fits alone", () => {
    const { result, setFolded } = setup(branches(2, 2));
    expect(result.current.warning).toBeNull();
    expect(result.current.zone).toBeNull();
    expect(setFolded).not.toHaveBeenCalled();
  });

  it("shows the top ideas first, one zone at a time, when the cards don't fit", () => {
    const { result, onRefolded } = setup(branches(4, 15));
    expect(result.current.warning).toEqual({ kind: "packed" });
    expect(result.current.zone).toBe(TOP_ZONE);
    expect(sorted(result.current.folded)).toEqual(["r0", "r1", "r2", "r3"]);
    expect(result.current.stepAt).toBe(0);
    expect(result.current.stepCount).toBe(5);
    expect(onRefolded).toHaveBeenCalled();
  });

  it("steps through the zones in order, and back", () => {
    const { result } = setup(branches(4, 15));
    act(() => result.current.step(1));
    expect(result.current.zone).toBe("r0");
    expect(sorted(result.current.folded)).toEqual(["r1", "r2", "r3"]);
    act(() => result.current.step(1));
    expect(result.current.zone).toBe("r1");
    act(() => result.current.step(-1));
    act(() => result.current.step(-1));
    act(() => result.current.step(-1));
    expect(result.current.zone).toBe(TOP_ZONE);
  });

  it("a card's +N goes to its zone while stepping", () => {
    const { result, toggleFold } = setup(branches(4, 15));
    act(() => result.current.openBranch("r2"));
    expect(result.current.zone).toBe("r2");
    expect(result.current.stepAt).toBe(3);
    expect(toggleFold).not.toHaveBeenCalled();
  });

  it("closing the banner stops stepping, every branch packed", () => {
    const { result } = setup(branches(4, 15));
    act(() => result.current.step(1));
    act(() => result.current.dismissWarning());
    expect(result.current.zone).toBeNull();
    expect(result.current.warning).toBeNull();
    expect(sorted(result.current.folded)).toEqual(["r0", "r1", "r2", "r3"]);
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

  it("after stepping, opening a branch that doesn't fit beside the open ones packs them", () => {
    const { result } = setup(branches(4, 30));
    act(() => result.current.step(1));
    act(() => result.current.dismissWarning());
    // r0 open by hand; opening r1 as well wouldn't fit.
    act(() => result.current.openBranch("r0"));
    act(() => result.current.openBranch("r1"));
    expect(sorted(result.current.folded)).toEqual(["r0", "r2", "r3"]);
  });

  it("outside the cards view a +N just opens its branch", () => {
    const { result, rerender, toggleFold } = setup(branches(2, 2), new Set(["r0"]));
    rerender({ active: false });
    act(() => result.current.openBranch("r0"));
    expect(toggleFold).toHaveBeenCalledWith("r0");
  });
});
