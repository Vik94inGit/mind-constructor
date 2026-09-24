import { useEffect, useRef, useState } from "react";

type Pt = { x: number; y: number };

const BLEND_MS = 950;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Eases between "every node at its own spot" (0) and "the selected node's
// neighbors on their ring" (1), so neighbors glide into and back out of the
// ring instead of jumping. `map` is the ring last asked for — kept after the
// ring goes away, until the glide back has finished — and `blend` how far
// along the way it currently is; a node's drawn position is its own spot
// moved `blend` of the way to its ring spot. Everything drawn from a node's
// position (cards, edges, zones) reads the same blended value, so they move
// together.
export function useRadialBlend(radial: Map<string, Pt> | null): { map: Map<string, Pt> | null; blend: number } {
  const [blend, setBlend] = useState(0);
  const blendRef = useRef(0);
  const heldRef = useRef<Map<string, Pt> | null>(null);
  if (radial) heldRef.current = radial;

  useEffect(() => {
    const target = radial ? 1 : 0;
    const from = blendRef.current;
    if (from === target) {
      if (target === 0) heldRef.current = null;
      return;
    }
    if (prefersReducedMotion()) {
      blendRef.current = target;
      setBlend(target);
      if (target === 0) heldRef.current = null;
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / BLEND_MS);
      const eased = 0.5 - Math.cos(Math.PI * p) / 2;
      const value = from + (target - from) * eased;
      blendRef.current = value;
      setBlend(value);
      if (p < 1) {
        frame = requestAnimationFrame(step);
      } else if (target === 0) {
        heldRef.current = null;
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [radial]);

  return { map: heldRef.current, blend };
}
