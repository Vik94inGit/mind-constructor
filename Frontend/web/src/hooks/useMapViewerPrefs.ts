import { useState } from "react";
import { loadNodeDisplay } from "../utils/nodeDisplay";
import type { NodeDisplay } from "../utils/nodeDisplay";
import { loadZoneDisplay, saveZoneDisplay } from "../utils/zoneDisplay";
import type { ZoneDisplay } from "../utils/zoneDisplay";
import { loadBlockLocks, saveBlockLocks } from "../utils/blockLock";
import type { BlockLocks } from "../utils/blockLock";
import { loadCardFills, saveCardFills } from "../utils/cardFill";
import type { CardFills } from "../utils/cardFill";
import { loadCompactView, loadReadingMode, saveCompactView, saveReadingMode } from "../utils/readingMode";
import type { ReadingMode } from "../utils/readingMode";

// How this viewer looks at the map — every one of these is remembered in this
// browser only (per map where it says so), never shared with the map's other
// members. Each setter writes through to storage as it updates state.
export function useMapViewerPrefs(mapId: string | undefined) {
  // How this viewer reads the map (see utils/readingMode.ts).
  const [readingMode, setReadingModeState] = useState<ReadingMode>(loadReadingMode);
  function storeReadingMode(mode: ReadingMode) {
    setReadingModeState(mode);
    saveReadingMode(mode);
  }
  // The simplified view (smaller icons, no halo/horns/rings) — on by default on a phone.
  const [compactView, setCompactViewState] = useState<boolean>(loadCompactView);
  function toggleCompactView() {
    setCompactViewState((v) => {
      saveCompactView(!v);
      return !v;
    });
  }
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
  // Text blocks their owner locked against moving and editing — see
  // utils/blockLock.ts.
  const [blockLocks, setBlockLocks] = useState<BlockLocks>(() => loadBlockLocks(mapId));
  // `ids` is every block that follows nodeId's new state (an assembled puzzle
  // locks and unlocks as one); defaults to just nodeId.
  function toggleBlockLock(nodeId: string, ids: string[] = [nodeId]) {
    setBlockLocks((prev) => {
      const lock = !prev[nodeId];
      const next = { ...prev };
      for (const id of ids) {
        if (lock) next[id] = true;
        else delete next[id];
      }
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
  };
}
