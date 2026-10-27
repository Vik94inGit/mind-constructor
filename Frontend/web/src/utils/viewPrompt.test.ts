import { beforeEach, describe, expect, it } from "vitest";
import { currentView, loadRememberedView, rememberView } from "./viewPrompt";

describe("viewPrompt", () => {
  beforeEach(() => localStorage.clear());

  it("reads the view from the reading mode and the overview", () => {
    expect(currentView("puzzle", true)).toBe("cards");
    expect(currentView("mixed", true)).toBe("overview");
    expect(currentView("mixed", false)).toBe("map");
  });

  it("has no answer until one is kept, then keeps it", () => {
    expect(loadRememberedView()).toBeNull();
    rememberView("overview");
    expect(loadRememberedView()).toBe("overview");
  });
});
