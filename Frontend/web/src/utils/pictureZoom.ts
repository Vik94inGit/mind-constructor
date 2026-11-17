// The picture viewer's zoom (map/PictureViewer.tsx): the picture is laid out
// whole in the screen ("fit"), then scaled by `scale` round its own center and
// moved by (x, y) screen pixels. Points are measured from the screen's center.
// A zoomed picture can be dragged only as far as its own edges, never off into
// an empty screen, and at scale 1 it sits still in the middle.

export interface ZoomView {
  scale: number;
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;
/** How far a double-tap (or double-click) zooms in from the fitted picture. */
export const DOUBLE_TAP_ZOOM = 2.5;
/** One press of − or +. */
export const ZOOM_STEP = 1.5;

export const FIT_VIEW: ZoomView = { scale: 1, x: 0, y: 0 };

/** The picture's size laid out whole inside `box`, never larger than `natural` times `upscale`. */
export function fitSize(natural: Size, box: Size, upscale = 1): Size {
  if (natural.w <= 0 || natural.h <= 0 || box.w <= 0 || box.h <= 0) return { w: 0, h: 0 };
  const k = Math.min(box.w / natural.w, box.h / natural.h, upscale);
  return { w: natural.w * k, h: natural.h * k };
}

function clampAxis(offset: number, picture: number, screen: number): number {
  const room = Math.max(0, (picture - screen) / 2);
  // `+ 0` turns a -0 into 0.
  return Math.min(room, Math.max(-room, offset)) + 0;
}

/** Keeps the scale within bounds and the picture covering what it can of the screen. */
export function clampView(view: ZoomView, fit: Size, box: Size): ZoomView {
  const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.scale));
  return {
    scale,
    x: clampAxis(view.x, fit.w * scale, box.w),
    y: clampAxis(view.y, fit.h * scale, box.h),
  };
}

/**
 * Zooms to `scale`, keeping the picture's spot under `point` (measured from
 * the screen's center) where it is: the finger, the pointer or the middle.
 */
export function zoomAt(view: ZoomView, scale: number, point: { x: number; y: number }, fit: Size, box: Size): ZoomView {
  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
  const k = next / view.scale;
  return clampView({ scale: next, x: point.x - (point.x - view.x) * k, y: point.y - (point.y - view.y) * k }, fit, box);
}

/** Drags the picture by (dx, dy) screen pixels. */
export function panBy(view: ZoomView, dx: number, dy: number, fit: Size, box: Size): ZoomView {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, fit, box);
}

/** A double-tap: in to DOUBLE_TAP_ZOOM at that spot, or back to the whole picture if already in. */
export function toggleZoom(view: ZoomView, point: { x: number; y: number }, fit: Size, box: Size): ZoomView {
  if (view.scale > MIN_ZOOM + 0.01) return FIT_VIEW;
  return zoomAt(view, DOUBLE_TAP_ZOOM, point, fit, box);
}

/** Whether a screen point (from the center) lands on the picture as it's shown now. */
export function onPicture(view: ZoomView, point: { x: number; y: number }, fit: Size): boolean {
  return (
    Math.abs(point.x - view.x) <= (fit.w * view.scale) / 2 && Math.abs(point.y - view.y) <= (fit.h * view.scale) / 2
  );
}
