import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useNodeEntrance } from "./useNodeEntrance";
import { currentView, loadRememberedView, rememberView, VIEW_PROMPT_MIN_NODES } from "../utils/viewPrompt";
import type { MapView } from "../utils/viewPrompt";
import type { ReadingMode } from "../utils/readingMode";
import type { NodeDoc } from "../types";

interface Params {
  mapId: string | undefined;
  loading: boolean;
  visibleNodes: NodeDoc[];
  /** How many nodes the map has outside containers: a map with none has nothing to settle. */
  unpackedCount: number;
  zoneRootIds: string[];
  canvasRef: RefObject<HTMLElement | null>;
  readingMode: ReadingMode;
  overviewOn: boolean;
  setOverview: (on: boolean) => void;
  setReadingMode: (mode: ReadingMode) => void;
}

// How a map opens, and the view it settles into.
//
// The map's entrance (see hooks/useNodeEntrance.ts): the first time a map
// opens in this browser, its nodes appear in the order they were made, then
// the zones are drawn round them, all within a couple of seconds and
// straight onto the canvas DOM (posFor never sees it); `skipEntrance` is
// wired to any pointer-down or wheel on the canvas. Every map opens this way
// once, Personal and Discussion alike; the camera stays on the opening
// framing, and the full node-by-node story is the time-lapse's to tell.
//
// Once a map has built itself up, it takes the view the viewer chose
// (utils/viewPrompt.ts): the whole map, an overview with each parent
// packed, or the cards. Until they've chosen one, a map with something to
// glance over asks them, once; the answer is kept from then on.
export function useMapEntrance({
  mapId,
  loading,
  visibleNodes,
  unpackedCount,
  zoneRootIds,
  canvasRef,
  readingMode,
  overviewOn,
  setOverview,
  setReadingMode,
}: Params) {
  const entrance = useNodeEntrance({ mapId, visibleNodes, zoneRootIds, canvasRef });

  const view = currentView(readingMode, overviewOn);
  const [viewPromptOpen, setViewPromptOpen] = useState(false);
  const settledMap = useRef<string | null>(null);
  useEffect(() => {
    if (loading || entrance.active || !mapId || settledMap.current === mapId || unpackedCount === 0) return;
    // A beat later, so an entrance that's only starting doesn't count as over.
    const timer = setTimeout(() => {
      settledMap.current = mapId;
      const remembered = loadRememberedView();
      if (remembered === null) {
        if (visibleNodes.length >= VIEW_PROMPT_MIN_NODES) setViewPromptOpen(true);
      } else if (remembered !== currentView(readingMode, overviewOn)) {
        showView(remembered);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the map settling matters
  }, [loading, entrance.active, mapId, unpackedCount]);
  // Closing the prompt without choosing keeps the view as it is, as the answer.
  const closeViewPrompt = useCallback(() => {
    setViewPromptOpen(false);
    rememberView(currentViewRef.current);
  }, []);
  const currentViewRef = useRef<MapView>("map");
  currentViewRef.current = view;
  function chooseView(next: MapView) {
    setViewPromptOpen(false);
    rememberView(next);
    showView(next);
  }
  function showView(next: MapView) {
    if (next === "cards") {
      setOverview(false);
      setReadingMode("puzzle");
      return;
    }
    if (readingMode === "puzzle") setReadingMode("mixed");
    setOverview(next === "overview");
  }

  return {
    entranceActive: entrance.active,
    skipEntrance: entrance.skip,
    view,
    viewPromptOpen,
    chooseView,
    closeViewPrompt,
  };
}
