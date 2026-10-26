import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  appearAmount,
  applyEntranceFrame,
  computeEntranceDelays,
  isZoneKey,
  easeOutCubic,
  entranceEndMs,
  SKIP_MS,
} from "../utils/nodeEntrance";
import type { NodeDoc } from "../types";

interface Params {
  visibleNodes: NodeDoc[];
  /** Every zone's parent: the zones are drawn, one by one, once every node is in. */
  zoneRootIds?: string[];
  /** The canvas element every node/zone/link is rendered inside. */
  canvasRef: RefObject<HTMLElement | null>;
  /** The camera's cue: this node's turn to appear has come. */
  onNodeAppear?: (nodeId: string) => void;
  /** The nodes are all in and the zones start, without the user cutting it short. */
  onZonesStart?: () => void;
  /** Everything is in, without the user cutting it short. */
  onFinish?: () => void;
}

interface Running {
  delays: Map<string, number>;
  startedAt: number;
  /** How many nodes, in delay order, have had their turn announced. */
  announced: number;
  skip: { at: number; from: Map<string, number> } | null;
}

/**
 * The map's entrance: when a map opens, its nodes appear one after another in
 * the order they were made, slowly enough to retrace how the thinking went,
 * and then its zones are drawn one by one round them.
 * Each fades and grows in where it already sits, with its links and weapon
 * bows showing once both their nodes are there; the camera follows each one
 * (onNodeAppear) and steps back to the whole map for the zones (onZonesStart)
 * or at the end (onFinish).
 * No node moves and nothing is persisted; a node made after the map opened
 * is simply there.
 *
 * Driven by a requestAnimationFrame loop that writes each frame straight onto
 * the canvas DOM (applyEntranceFrame), never through React state, so there
 * are no whole-map re-renders.
 */
export function useNodeEntrance({ visibleNodes, zoneRootIds, canvasRef, onNodeAppear, onZonesStart, onFinish }: Params) {
  const [active, setActive] = useState(false);
  // The rAF loop keeps the closure it started with, so it reads the latest
  // callbacks (and the positions they see) through a ref.
  const callbacks = useRef({ onNodeAppear, onZonesStart, onFinish });
  callbacks.current = { onNodeAppear, onZonesStart, onFinish };
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
    if (!r.skip) {
      const order = Array.from(r.delays.entries());
      while (r.announced < order.length && now - r.startedAt >= order[r.announced][1]) {
        const id = order[r.announced][0];
        if (!isZoneKey(id)) callbacks.current.onNodeAppear?.(id);
        else if (r.announced === 0 || !isZoneKey(order[r.announced - 1][0])) callbacks.current.onZonesStart?.();
        r.announced++;
      }
    }
    const done = r.skip ? now - r.skip.at >= SKIP_MS : now - r.startedAt >= entranceEndMs(r.delays);
    if (!done) {
      raf.current = requestAnimationFrame(tick);
      return;
    }
    const finished = !r.skip;
    stop();
    if (finished) callbacks.current.onFinish?.();
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
      const delays = computeEntranceDelays(visibleNodes, zoneRootIds);
      if (delays.size < 2) return;
      running.current = { delays, startedAt: performance.now(), announced: 0, skip: null };
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
