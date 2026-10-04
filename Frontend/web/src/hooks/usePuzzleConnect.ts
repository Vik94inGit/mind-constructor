import { useState } from "react";
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import { nodeRefId } from "../utils/nodeType";
import type { Pt } from "./useCanvasMode";
import type { EdgeDoc, NodeDoc } from "../types";

interface Params {
  nodes: NodeDoc[];
  edges: EdgeDoc[];
  isOwnNode: (node: NodeDoc) => boolean;
  screenToCanvas: (clientX: number, clientY: number) => Pt;
  setContextMenu: (value: null) => void;
  /** Opens the link dialog for the two pieces a connect drag joined. */
  setPendingLink: Dispatch<SetStateAction<NodeDoc[] | null>>;
}

// Connecting puzzle pieces: dragging out of a piece's tab (see PuzzleCard's
// handles) draws a line to the pointer; letting go over another of your own
// pieces opens the link dialog for the two, like the group bar's Link. A link
// needs both ends to be yours (Backend's createEdgeAbl), and a pair that's
// already linked can't be linked again.
//
// Pieces never click into each other on their own: they're joined flush only
// once you lock them (the node's right-click / hold menu — see MapPage's
// puzzleAssembly).
export function usePuzzleConnect({ nodes, edges, isOwnNode, screenToCanvas, setContextMenu, setPendingLink }: Params) {
  const [puzzleConnect, setPuzzleConnect] = useState<{
    fromId: string;
    to: { x: number; y: number };
    overId: string | null;
    valid: boolean;
  } | null>(null);
  function nodeIdAt(clientX: number, clientY: number): string | null {
    const el = document.elementFromPoint(clientX, clientY);
    return el?.closest("[data-reveal-node]")?.getAttribute("data-reveal-node") ?? null;
  }
  function canConnect(from: NodeDoc, to: NodeDoc | undefined): to is NodeDoc {
    if (!to || to.nodeId === from.nodeId || !isOwnNode(to)) return false;
    return !edges.some((e) => {
      const a = nodeRefId(e.fromNodeId);
      const b = nodeRefId(e.toNodeId);
      return (a === from.nodeId && b === to.nodeId) || (a === to.nodeId && b === from.nodeId);
    });
  }

  function startPuzzleConnect(from: NodeDoc, e: ReactPointerEvent) {
    setContextMenu(null);
    const track = (clientX: number, clientY: number) => {
      const id = nodeIdAt(clientX, clientY);
      const overId = id && id !== from.nodeId ? id : null;
      setPuzzleConnect({
        fromId: from.nodeId,
        to: screenToCanvas(clientX, clientY),
        overId,
        valid: !!overId && canConnect(from, nodes.find((n) => n.nodeId === overId)),
      });
    };
    const onMove = (ev: PointerEvent) => track(ev.clientX, ev.clientY);
    const finish = (ev: PointerEvent, drop: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      setPuzzleConnect(null);
      // The release lands on whatever is under the pointer, which would
      // otherwise read as a click there (selecting a node, or closing the
      // panel on bare canvas).
      const swallow = (ce: MouseEvent) => ce.stopPropagation();
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      if (!drop) return;
      const to = nodes.find((n) => n.nodeId === nodeIdAt(ev.clientX, ev.clientY));
      if (canConnect(from, to)) setPendingLink([from, to]);
    };
    const onUp = (ev: PointerEvent) => finish(ev, true);
    const onCancel = (ev: PointerEvent) => finish(ev, false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    track(e.clientX, e.clientY);
  }

  return { puzzleConnect, startPuzzleConnect };
}
