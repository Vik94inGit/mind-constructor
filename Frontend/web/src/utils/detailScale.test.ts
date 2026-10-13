import { describe, expect, it } from "vitest";
import { detailIndex, detailSteps } from "./detailScale";

describe("detailScale", () => {
  it("adds levels first, then text, simplest first", () => {
    expect(detailSteps(3)).toEqual([
      { level: 1, mode: "mixed" },
      { level: 2, mode: "mixed" },
      { level: null, mode: "mixed" },
      { level: null, mode: "actual" },
      { level: null, mode: "iconText" },
      { level: null, mode: "puzzle" },
    ]);
  });

  it("has only the view steps for a flat or empty map", () => {
    expect(detailSteps(1).map((s) => s.level)).toEqual([null, null, null, null]);
    expect(detailSteps(0)).toHaveLength(4);
  });

  it("finds the current step from the level and the view", () => {
    expect(detailIndex(3, 1, "mixed")).toBe(0);
    expect(detailIndex(3, 2, "puzzle")).toBe(1);
    expect(detailIndex(3, null, "mixed")).toBe(2);
    expect(detailIndex(3, null, "puzzle")).toBe(5);
    // A level at or past the map's depth shows everything.
    expect(detailIndex(3, 3, "actual")).toBe(3);
  });

  it("round-trips every step", () => {
    const steps = detailSteps(4);
    steps.forEach((s, i) => expect(detailIndex(4, s.level, s.mode)).toBe(i));
  });
});
