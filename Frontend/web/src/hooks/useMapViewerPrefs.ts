import { useEffect, useRef, useState } from "react";
import * as stateApi from "../api/state";
import type { MapViewState } from "../api/state";
import { useUserState } from "../context/UserStateContext";
import { loadNodeDisplay, saveNodeDisplay } from "../utils/nodeDisplay";
import type { NodeDisplay } from "../utils/nodeDisplay";
import { loadZoneDisplay, saveZoneDisplay } from "../utils/zoneDisplay";
import type { ZoneDisplay } from "../utils/zoneDisplay";
import { loadBlockLocks, saveBlockLocks } from "../utils/blockLock";
import type { BlockLocks } from "../utils/blockLock";
import { loadCardFills, saveCardFills } from "../utils/cardFill";
import type { CardFills } from "../utils/cardFill";
import { loadCompactView, loadReadingMode, saveCompactView, saveReadingMode } from "../utils/readingMode";
import type { ReadingMode } from "../utils/readingMode";

const SAVE_DELAY_MS = 800;

// How this viewer looks at the map — never shared with the map's other
// members, but kept on the server for them (see api/state.ts) so it follows
// them to every device: the reading mode and simplified view everywhere, and
// per map the node / zone views, card fills, locked pieces and where they
// were on it. This browser's own copy loads first; the server's copy, once
// it arrives, wins; every change goes back to both.
export function useMapViewerPrefs(mapId: string | undefined, enabled = true) {
  const { preferences, savePreferences, noteMapOpened } = useUserState();

  // How this viewer reads the map (see utils/readingMode.ts).
  const [readingMode, setReadingModeState] = useState<ReadingMode>(loadReadingMode);
  function storeReadingMode(mode: ReadingMode) {
    setReadingModeState(mode);
    saveReadingMode(mode);
    savePreferences({ readingMode: mode });
  }
  // The simplified view (smaller icons, no halo/horns/rings) — on by default on a phone.
  const [compactView, setCompactViewState] = useState<boolean>(loadCompactView);
  function toggleCompactView() {
    const next = !compactView;
    setCompactViewState(next);
    saveCompactView(next);
    savePreferences({ compactView: next });
  }
  // The signed-in user's saved choices, once they arrive.
  useEffect(() => {
    if (preferences?.readingMode) setReadingModeState(preferences.readingMode);
    if (preferences?.compactView !== undefined) setCompactViewState(preferences.compactView);
  }, [preferences?.readingMode, preferences?.compactView]);

  // Nodes shown in their own reading mode instead of the map's (a chosen group
  // as puzzle cards, say) — per map, see utils/nodeDisplay.ts.
  const [nodeDisplay, setNodeDisplay] = useState<NodeDisplay>(() => loadNodeDisplay(mapId));
  // Each zone's own view, so one canvas shows several sides of the map at
  // once — see utils/zoneDisplay.ts. Below a node's own display (the group
  // bar's "Show as"), above the map-wide reading mode.
  const [zoneDisplay, setZoneDisplay] = useState<ZoneDisplay>(() => loadZoneDisplay(mapId));
  function storeZoneDisplay(next: ZoneDisplay) {
    setZoneDisplay(next);
    saveZoneDisplay(mapId, next);
  }
  // Puzzle pieces locked against moving and editing — see utils/blockLock.ts.
  const [blockLocks, setBlockLocks] = useState<BlockLocks>(() => loadBlockLocks(mapId));
  function toggleBlockLock(nodeId: string) {
    setBlockLocks((prev) => {
      const next = { ...prev };
      if (next[nodeId]) delete next[nodeId];
      else next[nodeId] = true;
      saveBlockLocks(mapId, next);
      return next;
    });
  }
  // The viewer's own fill per puzzle piece — see utils/cardFill.ts.
  const [cardFills, setCardFills] = useState<CardFills>(() => loadCardFills(mapId));
  function setCardFill(nodeId: string, color: string | null) {
    setCardFills((prev) => {
      const next = { ...prev };
      if (color) next[nodeId] = color;
      else delete next[nodeId];
      saveCardFills(mapId, next);
      return next;
    });
  }

  // ---- The server's copy of this map's view ----
  // Changes wait a moment and go out together.
  const pendingRef = useRef<MapViewState | null>(null);
  const timerRef = useRef<number | null>(null);
  const mapIdRef = useRef(mapId);
  mapIdRef.current = mapId;
  const loadedRef = useRef(false);
  // Exactly what was last taken from the server — not a change to send back.
  const fromServerRef = useRef<{ nodeDisplay?: unknown; zoneDisplay?: unknown; cardFills?: unknown; blockLocks?: unknown }>({});
  // Where the viewer was on this map last time (any device), for MapPage to go back to.
  const [savedView, setSavedView] = useState<{ center: { x: number; y: number } | null; selectedNodeId: string | null } | null>(null);

  function flush() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    const fields = pendingRef.current;
    const id = mapIdRef.current;
    pendingRef.current = null;
    if (fields && id) stateApi.saveMapViewState(id, fields).catch(() => {});
  }
  /** Sends these fields of the view (merged with any still waiting) shortly. */
  function saveView(fields: MapViewState) {
    if (!enabled || !mapIdRef.current) return;
    pendingRef.current = { ...(pendingRef.current ?? {}), ...fields };
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(flush, SAVE_DELAY_MS);
  }

  useEffect(() => {
    loadedRef.current = false;
    setSavedView(null);
    if (!enabled || !mapId) return;
    noteMapOpened(mapId);
    let cancelled = false;
    stateApi
      .getMapViewState(mapId)
      .then((view) => {
        if (cancelled) return;
        if (view) {
          const nd = view.nodeDisplay ?? {};
          const zd = view.zoneDisplay ?? {};
          const cf = view.cardFills ?? {};
          const bl: BlockLocks = Object.fromEntries((view.blockLocks ?? []).map((id) => [id, true as const]));
          fromServerRef.current = { nodeDisplay: nd, zoneDisplay: zd, cardFills: cf, blockLocks: bl };
          setNodeDisplay(nd);
          saveNodeDisplay(mapId, nd);
          setZoneDisplay(zd);
          saveZoneDisplay(mapId, zd);
          setCardFills(cf);
          saveCardFills(mapId, cf);
          setBlockLocks(bl);
          saveBlockLocks(mapId, bl);
          setSavedView({ center: view.center ?? null, selectedNodeId: view.selectedNodeId ?? null });
          // Opening it makes it the map they were last on.
          stateApi.saveMapViewState(mapId, {}).catch(() => {});
        } else {
          // First time on the server: what this device had goes up.
          stateApi
            .saveMapViewState(mapId, {
              nodeDisplay: loadNodeDisplay(mapId),
              zoneDisplay: loadZoneDisplay(mapId),
              cardFills: loadCardFills(mapId),
              blockLocks: Object.keys(loadBlockLocks(mapId)),
            })
            .catch(() => {});
          setSavedView({ center: null, selectedNodeId: null });
        }
      })
      .catch(() => {
        if (!cancelled) setSavedView({ center: null, selectedNodeId: null });
      })
      .finally(() => {
        if (!cancelled) loadedRef.current = true;
      });
    return () => {
      cancelled = true;
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, enabled]);

  // Each change goes to the server — unless it's the server's own copy arriving.
  const sendIfChanged = (key: keyof typeof fromServerRef.current, value: unknown, fields: MapViewState) => {
    if (!loadedRef.current || fromServerRef.current[key] === value) return;
    saveView(fields);
  };
  useEffect(() => sendIfChanged("nodeDisplay", nodeDisplay, { nodeDisplay }), [nodeDisplay]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => sendIfChanged("zoneDisplay", zoneDisplay, { zoneDisplay }), [zoneDisplay]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => sendIfChanged("cardFills", cardFills, { cardFills }), [cardFills]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => sendIfChanged("blockLocks", blockLocks, { blockLocks: Object.keys(blockLocks) }), [blockLocks]); // eslint-disable-line react-hooks/exhaustive-deps

  // The app going to the background (or closing) sends what's waiting.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    readingMode,
    storeReadingMode,
    compactView,
    toggleCompactView,
    nodeDisplay,
    setNodeDisplay,
    zoneDisplay,
    storeZoneDisplay,
    blockLocks,
    toggleBlockLock,
    cardFills,
    setCardFill,
    savedView,
    saveView,
  };
}
