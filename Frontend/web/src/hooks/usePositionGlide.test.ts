import { describe, expect, it } from "vitest";
import { glideAmount, glideStarts } from "./usePositionGlide";

describe("glideStarts", () => {
  it("starts a moved node from where it was drawn", () => {
    const prev = new Map([["a", { x: 0, y: 0 }]]);
    const next = new Map([["a", { x: 100, y: 0 }]]);
    const shown = new Map([["a", { x: 40, y: 10 }]]);
    expect(glideStarts(prev, next, shown).get("a")).toEqual({ x: 40, y: 10 });
  });

  it("leaves new nodes and nodes already in place alone", () => {
    const prev = new Map([["a", { x: 0, y: 0 }]]);
    const next = new Map([
      ["a", { x: 0, y: 0 }],
      ["b", { x: 50, y: 50 }],
    ]);
    const shown = new Map([
      ["a", { x: 0.5, y: 0 }],
      ["b", { x: 0, y: 0 }],
    ]);
    expect(glideStarts(prev, next, shown).size).toBe(0);
  });
});

describe("glideAmount", () => {
  it("runs from 0 to 1 and stays inside it", () => {
    expect(glideAmount(-1)).toBe(0);
    expect(glideAmount(0)).toBe(0);
    expect(glideAmount(1)).toBe(1);
    expect(glideAmount(2)).toBe(1);
    expect(glideAmount(0.5)).toBeGreaterThan(0.5);
  });
});
