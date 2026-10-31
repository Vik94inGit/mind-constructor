import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n/I18nContext";
import { FULL_CROP, moveCrop, resizeCrop } from "../utils/cropRect";
import type { CropCorner, CropRect } from "../utils/cropRect";

interface Props {
  /** The picture to choose a part of. */
  file: Blob;
  /** The part kept, as fractions of the picture (utils/cropRect.ts). */
  onDone: (rect: CropRect) => void;
  onCancel: () => void;
}

const CORNERS: CropCorner[] = ["nw", "ne", "sw", "se"];

// Choosing the part of a picture that becomes the map's background, before it
// is uploaded (or again later, from the picture already set). The picture is
// shown whole over the map; a frame on it starts round all of it. Drag inside
// the frame to move it, drag a corner to resize it — mouse, pen or finger
// alike (pointer events, no page scroll or zoom while dragging). Outside the
// frame the picture is dimmed, so what's kept is plain to see.
export function PictureCropDialog({ file, onDone, onCancel }: Props) {
  const { t } = useI18n();
  const s = t.ui.mapBackground;
  const src = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(src), [src]);
  const [rect, setRect] = useState<CropRect>(FULL_CROP);
  const boxRef = useRef<HTMLDivElement | null>(null);
  // The drag in progress: what it moves, where the pointer started, the frame then, and the picture's drawn size.
  const drag = useRef<{ id: number; what: "move" | CropCorner; x: number; y: number; start: CropRect; w: number; h: number } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  function begin(what: "move" | CropCorner) {
    return (e: ReactPointerEvent<HTMLElement>) => {
      const box = boxRef.current?.getBoundingClientRect();
      if (!box || !box.width || !box.height) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      drag.current = { id: e.pointerId, what, x: e.clientX, y: e.clientY, start: rect, w: box.width, h: box.height };
    };
  }
  function onMove(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = (e.clientX - d.x) / d.w;
    const dy = (e.clientY - d.y) / d.h;
    setRect(d.what === "move" ? moveCrop(d.start, dx, dy) : resizeCrop(d.start, d.what, dx, dy));
  }
  function end(e: ReactPointerEvent<HTMLElement>) {
    if (drag.current?.id === e.pointerId) drag.current = null;
  }

  const pct = (v: number) => `${v * 100}%`;
  const btn = "cursor-pointer rounded-full border-0 px-4 py-2 text-[0.85rem] font-semibold";
  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={s.cropTitle}>
      <div className="text-center text-white">
        <div className="text-[0.95rem] font-semibold">{s.cropTitle}</div>
        <div className="text-[0.8rem] opacity-80">{s.cropHint}</div>
      </div>
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <div ref={boxRef} className="relative max-h-full max-w-full touch-none select-none">
          <img src={src} alt="" draggable={false} className="block max-h-[calc(100dvh-10rem)] max-w-full object-contain" />
          {/* The dimmed picture round the frame, clipped to the picture so it doesn't reach the title or buttons. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute"
              style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h), boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
            />
          </div>
          <div
            data-testid="crop-frame"
            aria-label={s.cropFrame}
            className="absolute cursor-move border-2 border-white"
            style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
            onPointerDown={begin("move")}
            onPointerMove={onMove}
            onPointerUp={end}
            onPointerCancel={end}
          >
            {CORNERS.map((c) => (
              <span
                key={c}
                data-testid={`crop-${c}`}
                // A big touch target round a small visible knob.
                className={`absolute flex h-10 w-10 items-center justify-center ${c[0] === "n" ? "-top-5" : "-bottom-5"} ${c[1] === "w" ? "-left-5" : "-right-5"} ${
                  c === "nw" || c === "se" ? "cursor-nwse-resize" : "cursor-nesw-resize"
                }`}
                // Its moves and lift bubble up to the frame's handlers.
                onPointerDown={begin(c)}
              >
                <span aria-hidden className="h-4 w-4 rounded-full border-2 border-white bg-[var(--accent)] shadow" />
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" className={`${btn} bg-white/15 text-white`} onClick={onCancel}>
          {s.cropCancel}
        </button>
        <button type="button" className={`${btn} bg-white/15 text-white`} onClick={() => setRect(FULL_CROP)}>
          {s.cropWhole}
        </button>
        <button type="button" className={`${btn} bg-[var(--accent)] text-white`} onClick={() => onDone(rect)}>
          {s.cropUse}
        </button>
      </div>
    </div>,
    document.body,
  );
}
