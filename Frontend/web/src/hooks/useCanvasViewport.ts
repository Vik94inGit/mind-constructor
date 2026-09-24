import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CANVAS_W,
  CANVAS_H,
  MIN_ZOOM,
  MAX_ZOOM,
  FULL_CANVAS_BOUNDS,
  panelReserveFrac,
  isMobileViewport,
} from "../utils/canvasLayout";
import type { ViewportBounds } from "../utils/canvasLayout";

// The dead zone past each edge of the canvas, as a fraction of the viewport:
// enough to scroll a node sitting right on any edge all the way to where a
// chosen node is centered, so its quick-add ghost ring can fan out fully into
// the dead zone. Horizontally that is half the viewport width. Vertically the
// chosen node is centered in the part of the screen the bottom sheet leaves
// free, so the bottom margin has to cover the sheet's share as well — see
// vScrollMarginFrac.
const ZOOM_MS = 240;
const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const H_SCROLL_MARGIN_FRAC = 0.5;
const vScrollMarginFrac = () => (1 + panelReserveFrac(isMobileViewport())) / 2;

interface Params {
  mapId: string | undefined;
  /** The map is still loading — the canvas (and so wrapRef) isn't mounted yet. */
  loading: boolean;
  /** A tall bottom sheet (node panel, pack picker, choose mode) covers the lower part of the screen. */
  sheetOpen: boolean;
  /** Every node's canvas position, by id. */
  positions: Map<string, { x: number; y: number }>;
}

// The scrolling, zooming window onto the canvas: zoom level, the blind-zone
// margins, scroll<->canvas coordinate conversion, panning to a node, and
// which part of the canvas is currently on screen. Nothing here knows about
// nodes beyond their positions.
export function useCanvasViewport({ mapId, loading, sheetOpen, positions }: Params) {
  // Gates the quick-add ghost ring and the radial neighbor layout (see
  // quickAddActive/radialPositions in MapPage): false from the moment
  // centerOnNode starts a pan until the camera has landed, so the ring fans
  // out around a node that is already centered instead of sliding across the
  // screen mid-pan. Starts true: nothing pans before the first selection.
  const [selectionSettled, setSelectionSettled] = useState(true);
  // True while centerOnNode's pan is running (see animateScrollTo).
  const panInFlightRef = useRef(false);
  // The scroll position centerOnNode's most recent pan is (or was) headed
  // for, set the instant the pan starts. settledViewportBounds() computes the
  // ghost ring's and radial ring's safe zone from this destination rather
  // than the live scroll position, so their geometry is already final while
  // the camera is still gliding there.
  const lastPanTargetRef = useRef<{ left: number; top: number } | null>(null);
  // Canvas zoom level — applied to canvasRef as a CSS transform: scale(),
  // see the JSX below. 1 = the canvas's own native 2400x1600 pixels.
  // Changed via zoomAt() (the zoom control buttons, fit-to-display) rather
  // than set directly, so every change stays clamped to [MIN_ZOOM, MAX_ZOOM]
  // in one place and glides there instead of jumping.
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  // The scrollable ancestor of canvasRef — canvasRef itself is the full
  // 2400x1600 canvas, this is the clipped, scrolled window onto it a user
  // is actually looking at, which viewportBounds() below reads from.
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Keeps lastPanTargetRef from going stale if the user manually pans the
  // canvas (drag/pinch/wheel) after selecting a node but before deselecting
  // it — otherwise quick-add ghosts/the radial ring would keep clamping into
  // whatever rectangle centerOnNode last aimed for. Ignored while a pan is in
  // flight: those scroll events are the animation's own intermediate
  // positions, not a real destination.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function onScroll() {
      if (panInFlightRef.current) return;
      lastPanTargetRef.current = { left: wrap!.scrollLeft, top: wrap!.scrollTop };
    }
    wrap.addEventListener("scroll", onScroll);
    return () => wrap.removeEventListener("scroll", onScroll);
    // `loading`: wrapRef is only set once the canvas mounts, after loading.
  }, [loading]);

  // The camera's own animated pans and zooms (see animateScrollTo/zoomAt).
  const panFrameRef = useRef<number | null>(null);
  const zoomFrameRef = useRef<number | null>(null);
  const zoomTokenRef = useRef(0);
  const panTokenRef = useRef(0);
  const cancelPan = () => {
    panTokenRef.current++;
    if (panFrameRef.current != null) cancelAnimationFrame(panFrameRef.current);
    panFrameRef.current = null;
  };
  // The user grabbing the canvas (wheel, touch, click) while a pan is gliding
  // takes over: stop the glide right where it is instead of fighting them.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function interrupt() {
      if (panFrameRef.current == null) return;
      panTokenRef.current++;
      cancelAnimationFrame(panFrameRef.current);
      panFrameRef.current = null;
      if (panInFlightRef.current) {
        panInFlightRef.current = false;
        setSelectionSettled(true);
      }
    }
    wrap.addEventListener("wheel", interrupt, { passive: true });
    wrap.addEventListener("pointerdown", interrupt);
    wrap.addEventListener("touchstart", interrupt, { passive: true });
    return () => {
      wrap.removeEventListener("wheel", interrupt);
      wrap.removeEventListener("pointerdown", interrupt);
      wrap.removeEventListener("touchstart", interrupt);
    };
  }, [loading]);
  useEffect(
    () => () => {
      panTokenRef.current++;
      zoomTokenRef.current++;
      if (panFrameRef.current != null) cancelAnimationFrame(panFrameRef.current);
      if (zoomFrameRef.current != null) cancelAnimationFrame(zoomFrameRef.current);
    },
    [],
  );

  // How far (in canvas units) the *real* 0..CANVAS_W/CANVAS_H content sits
  // inset from every edge of the actual scrollable area — canvasRef itself
  // is rendered CANVAS_W+hScrollMargin*2 wide (CANVAS_H+vScrollMargin*2
  // tall), with the real content positioned at (hScrollMargin,
  // vScrollMargin) inside it (see its own JSX below). Without this, wrap
  // can never scroll any node closer to center than "the canvas's own edge
  // is at the edge of the viewport" — fine for a node in the middle of the
  // map, but one sitting at/near the real 0/CANVAS_W/CANVAS_H edge has
  // nowhere left to scroll to: centerOnNode's target gets clamped back to
  // 0 or maxLeft/maxTop, landing the node pinned near the edge of the
  // screen instead of centered — and, worse, outside the safe zone
  // QuickAddGhosts/the radial neighbor ring clamp themselves into (see
  // their own doc comments), so their ring visibly detached from the node
  // instead of surrounding it. This margin exists on all four sides so a
  // node near *any* edge can still be scrolled into that safe zone.
  // H_SCROLL_MARGIN_FRAC / vScrollMarginFrac() of a clientWidth/clientHeight
  // (divided back out of screen pixels into canvas units, same *zoom
  // reasoning every other screen<->canvas conversion here uses): enough to
  // center an edge node dead-on, with its ghost ring free to fan out over the
  // dead zone; the
  // margin itself is drawn dimmed and hatched (see the padded wrapper's own
  // JSX) so it reads as "outside the map", with the real canvas framed as
  // the active space.
  // Derived from the viewport's size and the zoom during render (not stored
  // in state and updated from an effect), so a zoom change and the margin it
  // implies always land in the same commit — the margin is a fixed share of
  // the screen, so its on-screen size stays put while the zoom animates.
  // The viewport size itself is tracked with a ResizeObserver.
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function update() {
      setViewSize((prev) =>
        prev.w === wrap!.clientWidth && prev.h === wrap!.clientHeight
          ? prev
          : { w: wrap!.clientWidth, h: wrap!.clientHeight },
      );
    }
    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(wrap);
    return () => resizeObserver.disconnect();
    // `loading`: this hook's effects all run from the very first render,
    // before the `if (loading) return ...` gate lets the real canvas (and
    // wrapRef) mount — so this has to run again once loading flips to false.
  }, [loading]);
  const hScrollMargin = viewSize.w ? Math.ceil((viewSize.w / zoom) * H_SCROLL_MARGIN_FRAC) : 0;
  const vScrollMargin = viewSize.h ? Math.ceil((viewSize.h / zoom) * vScrollMarginFrac()) : 0;
  // Latest values for the camera functions below, which can run from a timer
  // or an animation frame after the render that created them.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const hMarginRef = useRef(hScrollMargin);
  hMarginRef.current = hScrollMargin;
  const vMarginRef = useRef(vScrollMargin);
  vMarginRef.current = vScrollMargin;

  // A trackpad's two-finger swipe reaching this canvas's own left/right
  // scroll edge otherwise reads to the browser as "nothing left to scroll,
  // treat this as swipe-to-navigate-back/forward" — unmounting the whole
  // page and discarding whatever was in progress. index.css's own
  // `overscroll-behavior-x: none` (both on <body> and this same wrap
  // element) handles that for Chrome, but Safari's swipe-navigation is a
  // native browser-chrome gesture that CSS overscroll-behavior doesn't
  // suppress at all — the only thing that reliably stops it there is
  // actually calling preventDefault() on the wheel event that would have
  // driven it. React's own onWheel can't do that (it's attached passively
  // by default since React 17, so preventDefault silently no-ops) — hence
  // a real addEventListener with { passive: false } here instead. Only
  // preventDefault right at the boundary (scrolled all the way left/right
  // already, still trying to go further that way) — anywhere else, this
  // lets the browser's own native scroll happen exactly as before, so
  // trackpad-panning the canvas isn't affected.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function onWheel(e: WheelEvent) {
      if (e.deltaX === 0) return;
      const atLeftEdge = e.deltaX < 0 && wrap!.scrollLeft <= 0;
      const atRightEdge = e.deltaX > 0 && wrap!.scrollLeft >= wrap!.scrollWidth - wrap!.clientWidth;
      if (atLeftEdge || atRightEdge) e.preventDefault();
    }
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [loading]);

  // screenToCanvas: converts a screen point (e.g. clientX/clientY) into
  // canvas-coordinate space (the same 0..CANVAS_W/0..CANVAS_H units every
  // node's x/y, `positions`, and dragState are already in). Needed because
  // canvasRef is visually zoomed via a CSS transform (see the zoom
  // state below), so its rendered size doesn't match CANVAS_W/CANVAS_H
  // 1:1, and any screen-pixel distance has to be divided by the current
  // zoom before it means anything in canvas coordinates. wrap's own
  // scroll position + bounding rect (not canvasRef's) is the anchor: the
  // canvas's transform-origin is its own (0,0), which sits at wrap's
  // scrolled (0,0) content position.
  function screenToCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const wrap = wrapRef.current;
    if (!wrap) return { x: clientX, y: clientY };
    const rect = wrap.getBoundingClientRect();
    // - hScrollMargin/vScrollMargin: wrap's own scroll metrics are screen
    // pixels within the *padded* canvasRef (see its own doc comment) — the
    // real 0..CANVAS_W/CANVAS_H content sits inset by that margin inside
    // it, so converting back to a real canvas coordinate has to subtract
    // it back out.
    return {
      x: (wrap.scrollLeft + (clientX - rect.left)) / zoom - hScrollMargin,
      y: (wrap.scrollTop + (clientY - rect.top)) / zoom - vScrollMargin,
    };
  }

  // Adjusts zoom by `delta` (or goes straight to `to` if given) while keeping
  // the canvas point under (clientX, clientY) visually stationary — the usual
  // "zoom toward the cursor" behavior in a map/image viewer. The zoom glides
  // to its target over a fraction of a second; the anchor is re-applied on
  // every frame by the layout effect below, in the same commit as the new
  // zoom, so the point under the pointer never wobbles.
  const zoomTargetRef = useRef(1);
  const zoomAnchorRef = useRef<{ canvasX: number; canvasY: number; offX: number; offY: number } | null>(null);
  function zoomAt(clientX: number, clientY: number, delta: number, to?: number) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const target = Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, to ?? zoomTargetRef.current + delta)) * 100) / 100;
    if (target === zoomTargetRef.current) return;
    zoomTargetRef.current = target;
    const from = zoomRef.current;
    const rect = wrap.getBoundingClientRect();
    const offX = clientX - rect.left;
    const offY = clientY - rect.top;
    zoomAnchorRef.current = {
      canvasX: (wrap.scrollLeft + offX) / from - hMarginRef.current,
      canvasY: (wrap.scrollTop + offY) / from - vMarginRef.current,
      offX,
      offY,
    };
    if (zoomFrameRef.current != null) cancelAnimationFrame(zoomFrameRef.current);
    zoomTokenRef.current++;
    if (prefersReducedMotion()) {
      zoomFrameRef.current = null;
      setZoom(target);
      return;
    }
    const start = performance.now();
    const token = ++zoomTokenRef.current;
    const step = (now: number) => {
      if (zoomTokenRef.current !== token) return;
      const p = Math.min(1, (now - start) / ZOOM_MS);
      setZoom(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      zoomFrameRef.current = p < 1 ? requestAnimationFrame(step) : null;
    };
    zoomFrameRef.current = requestAnimationFrame(step);
    // Same background-tab safety net as animateScrollTo.
    window.setTimeout(() => {
      if (zoomTokenRef.current !== token || zoomFrameRef.current == null) return;
      cancelAnimationFrame(zoomFrameRef.current);
      zoomFrameRef.current = null;
      setZoom(target);
    }, ZOOM_MS + 150);
  }
  // Puts the zoom anchor back under the pointer once the canvas has resized
  // for the new zoom (and margin) — before the browser paints, so there is no
  // frame where the content has scaled but not yet re-centered.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const a = zoomAnchorRef.current;
    if (!wrap || !a) return;
    wrap.scrollLeft = (a.canvasX + hScrollMargin) * zoom - a.offX;
    wrap.scrollTop = (a.canvasY + vScrollMargin) * zoom - a.offY;
    if (zoomFrameRef.current == null) zoomAnchorRef.current = null;
  }, [zoom, hScrollMargin, vScrollMargin]);

  // Scrolls the canvas to (left, top) with an eased glide instead of a jump:
  // slow start, slow finish, a duration that grows a little with the distance.
  // Driven frame by frame (not the browser's own smooth scroll), so it always
  // finishes at a known time and onDone can rely on that.
  function animateScrollTo(left: number, top: number, onDone?: () => void) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    cancelPan();
    const fromLeft = wrap.scrollLeft;
    const fromTop = wrap.scrollTop;
    const distance = Math.hypot(left - fromLeft, top - fromTop);
    if (distance < 1 || prefersReducedMotion()) {
      wrap.scrollTo(left, top);
      onDone?.();
      return;
    }
    const duration = Math.min(1100, Math.max(520, 400 + distance * 0.4));
    const start = performance.now();
    const token = ++panTokenRef.current;
    const finish = () => {
      if (panTokenRef.current !== token) return;
      panFrameRef.current = null;
      wrap.scrollLeft = left;
      wrap.scrollTop = top;
      onDone?.();
    };
    const step = (now: number) => {
      if (panTokenRef.current !== token) return;
      const p = Math.min(1, (now - start) / duration);
      if (p >= 1) {
        finish();
        return;
      }
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      wrap.scrollLeft = fromLeft + (left - fromLeft) * e;
      wrap.scrollTop = fromTop + (top - fromTop) * e;
      panFrameRef.current = requestAnimationFrame(step);
    };
    panFrameRef.current = requestAnimationFrame(step);
    // Frames stop coming when the tab is in the background; the glide still
    // has to end, or the ghosts waiting on it would never appear.
    window.setTimeout(finish, duration + 150);
  }

  // The minimap's way of moving the view: a click glides, a drag follows the
  // pointer directly.
  function panTo(left: number, top: number, animate: boolean) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (animate) {
      animateScrollTo(left, top);
    } else {
      cancelPan();
      wrap.scrollLeft = left;
      wrap.scrollTop = top;
    }
  }

  // The zoom buttons zoom about the middle of what's on screen.
  function zoomFromCenter(delta: number, to?: number) {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, delta, to);
  }

  // The currently-visible rectangle of the canvas, in canvas coordinates —
  // read live off the scroll container rather than tracked in state, since
  // it's only ever needed at the instant of a create/drop action, not on
  // every render. `pad` keeps a node's full icon+caption footprint inside
  // the edge, not just its center point. Falls back to the whole canvas
  // before the wrap has mounted. Divided by `zoom` throughout — wrap's own
  // scroll metrics are in screen pixels of the *rendered* (scaled) canvas,
  // same reasoning as screenToCanvas above.
  function viewportBounds(): ViewportBounds {
    const wrap = wrapRef.current;
    if (!wrap) return FULL_CANVAS_BOUNDS;
    const pad = 70;
    // NodePanel/PackPickerPanel's bottom sheet (see panelReserveFrac's own
    // doc comment) physically covers the bottom third (half on mobile) of
    // the screen while it's open — shrink the placeable
    // rectangle by the same amount so a freshly-created node (or a
    // quick-add ghost, which reads this via MapPage's own bounds prop)
    // never lands underneath it. Skipped for the group-selection footer
    // (multiSelectIds), which is a slim bar, not a tall sheet.
    const reserve = sheetOpen ? wrap.clientHeight * panelReserveFrac(isMobileViewport()) : 0;
    // - hScrollMargin/-vScrollMargin: same padded-canvasRef -> real-canvas
    // conversion screenToCanvas uses.
    return {
      minX: wrap.scrollLeft / zoom + pad - hScrollMargin,
      minY: wrap.scrollTop / zoom + pad - vScrollMargin,
      maxX: (wrap.scrollLeft + wrap.clientWidth) / zoom - pad - hScrollMargin,
      maxY: (wrap.scrollTop + wrap.clientHeight - reserve) / zoom - pad - vScrollMargin,
    };
  }

  // Same as viewportBounds(), except it substitutes centerOnNode's own
  // known destination (lastPanTargetRef — see its own doc comment) for
  // wrap.scrollLeft/scrollTop wherever a pan is/was heading somewhere in
  // particular. Quick-add ghosts and the radial neighbor ring both read
  // this instead of plain viewportBounds() specifically because they're
  // the two things that have to line up with *where the selected node
  // ends up*, not with whatever the scroll container happens to read at
  // the moment they're computed — and that's exactly the value a real
  // device's own animation timing can't be trusted to have caught up to
  // yet (or, evidently, ever quite catch up to on some phones). Every
  // other caller of viewportBounds() (placing a brand new node, clamping a
  // drag, etc.) is unrelated to any in-flight pan and should keep reading
  // the real, current scroll position, so this stays a separate function
  // rather than changing viewportBounds() itself.
  function settledViewportBounds(): ViewportBounds {
    const wrap = wrapRef.current;
    if (!wrap) return FULL_CANVAS_BOUNDS;
    const target = lastPanTargetRef.current;
    if (!target) return viewportBounds();
    const pad = 70;
    const reserve = sheetOpen ? wrap.clientHeight * panelReserveFrac(isMobileViewport()) : 0;
    // - hScrollMargin/-vScrollMargin: same padded-canvasRef -> real-canvas
    // conversion screenToCanvas uses.
    return {
      minX: target.left / zoom + pad - hScrollMargin,
      minY: target.top / zoom + pad - vScrollMargin,
      maxX: (target.left + wrap.clientWidth) / zoom - pad - hScrollMargin,
      maxY: (target.top + wrap.clientHeight - reserve) / zoom - pad - vScrollMargin,
    };
  }

  // Pans the canvas so the given node's position lands in the middle of the
  // current viewport, unconditionally — the chosen node (whatever was just
  // clicked/selected) always ends up centered, not just nudged into view.
  // Selecting a node always brings up NodePanel too, which overlays the
  // canvas as a bottom sheet at every screen size (see its own PANEL_CLASS)
  // instead of reserving space as a sidebar would — so wrap.clientHeight's
  // own full height isn't what's actually visible above it.
  // panelReserveFrac() (see its own doc comment) is a
  // deliberate approximation (there's no reliable, synchronously-correct
  // measurement of the panel's real height here — it hasn't mounted yet for
  // a first selection, and its content, and so its height, varies by node
  // and tab anyway) — but it's the *same* fraction viewportBounds()
  // reserves and PANEL_CLASS caps the sheet at, so the chosen node (and the
  // quick-add ghosts fanned around it, clamped to that same
  // viewportBounds) land in the space actually left on screen rather than
  // drifting out of sync with how tall the sheet is actually allowed to
  // grow.
  function centerOnNode(nodeId: string) {
    const zoom = zoomRef.current;
    const hScrollMargin = hMarginRef.current;
    const vScrollMargin = vMarginRef.current;
    const wrap = wrapRef.current;
    // positions.get, not a posFor lookup — see the note just below.
    const pos = positions.get(nodeId);
    if (!wrap || !pos) return;
    // positions.get, not posFor(node): this runs inside the same click
    // handler as the setSelectedId call that's choosing this node, so
    // React hasn't re-run radialPositions against the *new* selection yet
    // — posFor would still read last render's radial ring (keyed off the
    // *previous* selectedId), which places every one of that node's own
    // neighbors on a ring around it. Selecting one of those neighbors hit
    // this exactly: the camera panned to wherever that neighbor was
    // sitting in the old node's ring, not to its own resting spot — and
    // the very next render then snaps that neighbor (now the selection)
    // back to its real position, off in whatever direction the ring had
    // placed it, since a selected node is never a ring member of its own
    // view. The node the user just tapped would end up centered on empty
    // canvas while the thing they actually chose jumped off-screen —
    // reads as "picking a different node doesn't work" on a phone, where
    // there's no cursor hovering the real node to notice it moved.
    // positions (unlike posFor) never carries a radial override at all,
    // so it's always that node's own real, settled spot regardless of
    // what was selected a moment ago.
    const visibleH = Math.max(150, wrap.clientHeight * (1 - panelReserveFrac(isMobileViewport())));
    // *zoom throughout: pos.x/y are canvas-space, but scrollTo/scrollWidth
    // deal in screen pixels of the rendered (scaled) canvas — same
    // conversion as screenToCanvas/zoomAt above, just the other direction.
    // (CANVAS_W + hScrollMargin*2)/(CANVAS_H + vScrollMargin*2): canvasRef's
    // own real rendered size now (see its own doc comment/JSX) — the margin
    // on every side is what lets this clamp actually reach 0 or maxLeft/
    // maxTop for a node sitting right at the real 0/CANVAS_W/CANVAS_H edge
    // instead of leaving it pinned there with nowhere left to scroll to.
    const maxLeft = Math.max(0, (CANVAS_W + hScrollMargin * 2) * zoom - wrap.clientWidth);
    const maxTop = Math.max(0, (CANVAS_H + vScrollMargin * 2) * zoom - wrap.clientHeight);
    // + hScrollMargin/+ vScrollMargin: pos.x/y are real canvas coordinates;
    // scrollTo deals in screen pixels within the *padded* canvasRef (see
    // screenToCanvas's own doc comment) — same conversion, just the other
    // direction.
    const targetLeft = Math.min(maxLeft, Math.max(0, (pos.x + hScrollMargin) * zoom - wrap.clientWidth / 2));
    const targetTop = Math.min(maxTop, Math.max(0, (pos.y + vScrollMargin) * zoom - visibleH / 2));
    // See its own doc comment — recorded regardless of which branch below
    // actually runs, since settledViewportBounds() should always reflect
    // the most recent centerOnNode call, not just the ones that had to
    // scroll somewhere new.
    lastPanTargetRef.current = { left: targetLeft, top: targetTop };

    // Already there (the just-selected node was already sitting dead
    // center, or re-clicking the same one) — nothing to glide.
    if (Math.hypot(targetLeft - wrap.scrollLeft, targetTop - wrap.scrollTop) < 1) {
      cancelPan();
      panInFlightRef.current = false;
      setSelectionSettled(true);
      return;
    }

    // A newer pan (picking a different node before the last one landed)
    // simply replaces the running glide. The ghosts/radial ring wait for it.
    setSelectionSettled(false);
    panInFlightRef.current = true;
    animateScrollTo(targetLeft, targetTop, () => {
      panInFlightRef.current = false;
      setSelectionSettled(true);
    });
  }

  // Glides to a fixed canvas point rather than any one node's own position —
  // used to center a circle/cluster the moment it becomes the chosen one,
  // which has no single "the node" the way an ordinary selection does. Same
  // target-rectangle math as centerOnNode, without its ghost/settle machinery:
  // a chosen cluster has no ghosts fanning off it.
  function centerOnPoint(x: number, y: number) {
    const zoom = zoomRef.current;
    const hScrollMargin = hMarginRef.current;
    const vScrollMargin = vMarginRef.current;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const visibleH = Math.max(150, wrap.clientHeight * (1 - panelReserveFrac(isMobileViewport())));
    const maxLeft = Math.max(0, (CANVAS_W + hScrollMargin * 2) * zoom - wrap.clientWidth);
    const maxTop = Math.max(0, (CANVAS_H + vScrollMargin * 2) * zoom - wrap.clientHeight);
    const targetLeft = Math.min(maxLeft, Math.max(0, (x + hScrollMargin) * zoom - wrap.clientWidth / 2));
    const targetTop = Math.min(maxTop, Math.max(0, (y + vScrollMargin) * zoom - visibleH / 2));
    animateScrollTo(targetLeft, targetTop);
  }

  // Open a map looking at its nodes. The scroll area starts at its own
  // top-left corner — the empty blind-zone margin, since the canvas is far
  // bigger than any screen and nodes cluster near its middle — so without
  // this a fresh load shows nothing and the map has to be hunted for. Once
  // per map, the first time both the nodes and the scroll margins exist.
  const didInitialFitRef = useRef<string | null>(null);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (loading || !wrap || !mapId || didInitialFitRef.current === mapId) return;
    if (hScrollMargin === 0 || vScrollMargin === 0) return;
    didInitialFitRef.current = mapId;
    // An empty map opens on the middle of the canvas, where its first
    // node-type ghosts are drawn (see MapPage's empty-map QuickAddGhosts).
    let cx = CANVAS_W / 2;
    let cy = CANVAS_H / 2;
    if (positions.size > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of positions.values()) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      cx = (minX + maxX) / 2;
      cy = (minY + maxY) / 2;
    }
    wrap.scrollTo({
      left: (cx + hScrollMargin) * zoom - wrap.clientWidth / 2,
      top: (cy + vScrollMargin) * zoom - wrap.clientHeight / 2,
    });
    // zoom is read once, at fit time — a later zoom must not re-center.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, mapId, hScrollMargin, vScrollMargin, positions]);

  return {
    canvasRef,
    wrapRef,
    zoom,
    hScrollMargin,
    vScrollMargin,
    selectionSettled,
    screenToCanvas,
    zoomAt,
    zoomFromCenter,
    viewportBounds,
    settledViewportBounds,
    centerOnNode,
    centerOnPoint,
    panTo,
  };
}
