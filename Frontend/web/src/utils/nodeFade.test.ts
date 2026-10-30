import { beforeEach, describe, expect, it } from "vitest";
import { autoNodeFade, clampNodeFade, loadNodeFade, nodeFadeStyle, saveNodeFade } from "./nodeFade";

describe("nodeFade", () => {
  beforeEach(() => localStorage.clear());

  it("is unset until the viewer picks one, and keeps their pick in this browser", () => {
    expect(loadNodeFade()).toBeNull();
    saveNodeFade(0);
    expect(loadNodeFade()).toBe(0);
    saveNodeFade(null);
    expect(loadNodeFade()).toBeNull();
  });

  it("keeps a fade between 0 and 100", () => {
    expect(clampNodeFade(140)).toBe(100);
    expect(clampNodeFade(-5)).toBe(0);
    expect(clampNodeFade(33.6)).toBe(34);
    expect(clampNodeFade("50")).toBeNull();
  });

  it("hands the canvas a 0..1 fade only once one is picked", () => {
    expect(nodeFadeStyle(null)).toEqual({});
    expect(nodeFadeStyle(40)).toEqual({ "--node-fade": 0.4 });
  });

  it("fades less over a picture by default", () => {
    expect(autoNodeFade(false)).toBe(100);
    expect(autoNodeFade(true)).toBeLessThan(100);
  });
});
