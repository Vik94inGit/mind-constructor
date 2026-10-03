import { describe, expect, it } from "vitest";
import { chaosStyle, flightOffset } from "./nodeCardMotion";

describe("nodeCardMotion", () => {
  it("gives each node the same flight direction every time, 140–200px out", () => {
    const a = flightOffset("node-a");
    expect(flightOffset("node-a")).toEqual(a);
    expect(flightOffset("node-b")).not.toEqual(a);
    const dist = Math.hypot(a.x, a.y);
    expect(dist).toBeGreaterThanOrEqual(140);
    expect(dist).toBeLessThanOrEqual(200);
  });

  it("drifts within 10px on a stable, slow, mid-cycle clock", () => {
    const style = chaosStyle("node-a") as Record<string, string>;
    expect(chaosStyle("node-a")).toEqual(style);
    for (const key of ["--chaos-x1", "--chaos-y1", "--chaos-x2", "--chaos-y2", "--chaos-x3", "--chaos-y3"]) {
      expect(Math.abs(parseFloat(style[key]))).toBeLessThanOrEqual(10);
    }
    const duration = parseFloat(style.animationDuration);
    expect(duration).toBeGreaterThanOrEqual(4.8);
    expect(duration).toBeLessThanOrEqual(8.4);
    expect(style.animationDelay.startsWith("-")).toBe(true);
  });
});
