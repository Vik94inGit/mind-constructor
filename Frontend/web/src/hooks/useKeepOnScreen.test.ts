import { describe, expect, it } from "vitest";
import { keepOnScreenShift } from "./useKeepOnScreen";

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
