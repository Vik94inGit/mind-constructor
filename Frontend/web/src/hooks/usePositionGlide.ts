import { useEffect, useRef, useState } from "react";

type Pt = { x: number; y: number };

const GLIDE_MS = 420;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Eases out: quick to leave, gentle to land. */
export function glideAmount(p: number): number {
  const t = Math.min(1, Math.max(0, p));
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Where each node should start gliding from, when the resting positions
 * change from `prev` to `next`: the spot it was last drawn at, for every node
 * that was already on the map and now rests somewhere else.
 */
export function glideStarts(prev: Map<string, Pt>, next: Map<string, Pt>, shown: Map<string, Pt>): Map<string, Pt> {
  const out = new Map<string, Pt>();
  for (const [id, to] of next) {
    if (!prev.has(id)) continue;
    const from = shown.get(id);
    if (from && Math.hypot(from.x - to.x, from.y - to.y) > 1) out.set(id, from);
  }
  return out;
}

// Nodes glide to a new resting spot instead of jumping there: a drop that the
// zone rules nudge, a node another member moved, the layout shifting after a
// change. Without it, everything that moved — the nodes, their links and the
// zones drawn around them — changed in one frame, which read as the map
// flashing. `shown(id, pt)` records where a node was drawn (call it with every
// position handed out, a dragged node's included); `at(id, resting)` gives
// where to draw it now.
export function usePositionGlide(positions: Map<string, Pt>) {
  const shownRef = useRef(new Map<string, Pt>());
  const prevRef = useRef(positions);
  const glideRef = useRef<{ from: Map<string, Pt>; start: number } | null>(null);
  const [run, setRun] = useState(0);
  const [, setFrame] = useState(0);

  // Worked out while rendering, not in an effect: the render with the new
  // positions has to already draw the nodes where they were, or that one
  // frame shows them at the new spot before the glide pulls them back.
  if (positions !== prevRef.current) {
    const prev = prevRef.current;
    prevRef.current = positions;
    const from = prefersReducedMotion() ? new Map<string, Pt>() : glideStarts(prev, positions, shownRef.current);
    if (from.size > 0) {
      glideRef.current = { from, start: performance.now() };
      setRun((r) => r + 1);
    }
  }

  useEffect(() => {
    const glide = glideRef.current;
    if (!glide) return;
    let frame = requestAnimationFrame(function step(now) {
      if (glideRef.current !== glide) return;
      if (now - glide.start >= GLIDE_MS) {
        glideRef.current = null;
        setFrame((f) => f + 1);
        return;
      }
      setFrame((f) => f + 1);
      frame = requestAnimationFrame(step);
    });
    // Frames stop in a background tab; the nodes still have to land.
    const done = window.setTimeout(() => {
      if (glideRef.current !== glide) return;
      glideRef.current = null;
      setFrame((f) => f + 1);
    }, GLIDE_MS + 150);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(done);
    };
  }, [run]);

  function shown(id: string, pt: Pt): Pt {
    shownRef.current.set(id, pt);
    return pt;
  }

  function at(id: string, resting: Pt): Pt {
    const glide = glideRef.current;
    const from = glide?.from.get(id);
    if (!glide || !from) return resting;
    const e = glideAmount((performance.now() - glide.start) / GLIDE_MS);
    return { x: from.x + (resting.x - from.x) * e, y: from.y + (resting.y - from.y) * e };
  }

  return { at, shown };
}
