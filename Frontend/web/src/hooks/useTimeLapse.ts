import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import * as mapsApi from "../api/maps";
import type { MapAttack, NodeDoc } from "../types";

type Pt = { x: number; y: number };

export interface TimeLapse {
  step: number;
  playing: boolean;
}

interface Params {
  mapId: string | undefined;
  /** MapPage's own state: how many nodes, oldest first, are shown, and whether it's playing. */
  timeLapse: TimeLapse | null;
  setTimeLapse: Dispatch<SetStateAction<TimeLapse | null>>;
  /** The map's nodes in the order they were made (TimeLapseBar's timeLapseOrder). */
  timeLapseNodes: NodeDoc[];
  timeLapseStep: number | null;
  /** In a discussion the replay also shows the fight. */
  discussionOn: boolean;
  setReplayAttacks: Dispatch<SetStateAction<MapAttack[]>>;
  positions: Map<string, Pt>;
  zoom: number;
  zoomFromCenter: (delta: number, absolute?: number) => void;
  centerOnPoint: (x: number, y: number, opts?: { aboveSheet?: boolean }) => void;
  showPoints: (pts: Pt[], opts?: { aboveSheet?: boolean }) => void;
  /** Clears the view of anything open before the replay starts. */
  onStart: () => void;
}

// Replays the map from its first node (see TimeLapseBar). The view is
// cleared of any selection first; nothing on the map changes.
export function useTimeLapse({
  mapId,
  timeLapse,
  setTimeLapse,
  timeLapseNodes,
  timeLapseStep,
  discussionOn,
  setReplayAttacks,
  positions,
  zoom,
  zoomFromCenter,
  centerOnPoint,
  showPoints,
  onStart,
}: Params) {
  const onTimeLapseStep = useCallback(
    (step: number) => setTimeLapse((cur) => (cur ? { ...cur, step } : cur)),
    [setTimeLapse],
  );
  function startTimeLapse() {
    onStart();
    setTimeLapse({ step: 0, playing: true });
    // In a discussion the replay also shows the fight: who was hit, and when.
    setReplayAttacks([]);
    if (mapId && discussionOn) {
      mapsApi
        .listMapAttacks(mapId)
        .then(setReplayAttacks)
        .catch(() => setReplayAttacks([]));
    }
    // Close enough to read: the camera then follows each node as it appears.
    if (Math.abs(zoom - 1) > 0.005) zoomFromCenter(0, 1);
  }
  // Play at the end starts over from the first node.
  function togglePlay() {
    setTimeLapse((cur) => {
      if (!cur) return cur;
      const atEnd = cur.step >= timeLapseNodes.length;
      return atEnd ? { step: 0, playing: true } : { ...cur, playing: !cur.playing };
    });
  }
  // The arrows step it one node at a time, and pause it.
  function stepTimeLapse(dir: -1 | 1) {
    if (!timeLapse) return;
    setTimeLapse({ playing: false, step: Math.max(0, Math.min(timeLapseNodes.length, timeLapse.step + dir)) });
  }

  // The camera follows the replay: it glides to each node as it appears, so
  // nobody has to hunt for what changed, and keeps it above the node's info
  // (TimeLapseBar). At the last node it pulls back to show the whole
  // finished map, still above the last node's info.
  const timeLapseFollowRef = useRef(-1);
  useEffect(() => {
    if (timeLapseStep === null) {
      timeLapseFollowRef.current = -1;
      return;
    }
    if (timeLapseStep === timeLapseFollowRef.current) return;
    timeLapseFollowRef.current = timeLapseStep;
    if (timeLapseStep >= timeLapseNodes.length && timeLapseNodes.length > 0) {
      showPoints(
        timeLapseNodes.map((n) => positions.get(n.nodeId)).filter((pt): pt is Pt => !!pt),
        { aboveSheet: true },
      );
      return;
    }
    const newest = timeLapseNodes[timeLapseStep - 1];
    const at = newest ? positions.get(newest.nodeId) : undefined;
    if (at) centerOnPoint(at.x, at.y, { aboveSheet: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLapseStep]);

  return { startTimeLapse, onTimeLapseStep, togglePlay, stepTimeLapse };
}
