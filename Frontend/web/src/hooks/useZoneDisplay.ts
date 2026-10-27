import { useMemo } from "react";
import { zoneModeByNode } from "../utils/zoneDisplay";
import type { ZoneDisplay, ZoneMode } from "../utils/zoneDisplay";
import type { NodeDisplay } from "../utils/nodeDisplay";
import type { NodeGroup } from "../utils/canvasLayout";
import type { ReadingMode } from "../utils/readingMode";

interface Params {
  nodeGroups: NodeGroup[];
  /** The viewer's own choices (useMapViewerPrefs): per zone, per node, and map-wide. */
  zoneDisplay: ZoneDisplay;
  storeZoneDisplay: (next: ZoneDisplay) => void;
  nodeDisplay: NodeDisplay;
  readingMode: ReadingMode;
  /** useCanvasFraming's "zoom in to make room" for a text look. */
  fitZoomForDisplay: (display: NodeDisplay, globalMode: ReadingMode, centerOn?: { x: number; y: number }) => void;
}

// How each node is drawn: its own display if it has one, else its zone's
// view, else the map's reading mode. A zone shown as dots draws its nodes
// as dots (and reads as the default look underneath, for everything that
// sizes or captions a node).
export function useZoneDisplay({ nodeGroups, zoneDisplay, storeZoneDisplay, nodeDisplay, readingMode, fitZoomForDisplay }: Params) {
  const zoneModes = useMemo(() => zoneModeByNode(nodeGroups, zoneDisplay), [nodeGroups, zoneDisplay]);
  function modeOf(nodeId: string): ReadingMode {
    const own = nodeDisplay[nodeId];
    if (own) return own;
    const zone = zoneModes.get(nodeId);
    if (zone) return zone === "dots" ? "actual" : zone;
    return readingMode;
  }
  function dottedByZone(nodeId: string): boolean {
    return !nodeDisplay[nodeId] && zoneModes.get(nodeId) === "dots";
  }
  // Every node whose look differs from the map-wide mode, for the "zoom in
  // to make room" check (fitZoomForDisplay), which reads a NodeDisplay.
  function effectiveDisplay(zones: Map<string, ZoneMode> = zoneModes): NodeDisplay {
    const out: NodeDisplay = {};
    for (const [id, zone] of zones) out[id] = zone === "dots" ? "actual" : zone;
    return { ...out, ...nodeDisplay };
  }
  function setZoneMode(rootId: string, mode: ZoneMode | null) {
    const next = { ...zoneDisplay };
    if (mode) next[rootId] = mode;
    else delete next[rootId];
    storeZoneDisplay(next);
    const group = nodeGroups.find((g) => g.rootId === rootId);
    if (mode && mode !== "actual" && mode !== "dots") {
      fitZoomForDisplay(
        effectiveDisplay(zoneModeByNode(nodeGroups, next)),
        readingMode,
        group ? { x: group.cx, y: group.cy } : undefined,
      );
    }
  }
  return { zoneModes, modeOf, dottedByZone, effectiveDisplay, setZoneMode };
}
