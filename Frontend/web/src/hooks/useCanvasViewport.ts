import { useEffect, useRef, useState } from "react";
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
  // quickAddActive/radialPositions below) — false for a beat right after
  // centerOnNode starts a pan, true once it's actually landed. Without
  // this, choosing a node fanned its ghosts/neighbors out immediately,
  // which — while the camera was still smoothly panning to center that
  // node — read as the whole ring sliding across the screen mid-pan rather
  // than fanning out around a node that's already settled in the middle.
  // Starts true: nothing's panning before the first selection ever happens.
  const [selectionSettled, setSelectionSettled] = useState(true);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True from the moment centerOnNode kicks off a pan until its own
  // scroll-position poll (see centerOnNode) notices the camera has
  // actually stopped moving. Guards against a *stale* poll (one left over
  // from a pan nobody's waiting on any more, e.g. it got superseded by
  // picking a different node) flipping selectionSettled back on when
  // nothing asked it to.
  const panInFlightRef = useRef(false);
  // The exact scroll position centerOnNode's most recent pan is (or was)
  // headed for — set the instant that pan is kicked off, not once it
  // lands. Waiting for a real device to actually *finish* an animated
  // smooth-scroll turned out to be the wrong thing to build correctness
  // on at all: whether that's signaled by `scrollend` or by polling
  // scrollLeft/scrollTop until they stop moving (both tried here), it's
  // still at the mercy of whatever that specific browser/device actually
  // does with the animation, and evidently some real phones either never
  // settle where expected or settle too late — ghosts kept rendering
  // against the wrong viewport regardless of which completion signal this
  // used. This sidesteps the whole question: settledViewportBounds()
  // below computes the ghost ring's/radial ring's safe zone from *this*
  // known destination instead of the live (possibly still-animating, or
  // on some devices seemingly never-finishing) DOM scroll position, so
  // their geometry is correct independent of whether the pan visually
  // catches up in any particular amount of time. selectionSettled still
  // gates *when* they're allowed to appear at all (so they don't pop in
  // while the camera is still visibly moving) — just no longer where they
  // end up once they do.
  const lastPanTargetRef = useRef<{ left: number; top: number } | null>(null);
  // Canvas zoom level — applied to canvasRef as a CSS transform: scale(),
  // see the JSX below. 1 = the canvas's own native 2400x1600 pixels.
  // Changed via zoomAt() (double-click, or the zoom control buttons) rather
  // than set directly, so every change stays clamped to [MIN_ZOOM, MAX_ZOOM]
  // in one place.
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  // The scrollable ancestor of canvasRef — canvasRef itself is the full
  // 2400x1600 canvas, this is the clipped, scrolled window onto it a user
  // is actually looking at, which viewportBounds() below reads from.
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // centerOnNode's own settle-detection (see its doc comment) polls via
  // this instead of a fixed guessed duration — the id of the in-flight
  // requestAnimationFrame loop, so a newer pan (picking a different node
  // before the previous one even finished) can cancel the stale one
  // instead of two polls racing to declare "settled" for the wrong node.
  const settlePollRef = useRef<number | null>(null);

  // Keeps lastPanTargetRef from going stale if the user manually pans the
  // canvas (drag/pinch/wheel) after selecting a node but before deselecting
  // it — without this, quick-add ghosts/the radial ring would keep clamping
  // into whatever rectangle centerOnNode last aimed for, ignoring wherever
  // the view has since actually moved to. Guarded on `!panInFlightRef.current`
  // so this doesn't fight the *programmatic* scroll events centerOnNode's
  // own animation fires while a pan is genuinely still in flight — those
  // are intermediate positions, not a real destination, and overwriting
  // the target with one would reintroduce exactly the mid-pan race this
  // whole ref exists to avoid. A manual scroll can only ever happen once
  // nothing is animating, so this check alone is enough to tell them apart.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function onScroll() {
      if (panInFlightRef.current) return;
      lastPanTargetRef.current = { left: wrap!.scrollLeft, top: wrap!.scrollTop };
    }
    wrap.addEventListener("scroll", onScroll);
    return () => wrap.removeEventListener("scroll", onScroll);
  }, []);

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
  // Recomputed on resize (ResizeObserver, same pattern MiniMap's own
  // viewport tracking already uses) and whenever zoom changes, since both
  // change how many canvas units one screen pixel is worth.
  const [hScrollMargin, setHScrollMargin] = useState(0);
  const [vScrollMargin, setVScrollMargin] = useState(0);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    function update() {
      setHScrollMargin(Math.ceil((wrap!.clientWidth / zoom) * H_SCROLL_MARGIN_FRAC));
      setVScrollMargin(Math.ceil((wrap!.clientHeight / zoom) * vScrollMarginFrac()));
    }
    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(wrap);
    return () => resizeObserver.disconnect();
    // `loading` (not just `zoom`): this component's hooks all run
    // unconditionally from the very first render, well before the `if
    // (loading) return ...` gate further down ever lets the real canvas
    // (and wrapRef) mount — so the very first time this effect ran,
    // wrapRef.current was always still null, it bailed out immediately
    // above, and with only `zoom` in the dependency list (which doesn't
    // change on its own) it would then never run again once the canvas
    // actually appeared. MiniMap's own near-identical effect doesn't need
    // this — MiniMap itself isn't rendered at all until after that same
    // gate, so its first run only ever happens once wrapRef is already
    // live. Re-running when `loading` flips to false is what actually
    // attaches this the moment wrapRef has something to observe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, loading]);

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
  }, []);

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

  // Adjusts zoom by `delta` (or snaps straight to `to` if given) while
  // keeping the canvas point under (clientX, clientY) visually stationary —
  // the usual "zoom toward the cursor" behavior in a map/image viewer, so
  // zooming in on a spot doesn't also yank the view away from it.
  function zoomAt(clientX: number, clientY: number, delta: number, to?: number) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const nextZoom = Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, to ?? zoom + delta)) * 100) / 100;
    if (nextZoom === zoom) return;
    const rect = wrap.getBoundingClientRect();
    // Same -hScrollMargin/-vScrollMargin conversion as screenToCanvas above.
    const canvasX = (wrap.scrollLeft + (clientX - rect.left)) / zoom - hScrollMargin;
    const canvasY = (wrap.scrollTop + (clientY - rect.top)) / zoom - vScrollMargin;
    setZoom(nextZoom);
    // Deferred a frame: scrollLeft/scrollTop set synchronously here would
    // still be measured against the *old* scaled scrollWidth/scrollHeight,
    // since canvasRef hasn't actually re-rendered at its new scale yet —
    // the browser would clamp against stale bounds and this would land in
    // the wrong place.
    requestAnimationFrame(() => {
      // + margin: back from a real canvas coordinate to padded-canvasRef
      // screen pixels, same convention centerOnNode's own targetLeft/Top
      // use.
      wrap.scrollLeft = (canvasX + hScrollMargin) * nextZoom - (clientX - rect.left);
      wrap.scrollTop = (canvasY + vScrollMargin) * nextZoom - (clientY - rect.top);
    });
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

    // Cancel whatever a previous call left running — a newer pan (picking
    // a different node before the last one even settled) fully supersedes
    // it, and letting the old poll/timeout keep going could flip
    // selectionSettled back on for the wrong node's ghosts.
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    if (settlePollRef.current) cancelAnimationFrame(settlePollRef.current);

    // Already there (the just-selected node was already sitting dead
    // center, or re-clicking the same one) — scrollTo wouldn't actually
    // move anything, so there's no pan to wait on at all.
    if (Math.hypot(targetLeft - wrap.scrollLeft, targetTop - wrap.scrollTop) < 1) {
      panInFlightRef.current = false;
      setSelectionSettled(true);
      return;
    }

    wrap.scrollTo({ left: targetLeft, top: targetTop, behavior: "smooth" });
    setSelectionSettled(false);
    panInFlightRef.current = true;

    // See selectionSettled's own doc comment — quick-add ghosts/the radial
    // ring stay hidden until this pan actually lands. Used to guess *when*
    // that was with one fixed duration (350ms, then a scrollend listener
    // with a 900ms fallback) — both still amount to a guess: a `scrollend`
    // that never fires on some real browser/device, or a real pan that
    // (a big canvas, a slower phone actually rendering the animation
    // rather than this environment's own sandboxed panes, which don't
    // always tick it forward at all) genuinely takes longer than any fixed
    // number picked here, leaves ghosts fanning out against whatever the
    // viewport still was at that guessed moment — not where the node
    // actually ends up — which is exactly what read as "ghosts floating in
    // a curvy row, disconnected from the node" on a real phone. Polling
    // the actual scroll position every frame until it stops moving is
    // correct regardless of distance, device speed, or scrollend support:
    // however long the real pan takes, this notices the moment it's
    // actually done. 3 consecutive unchanged frames (not just one, which
    // could land between two ticks that happened to round to the same
    // pixel) before declaring it settled; an outer 3s timeout is a last-
    // resort safety net for the pathological case where scrolling somehow
    // never stabilizes at all, so ghosts can never end up permanently
    // stuck hidden.
    let lastLeft = wrap.scrollLeft;
    let lastTop = wrap.scrollTop;
    let stableFrames = 0;
    const finish = () => {
      panInFlightRef.current = false;
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
      if (settlePollRef.current) cancelAnimationFrame(settlePollRef.current);
      setSelectionSettled(true);
    };
    const poll = () => {
      if (!panInFlightRef.current) return; // superseded by a newer pan, or already finished
      const nowLeft = wrap.scrollLeft;
      const nowTop = wrap.scrollTop;
      if (Math.abs(nowLeft - lastLeft) < 0.5 && Math.abs(nowTop - lastTop) < 0.5) {
        stableFrames++;
      } else {
        stableFrames = 0;
        lastLeft = nowLeft;
        lastTop = nowTop;
      }
      if (stableFrames >= 3) {
        finish();
        return;
      }
      settlePollRef.current = requestAnimationFrame(poll);
    };
    settlePollRef.current = requestAnimationFrame(poll);
    settleTimeoutRef.current = setTimeout(finish, 3000);
  }

  // Pans to a fixed canvas point rather than any one node's own position —
  // used below to center a circle/cluster the moment it becomes the chosen
  // one, which has no single "the node" the way an ordinary selection does.
  // Same target-rectangle math centerOnNode uses, just without any of its
  // settle-detection/quick-add-ghost machinery: nothing here needs to know
  // the instant this pan actually lands, since a chosen cluster has no
  // ghosts fanning off it the way a selected node does.
  function centerOnPoint(x: number, y: number) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const visibleH = Math.max(150, wrap.clientHeight * (1 - panelReserveFrac(isMobileViewport())));
    const maxLeft = Math.max(0, (CANVAS_W + hScrollMargin * 2) * zoom - wrap.clientWidth);
    const maxTop = Math.max(0, (CANVAS_H + vScrollMargin * 2) * zoom - wrap.clientHeight);
    const targetLeft = Math.min(maxLeft, Math.max(0, (x + hScrollMargin) * zoom - wrap.clientWidth / 2));
    const targetTop = Math.min(maxTop, Math.max(0, (y + vScrollMargin) * zoom - visibleH / 2));
    wrap.scrollTo({ left: targetLeft, top: targetTop, behavior: "smooth" });
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
  };
}
