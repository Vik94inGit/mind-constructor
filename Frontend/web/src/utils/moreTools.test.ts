import { afterEach, describe, expect, it, vi } from "vitest";
import { loadLocalMoreTools, moreToolsOn, saveLocalMoreTools, subscribeLocalMoreTools } from "./moreTools";

describe("moreToolsOn", () => {
  it("follows the saved choice first", () => {
    expect(moreToolsOn(false, true, false)).toBe(false);
    expect(moreToolsOn(true, false, true)).toBe(true);
  });

  it("falls back to this browser's choice", () => {
    expect(moreToolsOn(undefined, false, false)).toBe(false);
    expect(moreToolsOn(undefined, true, true)).toBe(true);
  });

  it("keeps every tool for an account with nothing saved, and starts a demo simple", () => {
    expect(moreToolsOn(undefined, null, false)).toBe(true);
    expect(moreToolsOn(undefined, null, true)).toBe(false);
  });
});

describe("this browser's copy", () => {
  afterEach(() => localStorage.clear());

  it("remembers the switch and tells every listener", () => {
    const listener = vi.fn();
    const stop = subscribeLocalMoreTools(listener);
    expect(loadLocalMoreTools()).toBeNull();
    saveLocalMoreTools(false);
    expect(loadLocalMoreTools()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    saveLocalMoreTools(false);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    saveLocalMoreTools(true);
    expect(loadLocalMoreTools()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
