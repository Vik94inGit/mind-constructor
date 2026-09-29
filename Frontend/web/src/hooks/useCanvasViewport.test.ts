import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCanvasViewport } from "./useCanvasViewport";

// jsdom has no ResizeObserver; nothing here needs it to fire.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
  },
);

// A mounted scroll wrapper of a given size — jsdom has no layout, so the
// size is set on the element directly.
function sized(w: number, h: number) {
  const el = document.createElement("div");
  Object.defineProperty(el, "clientWidth", { value: w, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: h, configurable: true });
  el.scrollTo = () => {};
  return el;
}

function margins(sheetOpen: boolean, width = 1400) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  const hook = renderHook(
    ({ sheet }) => {
      const v = useCanvasViewport({ mapId: "m", loading: false, sheetOpen: sheet, positions: new Map() });
      if (!v.wrapRef.current) v.wrapRef.current = sized(1400, 900);
      return v;
    },
    { initialProps: { sheet: sheetOpen } },
  );
  // The margins are derived from the measured view size, which the first
  // effect reads off the wrap — re-render once it's been attached.
  hook.rerender({ sheet: sheetOpen });
  return hook;
}

describe("useCanvasViewport dead zone", () => {
  afterEach(() => {
    Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
  });

  it("is a narrow fixed band, not half the screen", () => {
    const { result } = margins(false);
    // A 1400x900 view used to get 700px/450px+ of dead zone per side.
    expect(result.current.hScrollMargin).toBeLessThanOrEqual(240);
    expect(result.current.vScrollMargin).toBeLessThanOrEqual(240);
    expect(result.current.vScrollMarginBottom).toBe(result.current.vScrollMargin);
  });

  it("grows only the bottom edge while the bottom sheet is open", () => {
    const { result } = margins(true);
    expect(result.current.vScrollMarginBottom).toBeGreaterThan(result.current.vScrollMargin);
    expect(result.current.vScrollMargin).toBeLessThanOrEqual(240);
  });
});
