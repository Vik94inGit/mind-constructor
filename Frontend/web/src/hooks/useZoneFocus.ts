import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { focusedZoneIds, sameIds } from "../utils/zoneFocus";
import type { NodeGroup } from "../utils/canvasLayout";

interface Params {
  wrapRef: RefObject<HTMLDivElement>;
  loading: boolean;
  nodeGroups: NodeGroup[];
  zoom: number;
  hScrollMargin: number;
  vScrollMargin: number;
  /** A circle is stabilized — its own spotlight already says which zone matters. */
  hasSelectedCircle: boolean;
}

export function useZoneFocus({
  wrapRef,
  loading,
  nodeGroups,
  zoom,
  hScrollMargin,
  vScrollMargin,
  hasSelectedCircle,
}: Params) {
  // The zones near the middle of the screen stay at full strength and the
  // rest are muted (see utils/zoneFocus.ts), recomputed as the view pans and
  // zooms. Off while a circle is stabilized — that spotlight already says
  // which zone matters.
  const [focusedZones, setFocusedZones] = useState<Set<string> | null>(null);
  const zoneFocusInputs = useRef({ nodeGroups, zoom, hScrollMargin, vScrollMargin });
  zoneFocusInputs.current = { nodeGroups, zoom, hScrollMargin, vScrollMargin };
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const { nodeGroups, zoom, hScrollMargin, vScrollMargin } = zoneFocusInputs.current;
      const center = {
        x: (wrap.scrollLeft + wrap.clientWidth / 2) / zoom - hScrollMargin,
        y: (wrap.scrollTop + wrap.clientHeight / 2) / zoom - vScrollMargin,
      };
      // A quarter of the smaller screen side, in canvas units.
      const reach = (Math.min(wrap.clientWidth, wrap.clientHeight) / 4) / zoom;
      const next = focusedZoneIds(nodeGroups, center, reach);
      setFocusedZones((prev) => (sameIds(prev, next) ? prev : next));
    };
    const schedule = () => {
      if (frame == null) frame = requestAnimationFrame(update);
    };
    update();
    wrap.addEventListener("scroll", schedule, { passive: true });
    return () => {
      wrap.removeEventListener("scroll", schedule);
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [loading, nodeGroups, zoom, hScrollMargin, vScrollMargin, wrapRef]);
  const activeFocusedZones = hasSelectedCircle ? null : focusedZones;
  // Nodes that belong only to zones out of focus.
  const zoneMutedIds = useMemo(() => {
    const out = new Set<string>();
    if (!activeFocusedZones) return out;
    const inFocus = new Set<string>();
    for (const g of nodeGroups) {
      const focused = activeFocusedZones.has(g.rootId);
      for (const m of g.members) (focused ? inFocus : out).add(m.nodeId);
    }
    for (const id of inFocus) out.delete(id);
    return out;
  }, [activeFocusedZones, nodeGroups]);

  return { activeFocusedZones, zoneMutedIds };
}
