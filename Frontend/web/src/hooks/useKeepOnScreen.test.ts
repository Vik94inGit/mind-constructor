import { describe, expect, it } from "vitest";
import { keepOnScreenLift, keepOnScreenShift } from "./useKeepOnScreen";

describe("keepOnScreenShift", () => {
  it("leaves a popover that fits alone", () => {
    expect(keepOnScreenShift({ left: 20, right: 300 }, 390)).toBe(0);
  });

  it("slides one hanging past the right edge back on screen", () => {
    // The search box under a phone toolbar's search button: 255..555 on a 390px screen.
    expect(keepOnScreenShift({ left: 255, right: 555 }, 390)).toBe(-173);
  });

  it("never slides past the left edge", () => {
    expect(keepOnScreenShift({ left: 40, right: 600 }, 390)).toBe(-32);
  });
});

describe("keepOnScreenLift", () => {
  it("leaves a popover whose bottom is on screen alone", () => {
    expect(keepOnScreenLift({ top: 100, bottom: 600 }, 720)).toBe(0);
  });

  it("lifts a menu running off the bottom back on screen", () => {
    // Display options beside the desktop toolbar's button: 200..884 in a 680px window.
    expect(keepOnScreenLift({ top: 200, bottom: 884 }, 680)).toBe(-192);
  });

  it("never lifts past the top edge", () => {
    expect(keepOnScreenLift({ top: 50, bottom: 1200 }, 680)).toBe(-42);
  });
});
