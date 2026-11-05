import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAutoPack } from "./useAutoPack";
import { makeNode } from "../test/fixtures";

const nodes = [
  makeNode({ nodeId: "root" }),
  makeNode({ nodeId: "a", parentId: "root" }),
  makeNode({ nodeId: "b", parentId: "root" }),
];

describe("useAutoPack", () => {
  beforeEach(() => localStorage.clear());

  it("packs a parent's branch in and out, and keeps it for the map", () => {
    const { result } = renderHook(() => useAutoPack("m1", nodes));
    expect(result.current.mapParents.has("root")).toBe(true);
    act(() => result.current.toggleFold("root"));
    expect(result.current.folded.has("root")).toBe(true);
    expect(result.current.overviewOn).toBe(true);
    expect([...result.current.fold.hidden].sort()).toEqual(["a", "b"]);
    expect(renderHook(() => useAutoPack("m1", nodes)).result.current.folded.has("root")).toBe(true);
    act(() => result.current.toggleFold("root"));
    expect(result.current.fold.hidden.size).toBe(0);
  });

  it("turns the overview on and off", () => {
    const { result } = renderHook(() => useAutoPack("m1", nodes));
    act(() => result.current.setOverview(true));
    expect(result.current.overviewOn).toBe(true);
    act(() => result.current.setOverview(false));
    expect(result.current.overviewOn).toBe(false);
  });

  it("packs every parent at once, leaving the tops, and unpacks them all", () => {
    const deep = [...nodes, makeNode({ nodeId: "a1", parentId: "a" })];
    const { result } = renderHook(() => useAutoPack("m1", deep));
    act(() => result.current.packAll());
    expect([...result.current.folded].sort()).toEqual(["a", "root"]);
    expect([...result.current.fold.hidden].sort()).toEqual(["a", "a1", "b"]);
    expect(result.current.fold.counts.get("root")).toBe(3);
    act(() => result.current.toggleFold("root"));
    expect([...result.current.fold.hidden]).toEqual(["a1"]);
    expect(result.current.fold.counts.get("a")).toBe(1);
    act(() => result.current.unpackAll());
    expect(result.current.fold.hidden.size).toBe(0);
  });
});
