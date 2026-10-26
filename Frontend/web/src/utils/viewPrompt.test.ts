import { beforeEach, describe, expect, it } from "vitest";
import { currentView, shouldAskView, stopAskingView } from "./viewPrompt";

describe("viewPrompt", () => {
  beforeEach(() => localStorage.clear());

  it("reads the view from the reading mode and the overview", () => {
    expect(currentView("puzzle", true)).toBe("cards");
    expect(currentView("mixed", true)).toBe("overview");
    expect(currentView("mixed", false)).toBe("map");
  });

  it("asks until told not to", () => {
    expect(shouldAskView()).toBe(true);
    stopAskingView();
    expect(shouldAskView()).toBe(false);
  });
});
