import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import * as mapsApi from "../api/maps";
import { ApiRequestError } from "../api/client";
import { areaCountOf, canExtend, canRemoveLastArea, clampArea, nodesPerArea, setShownArea } from "../utils/mapAreas";
import type { MapDoc, NodeDoc } from "../types";

const STORAGE_PREFIX = "mc.mapArea.";

function loadArea(mapId: string | undefined): number {
  if (!mapId) return 0;
  try {
    const v = Number(localStorage.getItem(STORAGE_PREFIX + mapId));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

function saveArea(mapId: string, area: number) {
  try {
    if (area === 0) localStorage.removeItem(STORAGE_PREFIX + mapId);
    else localStorage.setItem(STORAGE_PREFIX + mapId, String(area));
  } catch {
    // Private mode or blocked storage: the map just opens on the main area.
  }
}

interface Params {
  mapId: string | undefined;
  map: MapDoc | null;
  setMap: Dispatch<SetStateAction<MapDoc | null>>;
  nodes: NodeDoc[];
  setActionError: (message: string | null) => void;
  errorMessage: string;
  /** Called after the area on screen changed (to clear what was picked and frame the new one). */
  onSwitched?: (area: number) => void;
  /** Called once a new area is added (to bring up the minimap, where the areas are switched). */
  onExtended?: () => void;
}

// Which of the map's areas is on screen, and adding / giving back an area —
// see utils/mapAreas.ts and docs/gestures/map-areas.md. The area shown is
// remembered per map in this browser.
export function useMapAreas({ mapId, map, setMap, nodes, setActionError, errorMessage, onSwitched, onExtended }: Params) {
  const count = areaCountOf(map);
  const [stored, setStored] = useState<number>(() => loadArea(mapId));
  useEffect(() => setStored(loadArea(mapId)), [mapId]);
  const area = clampArea(stored, count);
  const [busy, setBusy] = useState(false);

  // So every createNode without an area of its own lands on the area shown.
  // Set during render as well as in the effect: a node made right after a
  // switch must already go to the new area.
  if (mapId) setShownArea(mapId, area);
  useEffect(() => {
    if (!mapId) return;
    setShownArea(mapId, area);
    return () => setShownArea(mapId, null);
  }, [mapId, area]);

  const perArea = useMemo(() => nodesPerArea(nodes, count), [nodes, count]);

  function switchArea(next: number, opts: { frame?: boolean } = {}) {
    if (!mapId) return;
    const to = clampArea(next, count);
    if (to === area) return;
    setShownArea(mapId, to);
    saveArea(mapId, to);
    setStored(to);
    if (opts.frame !== false) onSwitched?.(to);
  }

  async function saveCount(nextCount: number): Promise<boolean> {
    if (!mapId || busy) return false;
    const before = count;
    setBusy(true);
    setActionError(null);
    setMap((prev) => (prev ? { ...prev, areaCount: nextCount } : prev));
    try {
      setMap(await mapsApi.updateMap(mapId, { areaCount: nextCount }));
      return true;
    } catch (err) {
      setMap((prev) => (prev ? { ...prev, areaCount: before } : prev));
      setActionError(err instanceof ApiRequestError ? err.message : errorMessage);
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Adds an empty area and shows it; true once it's there. */
  async function extend(): Promise<boolean> {
    if (!canExtend(count)) return false;
    const added = count;
    if (!(await saveCount(count + 1)) || !mapId) return false;
    setShownArea(mapId, added);
    saveArea(mapId, added);
    setStored(added);
    onExtended?.();
    onSwitched?.(added);
    return true;
  }

  /** Gives back the last area, when it is an empty extra one. */
  async function removeLast() {
    if (!canRemoveLastArea(nodes, count)) return;
    if (area === count - 1) switchArea(count - 2);
    await saveCount(count - 1);
  }

  return {
    area,
    count,
    perArea,
    busy,
    switchArea,
    extend,
    removeLast,
    canExtend: canExtend(count),
    canRemoveLast: canRemoveLastArea(nodes, count),
  };
}
