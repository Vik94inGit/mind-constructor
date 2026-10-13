import { describe, expect, it } from "vitest";
import { ZONE_PALETTE_HEX, zoneColorFor } from "./zoneStyle";
import { ZONE_COLORS } from "./nodeType";
import { makeNode } from "../test/fixtures";

describe("zoneColorFor", () => {
  it("uses the parent's palette pick, else the sentiment colour", () => {
    expect(zoneColorFor(makeNode({ nodeId: "r", zoneColor: "rose" }), "negative")).toBe(ZONE_PALETTE_HEX.rose);
    expect(zoneColorFor(makeNode({ nodeId: "r" }), "negative")).toBe(ZONE_COLORS.negative);
    expect(zoneColorFor(undefined, "neutral")).toBe(ZONE_COLORS.neutral);
  });
});
