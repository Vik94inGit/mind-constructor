import { useEffect, useRef } from "react";
import { hashSeed } from "../utils/canvasLayout";

// How far (in the zone polygon's own SVG coordinate space — canvas units,
// not screen pixels) a floating zone nudges toward the canvas center before
// easing back to its real, stored position. Modest on purpose: the backdrop
// still has to visibly enclose its own member nodes at every point in the
// cycle.
const AMPLITUDE = 40;
// Roughly how long each leg (toward center, or back home) takes, randomized
// per zone (seeded off its own rootId, like NodeCard's chaosStyle) — not a
// hard deadline, just when the target flips; the actual approach is
// continuous easing (see NORMAL_TAU below), so a short leg just means it
// reverses before fully arriving, which reads as drifting rather than
// snapping to two fixed points.
const MIN_LEG_S = 1.6;
const LEG_SPREAD_S = 1.6;
const HOME_DWELL_S = 0.3;
const OUT_DWELL_S = 0.5;
// How quickly the on-screen offset eases toward its current target — an
// exponential time constant, not a fixed-duration transition (see the doc
// comment on the hook itself for why this isn't CSS-transition-driven).
const NORMAL_TAU_S = 0.9;
// The tau a click forces every away-from-home zone into for a short burst,
// so the "coming back" leg reads as a deliberate sprint instead of waiting
// out its own normal, slower approach.
const BOOST_TAU_S = 0.18;
const BOOST_HOLD_S = 0.8;

interface FloatingZone {
  rootId: string;
  /** The zone polygon's own current geometric center, in canvas units. */
  centroid: { x: number; y: number };
}

interface ZoneRuntime {
  offset: { x: number; y: number };
  target: { x: number; y: number };
  /** performance.now(), in seconds — when this zone's target next flips (out<->home). */
  nextFlipAt: number;
  legDuration: number;
}

/**
 * Drives each un-stabilized zone's own backdrop through a "drift toward the
 * canvas center, dwell, ease back to its real position, dwell, repeat"
 * cycle — the same "still undecided" floating quality NodeCard's own
 * chaotic drift already gives an unchosen circle's member nodes (see
 * NodeCard's chaosStyle), just for the whole polygon rather than one small
 * icon.
 *
 * One continuous requestAnimationFrame loop (not per-zone setTimeout
 * chains, and not a CSS `@keyframes`/transition) recomputes every zone's
 * offset from its own always-current target every frame and writes it
 * straight to that zone's <polygon> element via `elementsRef`, bypassing
 * React entirely (no state, no re-render) the same way the CSS-keyframe
 * version this replaced never re-rendered either. Doing the easing in JS
 * instead of via a CSS transition's own duration is specifically what lets
 * a click (`boostTick`) actually speed up a zone that's already mid-flight:
 * a CSS transition's timing is fixed at the moment it starts, so changing
 * `transition-duration` after the fact has no effect on one already
 * running — there's nothing to "reach into". A per-frame value has no such
 * problem; boosting is just a shorter time constant for a little while.
 */
export function useZoneFloat(
  floatingZones: FloatingZone[],
  center: { x: number; y: number },
  elementsRef: { current: Map<string, SVGPolygonElement> },
  boostTick: number,
) {
  // Kept fresh every render (not just at effect-setup time) so the RAF loop
  // below — set up once and running independently of React's render cycle —
  // always sees each zone's latest centroid/membership instead of whatever
  // was current the one time its own closure was created.
  const zonesRef = useRef(floatingZones);
  useEffect(() => {
    zonesRef.current = floatingZones;
  });

  const runtimesRef = useRef(new Map<string, ZoneRuntime>());
  const boostUntilRef = useRef(0);
  const isFirstBoost = useRef(true);

  // A click anywhere on the canvas — see MapPage's own canvas onClick —
  // forces every zone currently away from home back onto a home target and
  // switches everyone to the fast tau for a short burst. Zones already home
  // just keep gently drifting in place; there's nothing to speed up.
  useEffect(() => {
    if (isFirstBoost.current) {
      isFirstBoost.current = false;
      return;
    }
    const now = performance.now() / 1000;
    boostUntilRef.current = now + BOOST_HOLD_S;
    for (const runtime of runtimesRef.current.values()) {
      runtime.target = { x: 0, y: 0 };
      runtime.nextFlipAt = now + runtime.legDuration + OUT_DWELL_S;
    }
  }, [boostTick]);

  useEffect(() => {
    let raf = 0;
    let lastTimeMs = performance.now();

    function tick(nowMs: number) {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((nowMs - lastTimeMs) / 1000, 0.1);
      lastTimeMs = nowMs;
      const now = nowMs / 1000;
      const boosting = now < boostUntilRef.current;
      const tau = boosting ? BOOST_TAU_S : NORMAL_TAU_S;
      const alpha = 1 - Math.exp(-dt / tau);

      const runtimes = runtimesRef.current;
      const elements = elementsRef.current;
      const liveZones = zonesRef.current;
      const seenIds = new Set(liveZones.map((z) => z.rootId));

      // A zone that stabilized, or left the map entirely, stops floating —
      // hand its polygon back its plain, un-transformed real position
      // instead of leaving it frozen mid-drift.
      for (const [rootId] of Array.from(runtimes.entries())) {
        if (seenIds.has(rootId)) continue;
        runtimes.delete(rootId);
        const el = elements.get(rootId);
        if (el) el.style.transform = "";
      }

      for (const zone of liveZones) {
        let runtime = runtimes.get(zone.rootId);
        if (!runtime) {
          const [rLeg, rDelay] = hashSeed(zone.rootId, 2);
          const legDuration = MIN_LEG_S + rLeg * LEG_SPREAD_S;
          // Desync each zone's own start so they don't all drift in
          // lockstep — a random initial wait before its first "go out".
          runtime = { offset: { x: 0, y: 0 }, target: { x: 0, y: 0 }, legDuration, nextFlipAt: now + rDelay * legDuration };
          runtimes.set(zone.rootId, runtime);
        }

        if (now >= runtime.nextFlipAt) {
          const awayFromHome = runtime.target.x !== 0 || runtime.target.y !== 0;
          if (awayFromHome) {
            runtime.target = { x: 0, y: 0 };
            runtime.nextFlipAt = now + runtime.legDuration + HOME_DWELL_S;
          } else {
            // Recomputed fresh on every "go out", not just once — a zone
            // dragged far from where it started still gets a direction that
            // actually points at the canvas center right now.
            const dx = center.x - zone.centroid.x;
            const dy = center.y - zone.centroid.y;
            const dist = Math.hypot(dx, dy) || 1;
            runtime.target = { x: (dx / dist) * AMPLITUDE, y: (dy / dist) * AMPLITUDE };
            runtime.nextFlipAt = now + runtime.legDuration + OUT_DWELL_S;
          }
        }

        runtime.offset = {
          x: runtime.offset.x + (runtime.target.x - runtime.offset.x) * alpha,
          y: runtime.offset.y + (runtime.target.y - runtime.offset.y) * alpha,
        };

        const el = elements.get(zone.rootId);
        if (el) el.style.transform = `translate(${runtime.offset.x.toFixed(2)}px, ${runtime.offset.y.toFixed(2)}px)`;
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // center.x/center.y are stable primitives (CANVAS_CENTER is a module-
    // level constant in CanvasBackdrop); this effect otherwise reads
    // everything else live via the refs above, so it only ever needs to
    // start once.
  }, [center.x, center.y, elementsRef]);
}
