import { describe, expect, it } from "vitest";
import { closeOne, keepOpen, panelDevice, panelGrid, PANEL_LIMIT } from "./openPanels";

describe("panelDevice", () => {
  it("is a desktop in the desktop layout, else a phone below 640px", () => {
    expect(panelDevice(true, true)).toBe("desktop");
    expect(panelDevice(true, false)).toBe("tablet");
    expect(panelDevice(false, false)).toBe("phone");
  });
});

describe("keepOpen", () => {
  it("keeps the active panel open beside the new one", () => {
    expect(keepOpen([], "a", "b", 8)).toEqual(["a"]);
    expect(keepOpen(["a"], "b", "c", 8)).toEqual(["a", "b"]);
  });

  it("drops the oldest past the limit", () => {
    expect(keepOpen(["a"], "b", "c", PANEL_LIMIT.phone)).toEqual(["b"]);
    expect(keepOpen(["a", "b", "c", "d", "e"], "f", "g", PANEL_LIMIT.tablet)).toEqual(["b", "c", "d", "e", "f"]);
  });

  it("brings an already open panel forward without adding one", () => {
    expect(keepOpen(["a", "b"], "c", "a", 8)).toEqual(["b", "c"]);
    expect(keepOpen(["a"], "b", "b", 8)).toEqual(["a"]);
  });

  it("adds nothing when no panel was open", () => {
    expect(keepOpen([], null, "a", 8)).toEqual([]);
  });
});

describe("closeOne", () => {
  it("drops another panel and keeps the active one", () => {
    expect(closeOne(["a", "b"], "c", "a")).toEqual({ others: ["b"], active: "c" });
  });

  it("makes the most recent other active when the active one closes", () => {
    expect(closeOne(["a", "b"], "c", "c")).toEqual({ others: ["a"], active: "b" });
    expect(closeOne([], "c", "c")).toEqual({ others: [], active: null });
  });
});

describe("panelGrid", () => {
  it("lays panels side by side, then in a second row", () => {
    expect(panelGrid(1, "desktop")).toEqual({ columns: 1, rows: 1 });
    expect(panelGrid(3, "desktop")).toEqual({ columns: 3, rows: 1 });
    expect(panelGrid(8, "desktop")).toEqual({ columns: 4, rows: 2 });
    expect(panelGrid(6, "tablet")).toEqual({ columns: 3, rows: 2 });
    expect(panelGrid(2, "phone")).toEqual({ columns: 1, rows: 2 });
    expect(panelGrid(0, "phone")).toEqual({ columns: 0, rows: 0 });
  });
});
