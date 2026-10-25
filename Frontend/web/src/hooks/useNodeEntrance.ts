import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  appearAmount,
  applyEntranceFrame,
  computeEntranceDelays,
  easeOutCubic,
  entranceEndMs,
  SKIP_MS,
} from "../utils/nodeEntrance";
import type { NodeDoc } from "../types";

interface Params {
  visibleNodes: NodeDoc[];
  /** The canvas element every node/zone/link is rendered inside. */
  canvasRef: RefObject<HTMLElement | null>;
}

interface Running {
  delays: Map<string, number>;
  startedAt: number;
  skip: { at: number; from: Map<string, number> } | null;
}

/**
 * The map's entrance: when a map opens, its nodes appear one after another in
 * the order they were made, each fading and growing in where it already sits,
 * with its zones, links and weapon bows filling in as their nodes arrive.
 * Nothing moves and nothing is persisted; a node made after the map opened is
 * simply there.
 *
 * Driven by a requestAnimationFrame loop that writes each frame straight onto
 * the canvas DOM (applyEntranceFrame), never through React state, so there
 * are no whole-map re-renders.
 */
export function useNodeEntrance({ visibleNodes, canvasRef }: Params) {
  const [active, setActive] = useState(false);
  const running = useRef<Running | null>(null);
  const raf = useRef(0);
  const opened = useRef(false);

  function amount(r: Running, id: string, now: number): number | null {
    const delay = r.delays.get(id);
    if (delay === undefined) return null;
    if (r.skip) {
      const from = r.skip.from.get(id) ?? 1;
      return from + (1 - from) * easeOutCubic(Math.min(1, (now - r.skip.at) / SKIP_MS));
    }
    return appearAmount(now - r.startedAt, delay);
  }

  function paint(r: Running, root: HTMLElement, now: number) {
    applyEntranceFrame(root, (id) => amount(r, id, now));
  }

  function stop() {
    cancelAnimationFrame(raf.current);
    const root = canvasRef.current;
    if (root) applyEntranceFrame(root, () => null);
    running.current = null;
    setActive(false);
  }

  function tick() {
    const r = running.current;
    const root = canvasRef.current;
    if (!r || !root) return;
    const now = performance.now();
    paint(r, root, now);
    const done = r.skip ? now - r.skip.at >= SKIP_MS : now - r.startedAt >= entranceEndMs(r.delays);
    if (done) stop();
    else raf.current = requestAnimationFrame(tick);
  }

  /** Cut the entrance short: every node not yet there comes in quickly. */
  function skip() {
    const r = running.current;
    if (!r || r.skip) return;
    const now = performance.now();
    const from = new Map<string, number>();
    for (const id of r.delays.keys()) from.set(id, amount(r, id, now) ?? 1);
    r.skip = { at: now, from };
  }

  // Starts before the browser first paints the loaded map, so no node shows
  // up only to vanish and come back. A re-render while it runs (the opening
  // drift, a live update) is painted over again before it reaches the screen.
  const loaded = visibleNodes.length > 0;
  useLayoutEffect(() => {
    const root = canvasRef.current;
    if (!running.current && loaded && !opened.current && root) {
      opened.current = true;
      const delays = computeEntranceDelays(visibleNodes);
      if (delays.size < 2) return;
      running.current = { delays, startedAt: performance.now(), skip: null };
      setActive(true);
      raf.current = requestAnimationFrame(tick);
    }
    const r = running.current;
    if (r && root) paint(r, root, performance.now());
  });

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      running.current = null;
    },
    [],
  );

  return { skip, active };
}
