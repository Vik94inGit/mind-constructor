import { useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { redirectRefusal } from "../utils/edgeRedirect";
import type { RedirectRefusal } from "../utils/edgeRedirect";
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

interface Params {
  nodes: NodeDoc[];
  isOwnNode: (node: NodeDoc) => boolean;
  screenToCanvas: (clientX: number, clientY: number) => Pt;
  /** Let go over a node that can be the parent. */
  onRedirect: (child: NodeDoc, parent: NodeDoc) => void;
  /** Let go over a node that can't, with why (nothing for letting go over its own parent or nowhere). */
  onRefused: (reason: Exclude<RedirectRefusal, "same">) => void;
}

// Grabbing a branch arrow's knob (CanvasBackdrop) and dragging it: the arrow
// leaves its parent and follows the pointer; let go over another node and
// that node becomes the parent (MapPage hands it to redirectParent, which
// settles the zones). Let go anywhere else and nothing changes.
export function useEdgeRedirect({ nodes, isOwnNode, screenToCanvas, onRedirect, onRefused }: Params) {
  const [edgeRedirect, setEdgeRedirect] = useState<EdgeRedirect | null>(null);
  function nodeIdAt(clientX: number, clientY: number): string | null {
    const el = document.elementFromPoint(clientX, clientY);
    return el?.closest("[data-reveal-node]")?.getAttribute("data-reveal-node") ?? null;
  }
  const byId = (id: string | null) => (id ? nodes.find((n) => n.nodeId === id) : undefined);

  function startEdgeRedirect(child: NodeDoc, e: ReactPointerEvent) {
    if (!isOwnNode(child)) return;
    e.stopPropagation();
    e.preventDefault();
    const track = (clientX: number, clientY: number) => {
      const overId = nodeIdAt(clientX, clientY);
      const over = byId(overId);
      setEdgeRedirect({
        childId: child.nodeId,
        to: screenToCanvas(clientX, clientY),
        overId: over && over.nodeId !== child.nodeId ? over.nodeId : null,
        valid: !!over && redirectRefusal(child, over, nodes, isOwnNode) === null,
      });
    };
    const onMove = (ev: PointerEvent) => track(ev.clientX, ev.clientY);
    const finish = (ev: PointerEvent, drop: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      setEdgeRedirect(null);
      // The release lands on whatever is under the pointer, which would
      // otherwise read as a click there (selecting a node, or closing the
      // panel on bare canvas).
      const swallow = (ce: MouseEvent) => ce.stopPropagation();
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      if (!drop) return;
      const target = byId(nodeIdAt(ev.clientX, ev.clientY));
      if (!target) return;
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
