import { describe, expect, it } from "vitest";
import { FULL_CROP, MIN_CROP, cropPixels, isFullCrop, moveCrop, resizeCrop } from "./cropRect";

const close = (a: object, b: Record<string, number>) => {
  for (const [k, v] of Object.entries(b)) expect((a as Record<string, number>)[k]).toBeCloseTo(v, 6);
};

describe("moveCrop", () => {
  it("moves the frame", () => {
    close(moveCrop({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 0.1, -0.1), { x: 0.3, y: 0.1, w: 0.5, h: 0.5 });
  });

  it("stops at the picture's edges", () => {
    close(moveCrop({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, 1, -1), { x: 0.5, y: 0, w: 0.5, h: 0.5 });
  });

  it("can't move the whole picture", () => {
    expect(moveCrop(FULL_CROP, 0.3, 0.3)).toEqual(FULL_CROP);
  });
});

describe("resizeCrop", () => {
  it("drags the bottom-right corner, the top-left one staying put", () => {
    close(resizeCrop(FULL_CROP, "se", -0.4, -0.3), { x: 0, y: 0, w: 0.6, h: 0.7 });
  });

  it("drags the top-left corner, the bottom-right one staying put", () => {
    close(resizeCrop(FULL_CROP, "nw", 0.25, 0.5), { x: 0.25, y: 0.5, w: 0.75, h: 0.5 });
  });

  it("drags the top-right and bottom-left corners", () => {
    close(resizeCrop(FULL_CROP, "ne", -0.2, 0.1), { x: 0, y: 0.1, w: 0.8, h: 0.9 });
    close(resizeCrop(FULL_CROP, "sw", 0.3, -0.4), { x: 0.3, y: 0, w: 0.7, h: 0.6 });
  });

  it("never grows past the picture", () => {
    close(resizeCrop({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, "se", 2, 2), { x: 0.2, y: 0.2, w: 0.8, h: 0.8 });
    close(resizeCrop({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, "nw", -2, -2), { x: 0, y: 0, w: 0.7, h: 0.7 });
  });

  it("never shrinks below the smallest frame, nor flips over", () => {
    const r = resizeCrop({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, "se", -2, -2);
    close(r, { x: 0.2, y: 0.2, w: MIN_CROP, h: MIN_CROP });
    const l = resizeCrop({ x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, "nw", 2, 2);
    close(l, { x: 0.7 - MIN_CROP, y: 0.7 - MIN_CROP, w: MIN_CROP, h: MIN_CROP });
  });
});

describe("isFullCrop", () => {
  it("tells the whole picture from a part of it", () => {
    expect(isFullCrop(FULL_CROP)).toBe(true);
    expect(isFullCrop({ x: 0, y: 0, w: 0.9, h: 1 })).toBe(false);
  });
});

describe("cropPixels", () => {
  it("turns the frame into whole pixels", () => {
    expect(cropPixels({ x: 0.25, y: 0.5, w: 0.5, h: 0.5 }, 800, 600)).toEqual({ sx: 200, sy: 300, sw: 400, sh: 300 });
  });

  it("stays inside the picture after rounding, at least a pixel each way", () => {
    expect(cropPixels({ x: 0.999, y: 0.999, w: 0.1, h: 0.1 }, 10, 10)).toEqual({ sx: 9, sy: 9, sw: 1, sh: 1 });
    expect(cropPixels(FULL_CROP, 3, 2)).toEqual({ sx: 0, sy: 0, sw: 3, sh: 2 });
  });
});
