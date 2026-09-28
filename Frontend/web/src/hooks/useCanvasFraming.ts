import type { Dispatch, RefObject, SetStateAction } from "react";
import { MAX_ZOOM, MIN_ZOOM } from "../utils/canvasLayout";
import { nodeFootprint, saveNodeDisplay, zoomToSeparate } from "../utils/nodeDisplay";
import type { NodeDisplay } from "../utils/nodeDisplay";
import type { ReadingMode } from "../utils/readingMode";
import type { Sentiment } from "../utils/nodeType";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

interface Params {
  visibleNodes: NodeDoc[];
  positions: Map<string, Pt>;
  circleRootSentimentByNode: Map<string, Sentiment>;
  zoom: number;
  zoomFromCenter: (delta: number, to?: number) => void;
  centerOnPoint: (x: number, y: number) => void;
  wrapRef: RefObject<HTMLDivElement | null>;
  showNotice: (message: string) => void;
  mapId: string | undefined;
  multiSelectIds: Set<string>;
  nodeDisplay: NodeDisplay;
  setNodeDisplay: Dispatch<SetStateAction<NodeDisplay>>;
  readingMode: ReadingMode;
  stillOverlapNotice: string;
  zoomedToFitNotice: string;
}

// Every "bring this into view" camera cue on the canvas — zooming to fit a
// text-heavy reading mode, the floor-at-100%-for-editing after a drag
// settles, and bringing an arbitrary set of points/nodes on screen — shares
// the same viewport primitives (zoom, zoomFromCenter, centerOnPoint), so
// they're grouped here rather than scattered through MapPage.
export function useCanvasFraming({
  visibleNodes,
  positions,
  circleRootSentimentByNode,
  zoom,
  zoomFromCenter,
  centerOnPoint,
  wrapRef,
  showNotice,
  mapId,
  multiSelectIds,
  nodeDisplay,
  setNodeDisplay,
  readingMode,
  stillOverlapNotice,
  zoomedToFitNotice,
}: Params) {
  // A node's own drawn footprint (icon or text box, depending on reading
  // mode) takes real room, and can overlap a neighbor's at the current
  // spacing — a node draws at a constant size on screen whatever the zoom
  // is, so zooming in spreads the positions apart without changing
  // anything else. Only ever zooms in; nothing is moved. Weapon/protection
  // nodes are left out — a protection node actively defending an attack is
  // deliberately placed overlapping both its attacker's and its target's
  // own footprint (see nodePositions.ts's own doc comment on that), which
  // would otherwise read as permanent crowding needing a fix that isn't
  // one.
  function fitZoomForDisplay(display: NodeDisplay, globalMode: ReadingMode, centerOn?: Pt) {
    const items = visibleNodes.flatMap((n) => {
      if (n.isWeapon || n.isProtection) return [];
      const pos = positions.get(n.nodeId);
      if (!pos) return [];
      const mode = display[n.nodeId] ?? globalMode;
      const tier = circleRootSentimentByNode.has(n.nodeId) ? 3 : (n.sizeTier ?? 1);
      const multiplier = tier === 3 ? 1.3 : tier === 2 ? 1.15 : 1;
      return [{ x: pos.x, y: pos.y, ...nodeFootprint(n, mode, multiplier) }];
    });
    const needed = zoomToSeparate(items);
    if (needed <= zoom + 0.005) return;
    const target = Math.min(MAX_ZOOM, needed * 1.03);
    zoomFromCenter(0, target);
    showNotice(needed > MAX_ZOOM ? stillOverlapNotice : zoomedToFitNotice);
    // Zooming keeps the middle of the screen fixed; bring the nodes that just
    // changed back into it.
    if (centerOn) setTimeout(() => centerOnPoint(centerOn.x, centerOn.y), 250);
  }

  // After a drag settles, jumps the zoom to 100% if it was below that —
  // editing a node's text/type reads and hit-targets best at its native
  // size, and a zoomed-out map is exactly where a drag is most likely to
  // have happened (more of the canvas fits on screen). Deliberately only
  // ever zooms *in* to exactly 1, never out and never past 1 if already
  // zoomed in further — this is a floor for "about to edit," not a reset.
  // Runs after the drop, not before: zooming mid-drag would fight the
  // gesture by moving the canvas under the pointer while it's still down.
  function zoomToEditAt(x: number, y: number) {
    if (zoom >= 1) return;
    zoomFromCenter(0, 1);
    setTimeout(() => centerOnPoint(x, y), 250);
  }

  // Brings an arbitrary set of canvas points into view: zooms out just
  // enough for all of them to fit on screen (never in), then glides to their
  // middle. Shared core of showNodes (below) and the majority-swap hook's
  // own camera cue — the latter passes both a unit's start *and* end point
  // so the whole glide stays on-screen, not just wherever it happens to end
  // up.
  function showPoints(pts: Pt[]) {
    const wrap = wrapRef.current;
    if (!wrap || pts.length === 0) return;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const PAD = 140;
    const width = Math.max(...xs) - Math.min(...xs) + PAD * 2;
    const height = Math.max(...ys) - Math.min(...ys) + PAD * 2;
    const middle = { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 };
    const target = Math.max(MIN_ZOOM, Math.min(zoom, wrap.clientWidth / width, wrap.clientHeight / height));
    if (target < zoom - 0.005) {
      zoomFromCenter(0, target);
      setTimeout(() => centerOnPoint(middle.x, middle.y), 260);
    } else {
      centerOnPoint(middle.x, middle.y);
    }
  }

  // After an action on chosen nodes finishes, brings them into view: zooms out
  // just enough for all of them to fit on screen (never in), then glides to
  // their middle.
  function showNodes(ids: string[]) {
    showPoints(ids.map((id) => positions.get(id)).filter((p): p is Pt => !!p));
  }

  // The group bar's "Show as": the chosen nodes take this reading mode (null =
  // back to following the map's), then the view zooms in if they'd overlap.
  function setDisplayForChosen(mode: ReadingMode | null) {
    const ids = Array.from(multiSelectIds);
    if (ids.length === 0) return;
    const next: NodeDisplay = { ...nodeDisplay };
    for (const id of ids) {
      if (mode === null) delete next[id];
      else next[id] = mode;
    }
    setNodeDisplay(next);
    saveNodeDisplay(mapId, next);
    const chosen = ids.map((id) => positions.get(id)).filter((p): p is Pt => !!p);
    const middle = chosen.length
      ? { x: chosen.reduce((sum, p) => sum + p.x, 0) / chosen.length, y: chosen.reduce((sum, p) => sum + p.y, 0) / chosen.length }
      : undefined;
    fitZoomForDisplay(next, readingMode, middle);
  }

  return { fitZoomForDisplay, zoomToEditAt, showPoints, showNodes, setDisplayForChosen };
}
