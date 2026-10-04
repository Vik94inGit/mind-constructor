import { useEffect, useRef, useState } from "react";
import { hashSeed } from "../utils/canvasLayout";

type Pt = { x: number; y: number };

const INTRO_MS = 1400;
/** How far out (canvas units) a node drifts before coming back. */
const REACH = 70;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Each node's drift for the opening animation: straight out from the middle
 * of the map, a little further for some than others, so the map reads as
 * breathing out. A node right on the middle goes off in its own direction.
 */
export function introOffsets(positions: Map<string, Pt>, reach = REACH): Map<string, Pt> {
  const out = new Map<string, Pt>();
  if (positions.size === 0) return out;
  let cx = 0;
  let cy = 0;
  for (const p of positions.values()) {
    cx += p.x;
    cy += p.y;
  }
  cx /= positions.size;
  cy /= positions.size;
  for (const [id, p] of positions) {
    const [r1, r2] = hashSeed(id, 2);
    let dx = p.x - cx;
    let dy = p.y - cy;
    const d = Math.hypot(dx, dy);
    if (d < 1) {
      dx = Math.cos(r1 * 2 * Math.PI);
      dy = Math.sin(r1 * 2 * Math.PI);
    } else {
      dx /= d;
      dy /= d;
    }
    const len = reach * (0.6 + 0.4 * r2);
    out.set(id, { x: dx * len, y: dy * len });
  }
  return out;
}

/** 0 → 1 → 0 over the animation, easing in and out of both turns. */
export function introAmount(p: number): number {
  return Math.sin(Math.PI * Math.min(1, Math.max(0, p))) ** 2;
}

// The map's opening animation: when a map is opened, its nodes drift out from
// the middle and glide back to their own spots. Purely drawn — nothing is
// saved, and it runs once per map opened. Returns how far each node is off
// its spot right now (null once it's over); everything drawn from a node's
// position reads it (see MapPage's posFor), so edges and zones move along.
export function useIntroMigration(mapId: string | null, positions: Map<string, Pt>): (nodeId: string) => Pt | null {
  const [amount, setAmount] = useState(0);
  const offsetsRef = useRef<Map<string, Pt> | null>(null);
  const playedRef = useRef<string | null>(null);
  // Read when the animation starts; later changes (a node saved, a live
  // update) don't restart it.
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const hasNodes = positions.size > 0;

  useEffect(() => {
    if (!mapId || playedRef.current === mapId || !hasNodes) return;
    playedRef.current = mapId;
    if (prefersReducedMotion()) return;
    offsetsRef.current = introOffsets(positionsRef.current);
    const start = performance.now();
    let frame = 0;
    let finished = false;
    const step = (now: number) => {
      const p = (now - start) / INTRO_MS;
      if (p >= 1) {
        finished = true;
        offsetsRef.current = null;
        setAmount(0);
        return;
      }
      setAmount(introAmount(p));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    // Frames stop in a background tab; the nodes still have to end up home.
    const done = window.setTimeout(() => {
      finished = true;
      offsetsRef.current = null;
      setAmount(0);
    }, INTRO_MS + 200);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(done);
      offsetsRef.current = null;
      // Cut short (another map opened, or React re-ran the effect in
      // development): let it play from the start again.
      if (!finished) {
        playedRef.current = null;
        setAmount(0);
      }
    };
  }, [mapId, hasNodes]);

  return (nodeId: string) => {
    const o = offsetsRef.current?.get(nodeId);
    return o && amount > 0 ? { x: o.x * amount, y: o.y * amount } : null;
  };
}
