import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStableActions } from "./useStableActions";

describe("useStableActions", () => {
  it("keeps the same object across renders", () => {
    const { result, rerender } = renderHook(({ n }) => useStableActions({ get: () => n }), { initialProps: { n: 1 } });
    const first = result.current;
    rerender({ n: 2 });
    expect(result.current).toBe(first);
    expect(result.current.get).toBe(first.get);
  });

  it("calls the newest callback passed in", () => {
    const { result, rerender } = renderHook(({ n }) => useStableActions({ add: (x: number) => x + n }), {
      initialProps: { n: 1 },
    });
    expect(result.current.add(10)).toBe(11);
    rerender({ n: 5 });
    expect(result.current.add(10)).toBe(15);
  });
});
