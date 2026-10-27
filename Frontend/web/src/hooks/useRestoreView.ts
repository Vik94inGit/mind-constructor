import { useEffect, useRef } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { MapViewState } from "../api/state";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

interface Params {
  mapId: string | undefined;
  loading: boolean;
  /** ?node=<id> (a search result on the dashboard): the map opens on that node. */
  focusNodeId: string | null;
  savedView: { center: Pt | null; selectedNodeId: string | null } | null;
  saveView: (fields: MapViewState) => void;
  visibleNodes: NodeDoc[];
  selectedId: string | null;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  centerOnNode: (nodeId: string) => void;
  centerOnPoint: (x: number, y: number, opts?: { aboveSheet?: boolean }) => void;
  wrapRef: RefObject<HTMLElement | null>;
  screenToCanvas: (clientX: number, clientY: number) => Pt;
}

// Picking up where you left off (on this device or another): once the map
// and the saved view are both in, go back to the node that was open — or,
// with none, to the spot that was in the middle of the screen. From then on
// that spot (a moment after scrolling stops) and the open node are saved.
export function useRestoreView({
  mapId,
  loading,
  focusNodeId,
  savedView,
  saveView,
  visibleNodes,
  selectedId,
  setSelectedId,
  centerOnNode,
  centerOnPoint,
  wrapRef,
  screenToCanvas,
}: Params) {
  const restoredRef = useRef<string | null>(null);
  // With ?node=<id>, open on that node instead.
  useEffect(() => {
    if (loading || !focusNodeId || !mapId || restoredRef.current === mapId) return;
    restoredRef.current = mapId;
    window.setTimeout(() => {
      if (!visibleNodes.some((n) => n.nodeId === focusNodeId)) return;
      setSelectedId(focusNodeId);
      centerOnNode(focusNodeId);
    }, 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, focusNodeId, mapId]);
  useEffect(() => {
    if (loading || !savedView || !mapId || restoredRef.current === mapId) return;
    restoredRef.current = mapId;
    const { center, selectedNodeId } = savedView;
    // After the opening fit (useCanvasViewport) has put the view somewhere.
    window.setTimeout(() => {
      if (selectedNodeId && visibleNodes.some((n) => n.nodeId === selectedNodeId)) {
        setSelectedId(selectedNodeId);
        centerOnNode(selectedNodeId);
      } else if (center) {
        centerOnPoint(center.x, center.y, { aboveSheet: false });
      }
    }, 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, savedView, mapId]);
  useEffect(() => {
    if (restoredRef.current === mapId) saveView({ selectedNodeId: selectedId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  const screenToCanvasRef = useRef(screenToCanvas);
  screenToCanvasRef.current = screenToCanvas;
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || loading) return;
    let timer: number | undefined;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (restoredRef.current !== mapId) return;
        const r = wrap.getBoundingClientRect();
        const c = screenToCanvasRef.current(r.left + r.width / 2, r.top + r.height / 2);
        saveView({ center: { x: Math.round(c.x), y: Math.round(c.y) } });
      }, 1000);
    };
    wrap.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      wrap.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, mapId]);
}
