import { beforeEach, describe, expect, it } from "vitest";
import { loadZoneDisplay, saveZoneDisplay, zoneModeByNode } from "./zoneDisplay";
import type { NodeGroup } from "./canvasLayout";
import type { NodeDoc } from "../types";

const n = (nodeId: string) => ({ nodeId }) as NodeDoc;
const group = (rootId: string, memberIds: string[]): NodeGroup => ({
  rootId,
  members: [n(rootId), ...memberIds.map(n)],
  sentiment: "neutral",
  cx: 0,
  cy: 0,
  r: 0,
  outline: [],
});

describe("zoneModeByNode", () => {
  it("gives every member its zone's mode", () => {
    const modes = zoneModeByNode([group("a", ["a1", "a2"])], { a: "puzzle" });
    expect(modes.get("a")).toBe("puzzle");
    expect(modes.get("a2")).toBe("puzzle");
  });

  it("lets the zone a node roots win over the zone it's a member of", () => {
    const modes = zoneModeByNode([group("a", ["b", "a1"]), group("b", ["b1", "b2"])], { a: "dots", b: "puzzle" });
    expect(modes.get("b")).toBe("puzzle");
    expect(modes.get("a1")).toBe("dots");
  });

  it("leaves zones with no mode alone", () => {
    expect(zoneModeByNode([group("a", ["a1"])], {}).size).toBe(0);
  });
});

describe("load/saveZoneDisplay", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips per map and drops unknown modes", () => {
    saveZoneDisplay("m1", { a: "dots", b: "mixed" });
    expect(loadZoneDisplay("m1")).toEqual({ a: "dots", b: "mixed" });
    expect(loadZoneDisplay("m2")).toEqual({});
    localStorage.setItem("mc_zone_display:m3", JSON.stringify({ a: "nope" }));
    expect(loadZoneDisplay("m3")).toEqual({});
  });
});
