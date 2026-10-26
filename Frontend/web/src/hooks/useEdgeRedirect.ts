import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { redirectRefusal } from "../utils/edgeRedirect";
import type { RedirectRefusal } from "../utils/edgeRedirect";
import { zoneParentId } from "../utils/nodeType";
import type { Pt } from "./useCanvasMode";
import type { NodeDoc } from "../types";

// The branch arrow being redirected right now: its parent end follows the
// pointer, and `overId` is the node under it (valid when it can become the
// parent). See utils/edgeRedirect.ts for the rules.
export interface EdgeRedirect {
  childId: string;
  to: Pt;
  overId: string | null;
  valid: boolean;
}

// How close (screen px) to the edge of the visible map the pointer has to
// come for the map to pan under it, and how fast it pans right at the edge.
// NEAR_PX: a finger covers more than its point, so a drop this close (screen
// px) to a node's center counts as on it.
export const EDGE_PAN_PX = 56;
export const EDGE_PAN_SPEED = 10;
export const NEAR_PX = 44;
// Less travel than this (screen px) between grabbing the knob and letting go is a tap.
export const TAP_SLOP_PX = 8;

/** How far to pan this frame for a pointer at (x, y) in `area`: toward whichever edges it's near, faster the closer. */
export function edgePan(x: number, y: number, area: { left: number; top: number; right: number; bottom: number }): Pt {
  const push = (into: number) => (into < EDGE_PAN_PX ? Math.round(EDGE_PAN_SPEED * (1 - Math.max(0, into) / EDGE_PAN_PX)) : 0);
  return {
    x: push(area.right - x) - push(x - area.left),
    y: push(area.bottom - y) - push(y - area.top),
  };
}

interface Params {
  nodes: NodeDoc[];
  isOwnNode: (node: NodeDoc) => boolean;
  screenToCanvas: (clientX: number, clientY: number) => Pt;
  /** Let go over a node that can be the parent. */
  onRedirect: (child: NodeDoc, parent: NodeDoc) => void;
  /** Let go over a node that can't, with why (nothing for letting go over its own parent or nowhere). */
  onRefused: (reason: Exclude<RedirectRefusal, "same">) => void;
  /** Let go over its own parent: the child takes the parent's place as head of the zone (MapPage, utils/edgeRedirect.ts takeParentPlace). */
  onTakeParentPlace?: (child: NodeDoc, parent: NodeDoc) => void;
  /** The knob tapped rather than dragged: change the parent by tapping it instead (MapPage's reparent mode). */
  onTap?: (child: NodeDoc) => void;
  /** The map's scrolling area: held near its edge, the pointer pans it, so a parent off screen can be reached. */
  scrollArea?: () => HTMLElement | null;
  /** The nodes on the map and where they're drawn: one near the pointer counts as under it. */
  visibleNodes?: NodeDoc[];
  posFor?: (node: NodeDoc) => Pt;
  zoom?: number;
}

// Grabbing a branch arrow's knob (map/RedirectKnobs.tsx) and dragging it: the
// arrow leaves its parent and follows the pointer; let go over another node
// and that node becomes the parent (MapPage hands it to redirectParent, which
// settles the zones); let go over its own parent and the child takes that
// parent's place as head of the zone. Let go anywhere else and nothing changes. On a phone
// most of the map is off screen, so holding the finger near an edge of the
// visible map (above the node panel) pans it that way.
export function useEdgeRedirect({
  nodes,
  isOwnNode,
  screenToCanvas,
  onRedirect,
  onRefused,
  onTakeParentPlace,
  onTap,
  scrollArea,
  visibleNodes = [],
  posFor,
  zoom = 1,
}: Params) {
  const [edgeRedirect, setEdgeRedirect] = useState<EdgeRedirect | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRef.current?.(), []);
  // The node under the pointer, else the nearest one within a finger's reach.
  function nodeIdAt(clientX: number, clientY: number, skipId: string): string | null {
    const el = document.elementFromPoint(clientX, clientY);
    const hit = el?.closest("[data-reveal-node]")?.getAttribute("data-reveal-node");
    if (hit || !posFor) return hit ?? null;
    const p = screenToCanvas(clientX, clientY);
    let best: string | null = null;
    let bestDist = NEAR_PX / zoom;
    for (const n of visibleNodes) {
      if (n.nodeId === skipId) continue;
      const q = posFor(n);
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bestDist) {
        best = n.nodeId;
        bestDist = d;
      }
    }
    return best;
  }
  const byId = (id: string | null) => (id ? nodes.find((n) => n.nodeId === id) : undefined);
  const isParentOf = (child: NodeDoc, node: NodeDoc) => !!onTakeParentPlace && node.nodeId === zoneParentId(child);

  function startEdgeRedirect(child: NodeDoc, e: ReactPointerEvent) {
    if (!isOwnNode(child)) return;
    e.stopPropagation();
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    let last = start;
    let moved = false;
    const track = (clientX: number, clientY: number) => {
      last = { x: clientX, y: clientY };
      if (Math.hypot(clientX - start.x, clientY - start.y) >= TAP_SLOP_PX) moved = true;
      const overId = nodeIdAt(clientX, clientY, child.nodeId);
      const over = byId(overId);
      setEdgeRedirect({
        childId: child.nodeId,
        to: screenToCanvas(clientX, clientY),
        overId: over && over.nodeId !== child.nodeId ? over.nodeId : null,
        valid: !!over && (isParentOf(child, over) || redirectRefusal(child, over, nodes, isOwnNode) === null),
      });
    };
    // Each frame: pan when the pointer is held near an edge of what's visible
    // of the map, and keep the arrow under the pointer as the map moves.
    let frame = 0;
    const panStep = () => {
      frame = requestAnimationFrame(panStep);
      const wrap = scrollArea?.();
      // A knob held still (about to be a tap) never pans the map.
      if (!wrap || !moved) return;
      const rect = wrap.getBoundingClientRect();
      const panel = document.querySelector("[data-node-panel]")?.getBoundingClientRect();
      // A bottom sheet (the phone's node panel) covers the lower map: its top is the edge.
      const bottom = panel && panel.top > rect.top + EDGE_PAN_PX * 2 ? Math.min(rect.bottom, panel.top) : rect.bottom;
      const d = edgePan(last.x, last.y, { left: rect.left, top: rect.top, right: rect.right, bottom });
      if (d.x === 0 && d.y === 0) return;
      const before = { left: wrap.scrollLeft, top: wrap.scrollTop };
      wrap.scrollLeft += d.x;
      wrap.scrollTop += d.y;
      if (wrap.scrollLeft !== before.left || wrap.scrollTop !== before.top) track(last.x, last.y);
    };
    if (typeof requestAnimationFrame === "function") frame = requestAnimationFrame(panStep);
    const onMove = (ev: PointerEvent) => track(ev.clientX, ev.clientY);
    const stop = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      stopRef.current = null;
    };
    stopRef.current = stop;
    const finish = (ev: PointerEvent, drop: boolean) => {
      stop();
      setEdgeRedirect(null);
      // The release lands on whatever is under the pointer, which would
      // otherwise read as a click there (selecting a node, or closing the
      // panel on bare canvas).
      const swallow = (ce: MouseEvent) => ce.stopPropagation();
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      if (!drop) return;
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < TAP_SLOP_PX) {
        onTap?.(child);
        return;
      }
      const target = byId(nodeIdAt(ev.clientX, ev.clientY, child.nodeId));
      if (!target) return;
      if (isParentOf(child, target)) {
        onTakeParentPlace!(child, target);
        return;
      }
      const refusal = redirectRefusal(child, target, nodes, isOwnNode);
      if (refusal === null) onRedirect(child, target);
      else if (refusal !== "same") onRefused(refusal);
    };
    const onUp = (ev: PointerEvent) => finish(ev, true);
    const onCancel = (ev: PointerEvent) => finish(ev, false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    track(e.clientX, e.clientY);
  }

  return { edgeRedirect, startEdgeRedirect };
}
