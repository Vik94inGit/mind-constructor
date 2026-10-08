import { describe, expect, it } from "vitest";
import { findFreeSpots } from "./freeSpots";
import { CANVAS_H, CANVAS_W } from "./canvasLayout";

const center = { x: CANVAS_W / 2, y: CANVAS_H / 2 };

describe("findFreeSpots", () => {
  it("starts at the center and keeps every spot `spacing` apart", () => {
    const spots = findFreeSpots(center, 7, [], 160);
    expect(spots).toHaveLength(7);
    expect(spots[0]).toEqual(center);
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        expect(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y)).toBeGreaterThanOrEqual(159.9);
      }
    }
  });

  it("stays clear of obstacles", () => {
    const obstacles = [{ x: center.x, y: center.y, minDist: 300 }];
    const spots = findFreeSpots(center, 5, obstacles, 160);
    expect(spots).toHaveLength(5);
    spots.forEach((p) => expect(Math.hypot(p.x - center.x, p.y - center.y)).toBeGreaterThanOrEqual(300));
  });

  it("returns fewer spots than asked when the canvas runs out of room", () => {
    const all = findFreeSpots(center, 10_000, [], 400);
    expect(all.length).toBeGreaterThan(0);
    expect(all.length).toBeLessThan(10_000);
    // Covering the whole canvas leaves no room at all.
    const covered = findFreeSpots(center, 5, [{ x: center.x, y: center.y, minDist: 5000 }], 160);
    expect(covered).toHaveLength(0);
  });
});
