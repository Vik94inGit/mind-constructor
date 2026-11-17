import { describe, expect, it } from "vitest";
import { FIT_VIEW, MAX_ZOOM, clampView, fitSize, onPicture, panBy, toggleZoom, zoomAt } from "./pictureZoom";

const box = { w: 400, h: 800 };
const fit = { w: 400, h: 300 };

describe("fitSize", () => {
  it("lays a wide picture out across the screen's width", () => {
    expect(fitSize({ w: 2000, h: 1500 }, box)).toEqual({ w: 400, h: 300 });
  });
  it("never blows a small picture up past its own size", () => {
    expect(fitSize({ w: 100, h: 50 }, box)).toEqual({ w: 100, h: 50 });
  });
  it("blows a small picture up as far as asked", () => {
    expect(fitSize({ w: 100, h: 50 }, box, 2)).toEqual({ w: 200, h: 100 });
  });
  it("is empty before the picture has loaded", () => {
    expect(fitSize({ w: 0, h: 0 }, box)).toEqual({ w: 0, h: 0 });
  });
});

describe("clampView", () => {
  it("keeps the whole picture still in the middle", () => {
    expect(clampView({ scale: 1, x: 50, y: -20 }, fit, box)).toEqual(FIT_VIEW);
  });
  it("holds the scale between whole and the most zoom", () => {
    expect(clampView({ scale: 0.3, x: 0, y: 0 }, fit, box).scale).toBe(1);
    expect(clampView({ scale: 40, x: 0, y: 0 }, fit, box).scale).toBe(MAX_ZOOM);
  });
  it("lets a zoomed picture move only as far as its own edges", () => {
    // 2x: 800 wide on a 400 screen, 200 of room each way; 600 tall in 800, none.
    expect(clampView({ scale: 2, x: 500, y: 90 }, fit, box)).toEqual({ scale: 2, x: 200, y: 0 });
  });
});

describe("zoomAt", () => {
  it("keeps the spot under the finger where it is", () => {
    const v = zoomAt(FIT_VIEW, 2, { x: 100, y: 0 }, fit, box);
    expect(v).toEqual({ scale: 2, x: -100, y: 0 });
    // The spot 100px right of the picture's center was under the finger; at
    // 2x it is 200px from the center, and the center moved to -100: still 100.
    expect(v.x + 100 * v.scale).toBe(100);
  });
  it("zooming out to whole brings the picture back to the middle", () => {
    expect(zoomAt({ scale: 3, x: 150, y: 0 }, 1, { x: 0, y: 0 }, fit, box)).toEqual(FIT_VIEW);
  });
});

describe("panBy", () => {
  it("drags a zoomed picture and stops at its edge", () => {
    expect(panBy({ scale: 2, x: 0, y: 0 }, 150, 0, fit, box).x).toBe(150);
    expect(panBy({ scale: 2, x: 150, y: 0 }, 150, 0, fit, box).x).toBe(200);
  });
});

describe("toggleZoom", () => {
  it("goes in at the tapped spot, then back to the whole picture", () => {
    const zoomed = toggleZoom(FIT_VIEW, { x: 0, y: 0 }, fit, box);
    expect(zoomed.scale).toBe(2.5);
    expect(toggleZoom(zoomed, { x: 0, y: 0 }, fit, box)).toEqual(FIT_VIEW);
  });
});

describe("onPicture", () => {
  it("tells the picture from the dark round it", () => {
    expect(onPicture(FIT_VIEW, { x: 0, y: 100 }, fit)).toBe(true);
    expect(onPicture(FIT_VIEW, { x: 0, y: 200 }, fit)).toBe(false);
  });
});
