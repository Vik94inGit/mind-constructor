// The part of a picture the owner keeps as the map's background
// (map/PictureCropDialog.tsx): a frame over the picture, kept as fractions of
// its width and height (0..1) so it doesn't care how big the picture is drawn.
// Dragging inside the frame moves it, dragging a corner resizes it; it never
// leaves the picture and never shrinks below MIN_CROP.

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type CropCorner = "nw" | "ne" | "sw" | "se";

/** The whole picture. */
export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

/** The smallest frame, as a fraction of each side: a sliver would only blur on the map. */
export const MIN_CROP = 0.1;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** `r` moved by (dx, dy), stopped at the picture's edges. */
export function moveCrop(r: CropRect, dx: number, dy: number): CropRect {
  return { ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) };
}

/**
 * `r` with `corner` dragged by (dx, dy); the opposite corner stays put. The
 * dragged corner stops at the picture's edges and MIN_CROP from the other one.
 */
export function resizeCrop(r: CropRect, corner: CropCorner, dx: number, dy: number): CropRect {
  let left = r.x;
  let top = r.y;
  let right = r.x + r.w;
  let bottom = r.y + r.h;
  if (corner === "nw" || corner === "sw") left = clamp(left + dx, 0, right - MIN_CROP);
  else right = clamp(right + dx, left + MIN_CROP, 1);
  if (corner === "nw" || corner === "ne") top = clamp(top + dy, 0, bottom - MIN_CROP);
  else bottom = clamp(bottom + dy, top + MIN_CROP, 1);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** True when `r` keeps (all but a hair of) the whole picture, so there is nothing to cut. */
export function isFullCrop(r: CropRect): boolean {
  const eps = 0.001;
  return r.x <= eps && r.y <= eps && r.w >= 1 - eps && r.h >= 1 - eps;
}

/** `r` in pixels of a picture `width` × `height`: whole pixels, at least one each way, inside the picture. */
export function cropPixels(r: CropRect, width: number, height: number): { sx: number; sy: number; sw: number; sh: number } {
  const sx = clamp(Math.round(r.x * width), 0, Math.max(0, width - 1));
  const sy = clamp(Math.round(r.y * height), 0, Math.max(0, height - 1));
  const sw = clamp(Math.round(r.w * width), 1, width - sx);
  const sh = clamp(Math.round(r.h * height), 1, height - sy);
  return { sx, sy, sw, sh };
}
