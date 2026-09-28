import { useEffect, useRef } from "react";
import { hashSeed } from "../utils/canvasLayout";

// How far (in the zone polygon's own SVG coordinate space — canvas units,
// not screen pixels, same caveat as the old CSS-keyframe version this
// replaced) a floating zone nudges toward the canvas center before easing
// back to its real, stored position. Modest on purpose: the backdrop still
// has to visibly enclose its own member nodes at every point in the cycle.
const AMPLITUDE = 28;
// Each way's transition duration is randomized per zone (seeded off its own
// rootId, like NodeCard's chaosStyle) in this range, in seconds.
const MIN_LEG_S = 2.5;
const LEG_SPREAD_S = 2;
// How long a zone lingers at each end of the cycle before reversing.
const HOME_DWELL_MS = 600;
const OUT_DWELL_MS = 900;
// The fast transition a click forces a zone into, if it isn't home already.
const BOOST_DURATION_S = 0.55;

interface FloatingZone {
  rootId: string;
  /** The zone polygon's own current geometric center, in canvas units. */
  centroid: { x: number; y: number };
}

interface ZoneRuntime {
  timer: ReturnType<typeof setTimeout> | null;
  atHome: boolean;
  legDuration: number;
  boostHome: () => void;
}

/**
 * Imperatively drives each un-stabilized zone's own backdrop through a
 * "drift toward the canvas center, dwell, ease back to its real position,
 * dwell, repeat" cycle — the same "still undecided" floating quality
 * NodeCard's own chaotic drift already gives an unchosen circle's member
 * nodes (see NodeCard's chaosStyle), just for the whole polygon rather than
 * one small icon.
 *
 * Deliberately not React state/CSS-keyframe driven: a click anywhere on the
 * canvas (see `boostTick`) has to be able to snap whichever zones are
 * currently away from home into a fast "sprint back" — which means reaching
 * into an in-flight CSS transition and restarting it with a shorter
 * duration, something a declarative style prop can't express (changing
 * `transition-duration` alone never affects a transition already running).
 * So each zone's own <polygon> element is mutated directly via
 * `elementsRef`, and the "go out"/"come home" cycle is just a pair of
 * mutually-recursive setTimeout calls, not a render loop — nothing here
 * re-renders React on every frame.
 */
export function useZoneFloat(
  floatingZones: FloatingZone[],
  center: { x: number; y: number },
  elementsRef: { current: Map<string, SVGPolygonElement> },
  boostTick: number,
) {
  const runtimesRef = useRef(new Map<string, ZoneRuntime>());

  useEffect(() => {
    const runtimes = runtimesRef.current;
    const elements = elementsRef.current;
    const seenIds = new Set(floatingZones.map((z) => z.rootId));

    // A zone that stabilized, or left the map entirely, stops floating —
    // clear its timer and hand its polygon back its plain, un-transformed
    // real position instead of leaving it frozen mid-drift.
    for (const [rootId, runtime] of Array.from(runtimes.entries())) {
      if (seenIds.has(rootId)) continue;
      if (runtime.timer) clearTimeout(runtime.timer);
      runtimes.delete(rootId);
      const el = elements.get(rootId);
      if (el) {
        el.style.transition = "";
        el.style.transform = "";
      }
    }

    for (const zone of floatingZones) {
      if (runtimes.has(zone.rootId)) continue;
      const el = elements.get(zone.rootId);
      if (!el) continue;

      const [rLeg, rDelay] = hashSeed(zone.rootId, 2);
      const legDuration = MIN_LEG_S + rLeg * LEG_SPREAD_S;
      const runtime: ZoneRuntime = {
        timer: null,
        atHome: true,
        legDuration,
        boostHome: () => {},
      };
      runtimes.set(zone.rootId, runtime);

      const goOut = () => {
        const target = elements.get(zone.rootId);
        if (!target || !runtimes.has(zone.rootId)) return;
        const dx = center.x - zone.centroid.x;
        const dy = center.y - zone.centroid.y;
        const dist = Math.hypot(dx, dy) || 1;
        target.style.transition = `transform ${runtime.legDuration}s ease-in-out`;
        target.style.transform = `translate(${(dx / dist) * AMPLITUDE}px, ${(dy / dist) * AMPLITUDE}px)`;
        runtime.atHome = false;
        runtime.timer = setTimeout(goHome, runtime.legDuration * 1000 + OUT_DWELL_MS);
      };
      const goHome = (fast = false) => {
        const target = elements.get(zone.rootId);
        if (!target || !runtimes.has(zone.rootId)) return;
        const duration = fast ? BOOST_DURATION_S : runtime.legDuration;
        target.style.transition = `transform ${duration}s ease-in-out`;
        target.style.transform = "translate(0px, 0px)";
        runtime.atHome = true;
        runtime.timer = setTimeout(goOut, duration * 1000 + HOME_DWELL_MS);
      };
      runtime.boostHome = () => {
        if (runtime.timer) clearTimeout(runtime.timer);
        goHome(true);
      };

      // Desync each zone's own start so they don't all drift in lockstep.
      runtime.timer = setTimeout(goOut, rDelay * legDuration * 1000);
    }
    // floatingZones is a fresh array/object every render (nodeGroups is
    // recomputed on most position changes) — that's fine, the loop above is
    // a no-op for every zone it's already tracking (the `continue` above),
    // so re-running this effect often costs a cheap Set/Map scan, not a
    // restarted animation.
  }, [floatingZones, center.x, center.y, elementsRef]);

  // A click anywhere on the canvas — see MapPage's own canvas onClick —
  // sprints every zone that's currently away from home back to its real
  // position at BOOST_DURATION_S instead of its own normal, slower leg.
  // Zones already home have nothing to speed up, so they're left alone.
  const isFirstBoost = useRef(true);
  useEffect(() => {
    if (isFirstBoost.current) {
      isFirstBoost.current = false;
      return;
    }
    for (const runtime of runtimesRef.current.values()) {
      if (!runtime.atHome) runtime.boostHome();
    }
  }, [boostTick]);

  useEffect(() => {
    const runtimes = runtimesRef.current;
    return () => {
      for (const runtime of runtimes.values()) {
        if (runtime.timer) clearTimeout(runtime.timer);
      }
    };
  }, []);
}
