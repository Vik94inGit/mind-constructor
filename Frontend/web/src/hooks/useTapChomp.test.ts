import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TAP_CHOMP_MS, useTapChomp } from "./useTapChomp";

const nodes = [
  { nodeId: "spear", isWeapon: true, weaponIcon: "spear" as const },
  { nodeId: "sword", isWeapon: true, weaponIcon: "sword" as const },
  { nodeId: "target" },
];

type Props = { selected: string | null; stepped: string | null };

function setup(initial: Props) {
  return renderHook(({ selected, stepped }: Props) => useTapChomp(selected, stepped, nodes), { initialProps: initial });
}

describe("useTapChomp", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs a tapped strong attack once, then stops", () => {
    const { result, rerender } = setup({ selected: null, stepped: null });
    rerender({ selected: "spear", stepped: null });
    expect(result.current).toBe("spear");
    act(() => vi.advanceTimersByTime(TAP_CHOMP_MS));
    expect(result.current).toBeNull();
  });

  it("leaves a nitpick, the attacked node and a node stepped onto alone", () => {
    const { result, rerender } = setup({ selected: "sword", stepped: null });
    expect(result.current).toBeNull();
    rerender({ selected: "target", stepped: null });
    expect(result.current).toBeNull();
    rerender({ selected: "spear", stepped: "spear" });
    expect(result.current).toBeNull();
  });

  it("stops as soon as the attack is deselected", () => {
    const { result, rerender } = setup({ selected: "spear", stepped: null });
    expect(result.current).toBe("spear");
    rerender({ selected: null, stepped: null });
    expect(result.current).toBeNull();
  });
});
