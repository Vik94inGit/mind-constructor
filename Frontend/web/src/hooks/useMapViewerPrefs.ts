import { useEffect, useRef, useState } from "react";
import * as stateApi from "../api/state";
import type { MapViewState } from "../api/state";
import { useUserState } from "../context/UserStateContext";
import { loadNodeDisplay, saveNodeDisplay } from "../utils/nodeDisplay";
import type { NodeDisplay } from "../utils/nodeDisplay";
import { loadZoneDisplay, saveZoneDisplay } from "../utils/zoneDisplay";
import type { ZoneDisplay } from "../utils/zoneDisplay";
import { loadZoneLayouts, parseZoneLayouts, saveZoneLayouts, withZoneLayout } from "../utils/zoneLayout";
import type { ZoneLayout, ZoneLayouts } from "../utils/zoneLayout";
import { loadBlockLocks, saveBlockLocks } from "../utils/blockLock";
import type { BlockLocks } from "../utils/blockLock";
import { loadCardFills, saveCardFills } from "../utils/cardFill";
import { loadDetachedPieces, saveDetachedPieces } from "../utils/pieceDetach";
import type { DetachedPieces } from "../utils/pieceDetach";
import type { CardFills } from "../utils/cardFill";
import { loadFeelings, parseCheckIn, parseFeelings, saveFeelings, withFeeling } from "../utils/feeling";
import type { CheckIn, Feeling, Feelings } from "../utils/feeling";
import { loadCompactView, loadReadingMode, saveCompactView, saveReadingMode } from "../utils/readingMode";
import type { ReadingMode } from "../utils/readingMode";
import { loadEmojiFirst, loadTypeEmoji, saveEmojiFirst, saveTypeEmoji } from "../utils/emojiFace";
import type { TypeEmoji } from "../utils/emojiFace";
import { clampNodeFade, loadNodeFade, saveNodeFade } from "../utils/nodeFade";
import type { NodeFade } from "../utils/nodeFade";
import type { NodeType } from "../types";

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
  // Symbols first (the default) or emoji first, and the viewer's own emoji
  // for each type — see utils/emojiFace.ts.
  const [emojiFirst, setEmojiFirstState] = useState<boolean>(loadEmojiFirst);
  function toggleEmojiFirst() {
    const next = !emojiFirst;
    setEmojiFirstState(next);
    saveEmojiFirst(next);
    savePreferences({ emojiUp: next });
  }
  const [typeEmoji, setTypeEmojiState] = useState<TypeEmoji>(loadTypeEmoji);
  function setTypeEmoji(type: NodeType, emoji: string | null) {
    const next: TypeEmoji = { ...typeEmoji };
    if (emoji) next[type] = emoji;
    else delete next[type];
    setTypeEmojiState(next);
    saveTypeEmoji(next);
    savePreferences({ typeEmoji: next });
  }
  // How strongly quiet nodes fade (utils/nodeFade.ts): follows the slider, and
  // is saved once it's let go (save).
  const [nodeFade, setNodeFadeState] = useState<NodeFade>(loadNodeFade);
  function setNodeFade(fade: number, save: boolean) {
    setNodeFadeState(fade);
    if (!save) return;
    saveNodeFade(fade);
    savePreferences({ nodeFade: fade });
  }
  // The signed-in user's saved choices, once they arrive.
  useEffect(() => {
    if (preferences?.readingMode) setReadingModeState(preferences.readingMode);
    if (preferences?.compactView !== undefined) setCompactViewState(preferences.compactView);
    if (preferences?.emojiUp !== undefined) setEmojiFirstState(preferences.emojiUp);
    if (preferences?.typeEmoji) setTypeEmojiState(preferences.typeEmoji);
    if (preferences?.nodeFade !== undefined) setNodeFadeState(clampNodeFade(preferences.nodeFade));
  }, [preferences?.readingMode, preferences?.compactView, preferences?.emojiUp, preferences?.typeEmoji, preferences?.nodeFade]);

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
  // How zones are drawn, for the whole map and per parent — see utils/zoneLayout.ts.
  const [zoneLayouts, setZoneLayouts] = useState<ZoneLayouts>(() => loadZoneLayouts(mapId));
  /** `id` is a parent's nodeId, or MAP_ZONE_KEY for the whole map; null goes back to following. */
  function setZoneLayout(id: string, layout: ZoneLayout | null) {
    setZoneLayouts((prev) => {
      const next = withZoneLayout(prev, id, layout);
      saveZoneLayouts(mapId, next);
      return next;
    });
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
  // Puzzle pieces taken out of their puzzle — see utils/pieceDetach.ts.
  const [detachedPieces, setDetachedPiecesState] = useState<DetachedPieces>(() => loadDetachedPieces(mapId));
  /** Takes these pieces out of their puzzle (detached: true) or lets them back in. */
  function setPiecesDetached(ids: string[], detached: boolean) {
    setDetachedPiecesState((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        if (detached) next[id] = true;
        else delete next[id];
      }
      saveDetachedPieces(mapId, next);
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

  // The viewer's own feeling per thought — see utils/feeling.ts.
  const [feelings, setFeelings] = useState<Feelings>(() => loadFeelings(mapId));
  function setFeeling(nodeId: string, feeling: Feeling | null) {
    setFeelings((prev) => {
      const next = withFeeling(prev, nodeId, feeling);
      saveFeelings(mapId, next);
      return next;
    });
  }
  // How they felt about the map before and after thinking it through — only
  // the server keeps it; undefined until it has answered.
  const [checkIn, setCheckInState] = useState<CheckIn | null | undefined>(undefined);
  function setCheckIn(next: CheckIn | null) {
    setCheckInState(next);
    saveView({ checkIn: next });
  }

  // ---- The server's copy of this map's view ----
  // Changes wait a moment and go out together.
  const pendingRef = useRef<MapViewState | null>(null);
  const timerRef = useRef<number | null>(null);
  const mapIdRef = useRef(mapId);
  mapIdRef.current = mapId;
  const loadedRef = useRef(false);
  // Exactly what was last taken from the server — not a change to send back.
  const fromServerRef = useRef<{
    nodeDisplay?: unknown;
    zoneDisplay?: unknown;
    zoneLayouts?: unknown;
    cardFills?: unknown;
    feelings?: unknown;
    blockLocks?: unknown;
    detachedPieces?: unknown;
  }>({});
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
    setCheckInState(undefined);
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
          const zl = parseZoneLayouts(view.zoneLayout);
          const cf = view.cardFills ?? {};
          const fe = parseFeelings(view.feelings);
          const bl: BlockLocks = Object.fromEntries((view.blockLocks ?? []).map((id) => [id, true as const]));
          const dp: DetachedPieces = Object.fromEntries((view.detachedPieces ?? []).map((id) => [id, true as const]));
          fromServerRef.current = { nodeDisplay: nd, zoneDisplay: zd, zoneLayouts: zl, cardFills: cf, feelings: fe, blockLocks: bl, detachedPieces: dp };
          setNodeDisplay(nd);
          saveNodeDisplay(mapId, nd);
          setZoneDisplay(zd);
          saveZoneDisplay(mapId, zd);
          setZoneLayouts(zl);
          saveZoneLayouts(mapId, zl);
          setCardFills(cf);
          saveCardFills(mapId, cf);
          setFeelings(fe);
          saveFeelings(mapId, fe);
          setCheckInState(parseCheckIn(view.checkIn));
          setBlockLocks(bl);
          saveBlockLocks(mapId, bl);
          setDetachedPiecesState(dp);
          saveDetachedPieces(mapId, dp);
          setSavedView({ center: view.center ?? null, selectedNodeId: view.selectedNodeId ?? null });
          // Opening it makes it the map they were last on.
          stateApi.saveMapViewState(mapId, {}).catch(() => {});
        } else {
          // First time on the server: what this device had goes up.
          stateApi
            .saveMapViewState(mapId, {
              nodeDisplay: loadNodeDisplay(mapId),
              zoneDisplay: loadZoneDisplay(mapId),
              zoneLayout: loadZoneLayouts(mapId),
              cardFills: loadCardFills(mapId),
              feelings: loadFeelings(mapId),
              blockLocks: Object.keys(loadBlockLocks(mapId)),
              detachedPieces: Object.keys(loadDetachedPieces(mapId)),
            })
            .catch(() => {});
          setSavedView({ center: null, selectedNodeId: null });
          setCheckInState(null);
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
  useEffect(() => sendIfChanged("zoneLayouts", zoneLayouts, { zoneLayout: zoneLayouts }), [zoneLayouts]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => sendIfChanged("cardFills", cardFills, { cardFills }), [cardFills]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => sendIfChanged("feelings", feelings, { feelings }), [feelings]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => sendIfChanged("blockLocks", blockLocks, { blockLocks: Object.keys(blockLocks) }), [blockLocks]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => sendIfChanged("detachedPieces", detachedPieces, { detachedPieces: Object.keys(detachedPieces) }),
    [detachedPieces], // eslint-disable-line react-hooks/exhaustive-deps
  );

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
    emojiFirst,
    toggleEmojiFirst,
    nodeFade,
    setNodeFade,
    typeEmoji,
    setTypeEmoji,
    nodeDisplay,
    setNodeDisplay,
    zoneDisplay,
    storeZoneDisplay,
    zoneLayouts,
    setZoneLayout,
    blockLocks,
    toggleBlockLock,
    cardFills,
    setCardFill,
    feelings,
    setFeeling,
    checkIn,
    setCheckIn,
    detachedPieces,
    setPiecesDetached,
    savedView,
    saveView,
  };
}
