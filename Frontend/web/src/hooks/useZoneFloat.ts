import { useEffect, useRef } from "react";
import { hashSeed } from "../utils/canvasLayout";

// How far (in the zone polygon's own SVG coordinate space — canvas units,
// not screen pixels) a floating zone nudges toward the canvas center before
// easing back to its real, stored position. Modest on purpose: the backdrop
// still has to visibly enclose its own member nodes at every point in the
// cycle.
const AMPLITUDE = 40;
// Roughly how long each leg (toward center, or back home) takes, randomized
// per zone (seeded off its own rootId, like NodeCard's chaosStyle).
const MIN_LEG_S = 1.6;
const LEG_SPREAD_S = 1.6;
const HOME_DWELL_S = 0.3;
const OUT_DWELL_S = 0.5;
// The duration a click forces the current leg into, if a zone isn't home
// already — a deliberate, snappy sprint back rather than its own normal,
// slower leg.
const BOOST_DURATION_S = 0.45;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

interface FloatingZone {
  rootId: string;
  /** The zone polygon's own current geometric center, in canvas units. */
  centroid: { x: number; y: number };
}

interface ZoneRuntime {
  from: { x: number; y: number };
  target: { x: number; y: number };
  /** performance.now(), in seconds — when the *current* leg started. Can be in the past (see the mid-cycle seeding below), which is exactly the point. */
  legStartAt: number;
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
 * Each leg is a plain parametric ease (easeInOutCubic over t = elapsed /
 * legDuration, from a fixed start point to a fixed target — a proper
 * "launch, glide, land" curve with a definite arrival, not an exponential
 * decay that only ever asymptotically approaches it) — chosen so the motion
 * reads as one deliberate, smooth flight per leg rather than a jittery
 * organic wobble.
 *
 * A brand new zone doesn't start frozen at home waiting out its own first
 * leg before ever visibly moving — legStartAt is seeded *in the past* (see
 * below), so t is already partway to 1 on the very first frame. This is the
 * same trick NodeCard's own chaosStyle gets for free from a *negative* CSS
 * animation-delay (see index.css) — without it, a zone whose members are
 * already visibly drifting via that CSS animation the instant the map
 * opens would itself sit motionless for up to a couple of seconds first,
 * reading as "nodes move, zones don't" right when it matters most: the
 * first thing anyone sees.
 *
 * One continuous requestAnimationFrame loop (not per-zone setTimeout
 * chains, and not a CSS `@keyframes`/transition) recomputes every zone's
 * offset from its own always-current leg every frame and writes it
 * straight to that zone's <polygon> element via `elementsRef`, bypassing
 * React entirely (no state, no re-render) the same way the CSS-keyframe
 * version this replaced never re-rendered either. Doing the easing in JS
 * instead of via a CSS transition's own duration is specifically what lets
 * a click (`boostTick`) actually speed up a zone that's already mid-flight:
 * a CSS transition's timing is fixed at the moment it starts, so changing
 * `transition-duration` after the fact has no effect on one already
 * running — there's nothing to "reach into". A parametric value computed
 * fresh every frame has no such problem; boosting just swaps in a new,
 * short leg toward home starting from wherever the offset currently is.
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
  const isFirstBoost = useRef(true);

  // A click anywhere on the canvas — see MapPage's own canvas onClick —
  // forces every zone currently away from home onto a short, fresh leg back
  // to it, starting from wherever its offset actually is right now. Zones
  // already home just keep gently drifting in place; there's nothing to
  // speed up.
  useEffect(() => {
    if (isFirstBoost.current) {
      isFirstBoost.current = false;
      return;
    }
    const now = performance.now() / 1000;
    for (const runtime of runtimesRef.current.values()) {
      if (runtime.target.x === 0 && runtime.target.y === 0) continue; // already homeward/home
      const t = Math.min(1, (now - runtime.legStartAt) / runtime.legDuration);
      const eased = easeInOutCubic(t);
      runtime.from = { x: lerp(runtime.from.x, runtime.target.x, eased), y: lerp(runtime.from.y, runtime.target.y, eased) };
      runtime.target = { x: 0, y: 0 };
      runtime.legDuration = BOOST_DURATION_S;
      runtime.legStartAt = now;
    }
  }, [boostTick]);

  useEffect(() => {
    let raf = 0;

    function tick(nowMs: number) {
      raf = requestAnimationFrame(tick);
      const now = nowMs / 1000;

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
          const [rLeg, rPhase] = hashSeed(zone.rootId, 2);
          const legDuration = MIN_LEG_S + rLeg * LEG_SPREAD_S;
          // Seeded already partway through its very first leg (see the
          // hook's own doc comment) — a fraction, not the whole thing, so
          // it's still visibly *arriving* somewhere rather than starting
          // mid-teleport.
          const startFrac = 0.15 + rPhase * 0.55;
          runtime = {
            from: { x: 0, y: 0 },
            target: { x: 0, y: 0 }, // recomputed below, toward center, the instant this first leg is evaluated
            legDuration,
            legStartAt: now - startFrac * legDuration,
          };
          runtimes.set(zone.rootId, runtime);
        }

        let t = (now - runtime.legStartAt) / runtime.legDuration;
        if (t >= 1) {
          // This leg finished — start the next one (dwell folded in as
          // "shift legStartAt forward a bit", so a short pause at each end
          // is just t staying pinned past the dwell window rather than a
          // separate state).
          const overshoot = (t - 1) * runtime.legDuration;
          // True when the leg that just finished was heading *to* home —
          // i.e. it just arrived home, not out at the far point.
          const wasHeadingHome = runtime.target.x === 0 && runtime.target.y === 0;
          const dwell = wasHeadingHome ? HOME_DWELL_S : OUT_DWELL_S;
          if (overshoot < dwell) {
            t = 1; // hold at the arrived position for the dwell window
          } else {
            runtime.from = runtime.target;
            if (wasHeadingHome) {
              // Just arrived home — dwell, then head out again. Recomputed
              // fresh here (not just once at creation) — a zone dragged far
              // from where it started still gets a direction that actually
              // points at the canvas center right now.
              const dx = center.x - zone.centroid.x;
              const dy = center.y - zone.centroid.y;
              const dist = Math.hypot(dx, dy) || 1;
              runtime.target = { x: (dx / dist) * AMPLITUDE, y: (dy / dist) * AMPLITUDE };
            } else {
              runtime.target = { x: 0, y: 0 };
            }
            runtime.legStartAt = now - (overshoot - dwell);
            t = Math.min(1, (overshoot - dwell) / runtime.legDuration);
          }
        }
        // First-ever leg: target is still {0,0}==from, so nothing to head
        // toward yet — point it at the center right away instead of
        // waiting for a full arrived-then-flip cycle.
        if (runtime.target.x === 0 && runtime.target.y === 0 && runtime.from.x === 0 && runtime.from.y === 0) {
          const dx = center.x - zone.centroid.x;
          const dy = center.y - zone.centroid.y;
          const dist = Math.hypot(dx, dy) || 1;
          runtime.target = { x: (dx / dist) * AMPLITUDE, y: (dy / dist) * AMPLITUDE };
        }

        const eased = easeInOutCubic(Math.max(0, Math.min(1, t)));
        const offset = { x: lerp(runtime.from.x, runtime.target.x, eased), y: lerp(runtime.from.y, runtime.target.y, eased) };

        const el = elements.get(zone.rootId);
        if (el) el.style.transform = `translate(${offset.x.toFixed(2)}px, ${offset.y.toFixed(2)}px)`;
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
