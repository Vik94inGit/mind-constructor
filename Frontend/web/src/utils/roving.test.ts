import { describe, expect, it } from "vitest";
import { nextRovingIndex } from "./roving";

describe("nextRovingIndex", () => {
  it("walks forward and back, wrapping round the row", () => {
    expect(nextRovingIndex("ArrowRight", 0, 3)).toBe(1);
    expect(nextRovingIndex("ArrowDown", 2, 3)).toBe(0);
    expect(nextRovingIndex("ArrowLeft", 0, 3)).toBe(2);
    expect(nextRovingIndex("ArrowUp", 2, 3)).toBe(1);
  });

  it("jumps to the ends with Home and End", () => {
    expect(nextRovingIndex("Home", 2, 4)).toBe(0);
    expect(nextRovingIndex("End", 0, 4)).toBe(3);
  });

  it("leaves other keys and an empty row alone", () => {
    expect(nextRovingIndex("Tab", 1, 3)).toBeNull();
    expect(nextRovingIndex("Enter", 1, 3)).toBeNull();
    expect(nextRovingIndex("ArrowRight", 0, 0)).toBeNull();
  });
});
