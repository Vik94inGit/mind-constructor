import { afterEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBackGuard } from "./useBackGuard";

describe("useBackGuard", () => {
  afterEach(() => window.history.replaceState(null, ""));

  it("adds one guard entry on top, keeping the existing history state", () => {
    window.history.replaceState({ idx: 3, key: "k" }, "");
    const before = window.history.length;
    renderHook(() => useBackGuard());
    expect(window.history.length).toBe(before + 1);
    expect(window.history.state).toEqual({ idx: 3, key: "k", mcBackGuard: true });
  });

  it("puts the guard back after going back", () => {
    window.history.replaceState({ idx: 1 }, "");
    renderHook(() => useBackGuard());
    // What landing back on the real entry looks like.
    window.history.replaceState({ idx: 1 }, "");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(window.history.state).toEqual({ idx: 1, mcBackGuard: true });
  });

  it("does nothing when off", () => {
    window.history.replaceState({ idx: 1 }, "");
    const before = window.history.length;
    renderHook(() => useBackGuard(false));
    expect(window.history.length).toBe(before);
  });
});
