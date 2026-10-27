import type { CSSProperties, MouseEvent, MutableRefObject, PointerEvent, ReactNode } from "react";
import { CANVAS_W, CANVAS_H } from "../utils/canvasLayout";

interface Props {
  wrapRef: MutableRefObject<HTMLDivElement | null>;
  canvasRef: MutableRefObject<HTMLDivElement | null>;
  zoom: number;
  hScrollMargin: number;
  vScrollMargin: number;
  vScrollMarginBottom: number;
  /** The map's own background (Map.background — utils/mapBackground.ts). */
  background: { className: string; style: CSSProperties };
  /** A mode that picks nodes by tapping them: the cursor turns to a crosshair. */
  crosshair: boolean;
  /** A tap on the hatched band round the canvas, outside the map. */
  onBlindZoneClick: () => void;
  /** Any press or wheel anywhere on the canvas (the entrance's skip). */
  onAnyPress: () => void;
  onClick: (e: MouseEvent<HTMLDivElement>) => void;
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: PointerEvent<HTMLDivElement>) => void;
  onContextMenu: (e: MouseEvent<HTMLDivElement>) => void;
  /** Everything drawn on the canvas, in its own 2400x1600 coordinates. */
  children: ReactNode;
}

// The map's scrolling canvas: the scroll area, the zoomed, padded wrapper
// with its hatched blind zone, and the canvas itself, inset within it. What
// is drawn on the canvas is MapPage's (children).
export function CanvasFrame({
  wrapRef,
  canvasRef,
  zoom,
  hScrollMargin,
  vScrollMargin,
  vScrollMarginBottom,
  background,
  crosshair,
  onBlindZoneClick,
  onAnyPress,
  onClick,
  onPointerDown,
  onPointerMove,
  onContextMenu,
  children,
}: Props) {
  return (
    <>
      {/* [overscroll-behavior-x:none]: index.css already sets this on
          <body>, but that only stops the *document's* own overscroll
          from chaining into a browser back-navigation — this canvas is
          its own independently-scrolling element (overflow-auto), so
          a trackpad swipe that runs it into its own left scroll edge
          (scrollLeft 0) was still handing the overscroll off to the
          page above it, which is what a laptop's two-finger swipe
          reads as "go back." Setting it here too stops the chain at
          the canvas itself, before it ever reaches the document. */}
      <div
        // pan-x pan-y: one finger still scrolls the canvas natively, but the
        // browser doesn't pinch-zoom the page here — two fingers zoom the
        // map instead (see useCanvasViewport).
        className="h-full w-full touch-pan-x touch-pan-y overflow-auto [overscroll-behavior-x:none]"
        ref={wrapRef}
      >
      {/* Padded outer sizing/transform wrapper — canvasRef (the real
          canvas, unchanged below) sits inset within this by
          hScrollMargin/vScrollMargin on every side (see their own doc
          comment) instead of filling it edge-to-edge the way it used
          to. Without this extra margin, wrap could never scroll any
          node closer to center than "the canvas's own edge is at the
          edge of the viewport" — a node right at/near the real
          0/CANVAS_W/CANVAS_H edge had nowhere left to scroll to, so
          centerOnNode's own clamp pinned it right there, and
          QuickAddGhosts/the radial ring's own safe-zone clamp then
          visibly detached their ring from a node sitting outside it.
          Carries the zoom transform (moved up from canvasRef itself)
          so the margin scales right along with the real content — a
          plain fixed pixel margin at zoom 1 would read as a much
          smaller (or larger) safety net once zoomed. transformOrigin
          "0 0" keeps that scaling anchored at this wrapper's own
          top-left. */}
      {/* The scroll area is exactly as big as the zoomed map and its margin.
          The wrapper inside is scaled with a transform, which doesn't
          change the room it takes up — on its own, zooming out left a
          huge empty stretch past the right and bottom edges to scroll
          into (twice the map's size at 50%). */}
      <div
        style={{
          position: "relative",
          width: (CANVAS_W + hScrollMargin * 2) * zoom,
          height: (CANVAS_H + vScrollMargin + vScrollMarginBottom) * zoom,
          overflow: "clip",
        }}
      >
      <div
        // Only a tap on the blind zone itself, not on the canvas inside it.
        onClick={(e) => {
          if (e.target === e.currentTarget) onBlindZoneClick();
        }}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: CANVAS_W + hScrollMargin * 2,
          height: CANVAS_H + vScrollMargin + vScrollMarginBottom,
          transform: `scale(${zoom})`,
          transformOrigin: "0 0",
          // The blind zone: everything in this wrapper *outside* the
          // real canvas inset within it — a darkened, hatched band on
          // every side, so it reads as "past the edge of the map" and
          // the framed canvas (see its own style below) reads as the
          // one active space. The dot grid lives on the canvas rather
          // than the scroll container, so it stops at the border
          // instead of continuing under the blind zone.
          background:
            "repeating-linear-gradient(45deg, color-mix(in srgb, var(--ink) 9%, transparent) 0 1px, transparent 1px 9px), color-mix(in srgb, #000 14%, var(--paper))",
        }}
      >
      <div
        ref={canvasRef}
        // select-none: without it, a left-drag on empty canvas (the
        // marquee/rubber-band gesture — see onCanvasPointerDown) also
        // triggers the browser's own native text-selection drag (there's
        // plenty of selectable text — every node caption — sitting right
        // there), painting its own blue highlight over whatever the drag
        // passed across. The two aren't mutually exclusive — pointer
        // events still fire either way — but the native highlight reads
        // as "nothing is happening" (or actively wrong) over the actual
        // accent-colored marquee rectangle, and in some browsers a
        // native selection drag can itself swallow/alter the pointer
        // event stream. NodeCard's own outer div already opts out the
        // same way for the same reason (see its own select-none).
        // The map's own background (Map.background — utils/mapBackground.ts).
        className={`absolute select-none ${background.className}${crosshair ? " cursor-crosshair" : ""}`}
        // width/height stay the canvas's own native 2400x1600 — every
        // node/ghost/SVG position below is still expressed in that
        // native 0..2400 coordinate space, unaffected by this div now
        // sitting inset within a bigger padded parent rather than
        // filling it — only the *outer* wrapper's own size/transform
        // above changed. left/top inset by the same margin
        // screenToCanvas/zoomAt/viewportBounds/centerOnNode (useCanvasViewport)
        // already subtract back out when converting a scroll position
        // to a real canvas coordinate.
        style={{
          ...background.style,
          left: hScrollMargin,
          top: vScrollMargin,
          width: CANVAS_W,
          height: CANVAS_H,
          // The active space's border — drawn outside the box (outline,
          // not border) so it never eats into the 2400x1600 coordinate
          // space every node position is expressed in.
          outline: "3px solid color-mix(in srgb, var(--ink) 55%, transparent)",
        }}
        // Capture phase, so any press anywhere on the canvas — empty
        // space, a node, a zone, a link — cuts the entrance short,
        // even when that element stops the event from bubbling; so does
        // scrolling or zooming with the wheel.
        onPointerDownCapture={onAnyPress}
        onWheelCapture={onAnyPress}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onContextMenu={onContextMenu}
      >
        {children}
      </div>
      </div>
      </div>
      </div>
    </>
  );
}
