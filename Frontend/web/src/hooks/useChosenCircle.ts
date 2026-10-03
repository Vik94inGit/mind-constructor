import { useState } from "react";
import * as mapsApi from "../api/maps";
import { ApiRequestError } from "../api/client";
import type { Translation } from "../i18n/translations";
import type { MapDoc, SelectedCircle } from "../types";

interface Params {
  mapId: string | undefined;
  map: MapDoc | null;
  applyCircleSelection: (selectedCircle: SelectedCircle | null) => void;
  setActionError: (message: string | null) => void;
  t: Translation;
}

// The one circle a map can have "held still" (Map.selectedCircle): choosing it
// from its zone, and releasing it again from the zone or by clicking anywhere
// outside it.
export function useChosenCircle({ mapId, map, applyCircleSelection, setActionError, t }: Params) {
  // The circle whose zone was just clicked, while it is still being chosen and
  // its members' titles/text are still on their way (two round trips: the
  // choice itself, then the text). Shows a spinner on the zone so the click
  // visibly registered instead of the canvas looking frozen.
  const [circleLoadingRootId, setCircleLoadingRootId] = useState<string | null>(null);

  // Shared by the backdrop's own toggle-off click and every "clicked
  // outside the chosen cluster" path below — one place actually talking to
  // the API, so both can't ever disagree about what releasing means.
  async function releaseChosenCircle() {
    if (!mapId) return;
    setActionError(null);
    try {
      await mapsApi.deselectCircle(mapId);
      applyCircleSelection(null);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.releaseCircle);
    }
  }

  // A click anywhere that isn't the chosen circle itself reads as "done
  // with it" — empty canvas, or any node that isn't one of its own members
  // (own members included on purpose: interacting with the cluster you
  // just chose shouldn't un-choose it). No-ops instantly if nothing's
  // chosen, so callers don't have to guard that themselves.
  function releaseChosenCircleIfOutside(clickedNodeId?: string) {
    const selected = map?.selectedCircle;
    if (!selected) return;
    if (clickedNodeId && selected.nodeIds.includes(clickedNodeId)) return;
    releaseChosenCircle();
  }

  // Stabilize/Release: clicking a circle's own backdrop on the canvas
  // chooses it as the one "held still" — every other circle stays free to
  // drift (see NodeCard's chaotic-drift rendering, keyed off Node.locked).
  // Clicking the *already-chosen* circle's backdrop again releases it
  // (toggle), rather than needing a separate control — same as clicking
  // anywhere outside it now does (see releaseChosenCircleIfOutside).
  async function handleCircleBackdropClick(rootId: string) {
    if (!mapId) return;
    if (map?.selectedCircle?.rootId === rootId) {
      await releaseChosenCircle();
      return;
    }
    setActionError(null);
    setCircleLoadingRootId(rootId);
    try {
      const selected = await mapsApi.selectCircle(mapId, rootId);
      applyCircleSelection(selected);
      // Normally the spinner is cleared once the members' text has loaded (see
      // the spotlightedNodeIds effect) — with no members there is nothing to wait for.
      if (!selected || selected.nodeIds.length === 0) setCircleLoadingRootId(null);
    } catch (err) {
      setCircleLoadingRootId(null);
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.updateCircle);
    }
  }

  return { circleLoadingRootId, setCircleLoadingRootId, releaseChosenCircleIfOutside, handleCircleBackdropClick };
}
