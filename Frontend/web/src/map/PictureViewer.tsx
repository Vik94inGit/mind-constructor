import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n/I18nContext";
import { imageSrc } from "../utils/images";
import { FIT_VIEW, ZOOM_STEP, clampView, fitSize, onPicture, panBy, toggleZoom, zoomAt } from "../utils/pictureZoom";
import type { Size, ZoomView } from "../utils/pictureZoom";

interface Props {
  /** The pictures to step through (NodeDoc.images or a single icon/card picture). */
  sources: string[];
  /** The one shown first. */
  start?: number;
  onClose: () => void;
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// A tap moves less than this and lasts less than DOUBLE_TAP_MS.
const TAP_SLOP = 8;
const DOUBLE_TAP_MS = 300;
// A small picture (an icon's thumbnail) still fills a good share of the screen.
const UPSCALE = 4;
// Room left round the whole picture: the sides, and the bars top and bottom.
const EDGE = 12;
const BAR = 60;

const ctrlBtn =
  "flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-surface/90 px-3 text-[1rem] font-semibold leading-none text-ink shadow-card hover:bg-surface disabled:cursor-default disabled:opacity-40";

/**
 * A picture full screen, to look closer: pinch or the wheel zooms round the
 * fingers or pointer, a double-tap (double-click) goes in at that spot and
 * back out, a drag moves a zoomed picture, and − / + / ⤢ do the same from
 * buttons. A tap on the dark round the picture, ✕ or Escape closes it; with
 * several pictures ‹ › (or the arrow keys) step through them. Drawn into the
 * page's body so the canvas's own zoom never scales it.
 */
export function PictureViewer({ sources, start = 0, onClose }: Props) {
  const { t } = useI18n();
  const s = t.ui.images;
  const [index, setIndex] = useState(() => Math.min(Math.max(0, start), Math.max(0, sources.length - 1)));
  const [view, setView] = useState<ZoomView>(FIT_VIEW);
  const [natural, setNatural] = useState<Size>({ w: 0, h: 0 });
  const [box, setBox] = useState<Size>({ w: 0, h: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  // At its whole size the picture keeps clear of the bars above and below it.
  const fit = fitSize(natural, { w: box.w - 2 * EDGE, h: box.h - 2 * BAR }, UPSCALE);
  const src = sources[index];
  const several = sources.length > 1;

  // The latest values for the pointer handlers, which run between renders.
  const live = useRef({ view, fit, box });
  live.current = { view, fit, box };

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A new list (the full pictures arriving after a thumbnail) keeps the place.
  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, sources.length - 1)));
  }, [sources.length]);

  useEffect(() => {
    setView(FIT_VIEW);
  }, [src]);

  // The screen turned or resized: the picture stays within its edges.
  useEffect(() => {
    setView((v) => clampView(v, live.current.fit, live.current.box));
  }, [box.w, box.h, natural.w, natural.h]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const step = useCallback(
    (by: number) => {
      if (sources.length < 2) return;
      setIndex((i) => (i + by + sources.length) % sources.length);
    },
    [sources.length],
  );

  const zoomBy = useCallback((factor: number) => {
    const { view: v, fit: f, box: b } = live.current;
    setView(zoomAt(v, v.scale * factor, { x: 0, y: 0 }, f, b));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "+" || e.key === "=") zoomBy(ZOOM_STEP);
      else if (e.key === "-") zoomBy(1 / ZOOM_STEP);
      else if (e.key === "0") setView(FIT_VIEW);
      else return;
      e.preventDefault();
    };
    // Capture, so the map's own keys (Escape closing a panel, arrows stepping
    // nodes) don't also act while the picture is up.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, step, zoomBy]);

  // The wheel zooms round the pointer. Not passive, so the page doesn't scroll.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { view: v, fit: f, box: b } = live.current;
      const r = el.getBoundingClientRect();
      const point = { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
      setView(zoomAt(v, v.scale * Math.exp(-e.deltaY * 0.0025), point, f, b));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Pointers on the stage: one drags, two pinch; a quick tap off the picture
  // closes, two quick taps toggle the zoom.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; at: number; moved: boolean; pinch: { dist: number; scale: number } | null }>(
    { startX: 0, startY: 0, at: 0, moved: false, pinch: null },
  );
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null);

  function local(e: { clientX: number; clientY: number }) {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  }

  function pinchInfo() {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) {
      gesture.current = { startX: p.x, startY: p.y, at: Date.now(), moved: false, pinch: null };
    } else if (pointers.current.size === 2) {
      gesture.current.moved = true;
      gesture.current.pinch = { dist: Math.max(1, pinchInfo().dist), scale: live.current.view.scale };
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    const { view: v, fit: f, box: b } = live.current;
    if (pointers.current.size >= 2 && gesture.current.pinch) {
      const before = pinchInfo();
      pointers.current.set(e.pointerId, p);
      const after = pinchInfo();
      const zoomed = zoomAt(v, (gesture.current.pinch.scale * after.dist) / gesture.current.pinch.dist, after.mid, f, b);
      setView(panBy(zoomed, after.mid.x - before.mid.x, after.mid.y - before.mid.y, f, b));
      return;
    }
    pointers.current.set(e.pointerId, p);
    if (Math.hypot(p.x - gesture.current.startX, p.y - gesture.current.startY) > TAP_SLOP) gesture.current.moved = true;
    if (gesture.current.moved) setView(panBy(v, p.x - prev.x, p.y - prev.y, f, b));
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1) {
      // One finger left after a pinch: carry on dragging from where it is.
      const [rest] = [...pointers.current.values()];
      gesture.current = { startX: rest.x, startY: rest.y, at: 0, moved: true, pinch: null };
      return;
    }
    if (pointers.current.size > 0 || gesture.current.moved || e.type === "pointercancel") return;
    const { view: v, fit: f, box: b } = live.current;
    const now = Date.now();
    const prevTap = lastTap.current;
    if (prevTap && now - prevTap.at < DOUBLE_TAP_MS && Math.hypot(p.x - prevTap.x, p.y - prevTap.y) < TAP_SLOP * 3) {
      lastTap.current = null;
      setView(toggleZoom(v, p, f, b));
      return;
    }
    lastTap.current = { at: now, x: p.x, y: p.y };
    if (!onPicture(v, p, f)) onClose();
  }

  if (typeof document === "undefined" || !src) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-black/85"
      role="dialog"
      aria-modal="true"
      aria-label={s.viewerTitle}
      data-testid="picture-viewer"
      // Keep presses from reaching the map or panel underneath:
      // React passes a portal's events up to the node that opened it.
      onPointerDown={stop}
      onPointerMove={stop}
      onPointerUp={stop}
      onPointerCancel={stop}
      onClick={stop}
      onDoubleClick={stop}
      onContextMenu={stop}
      onWheel={stop}
      onKeyDown={stop}
    >
      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 touch-none overflow-hidden select-none"
        style={{ cursor: view.scale > 1 ? "grab" : "zoom-in" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img
          key={src}
          src={imageSrc(src)}
          alt=""
          draggable={false}
          onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className="pointer-events-none absolute top-1/2 left-1/2 max-w-none rounded-[4px] shadow-card"
          style={{
            width: fit.w || undefined,
            height: fit.h || undefined,
            visibility: fit.w ? "visible" : "hidden",
            transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
        />
      </div>
      <div className="absolute top-3 right-3 left-3 flex items-center justify-between gap-2">
        <span className="rounded-full bg-surface/90 px-3 py-1 text-[0.8rem] font-semibold text-ink shadow-card" aria-live="polite">
          {Math.round(view.scale * 100)}%{several ? ` · ${index + 1} / ${sources.length}` : ""}
        </span>
        <button ref={closeRef} type="button" className={ctrlBtn} aria-label={s.close} title={s.close} onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="pointer-events-none absolute right-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-0 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/40 p-1">
          {several && (
            <button type="button" className={ctrlBtn} aria-label={s.prev} title={s.prev} onClick={() => step(-1)}>
              ‹
            </button>
          )}
          <button type="button" className={ctrlBtn} aria-label={s.zoomOut} title={s.zoomOut} disabled={view.scale <= 1} onClick={() => zoomBy(1 / ZOOM_STEP)}>
            −
          </button>
          <button type="button" className={ctrlBtn} aria-label={s.zoomFit} title={s.zoomFit} disabled={view.scale <= 1} onClick={() => setView(FIT_VIEW)}>
            ⤢
          </button>
          <button type="button" className={ctrlBtn} aria-label={s.zoomIn} title={s.zoomIn} disabled={view.scale >= 8} onClick={() => zoomBy(ZOOM_STEP)}>
            +
          </button>
          {several && (
            <button type="button" className={ctrlBtn} aria-label={s.next} title={s.next} onClick={() => step(1)}>
              ›
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
