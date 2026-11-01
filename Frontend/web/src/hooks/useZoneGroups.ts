import { useEffect, useMemo, useRef } from "react";
import { computeNodeGroups } from "../utils/canvasLayout";
import type { NodeGroup } from "../utils/canvasLayout";
import type { ZoneLayouts } from "../utils/zoneLayout";
import { holdsOf } from "../utils/siege";
import { zoneLabel } from "../utils/mapGraph";
import type { Sentiment } from "../utils/nodeType";
import type { NodeDoc } from "../types";

interface Options {
  visibleNodes: NodeDoc[];
  nodes: NodeDoc[];
  positions: Map<string, { x: number; y: number }>;
  zoneLayouts: ZoneLayouts;
  /** The chosen circle's parent (Map.selectedCircle.rootId): the view centers on it once chosen. */
  selectedCircleRootId: string | undefined;
  centerOnPoint: (x: number, y: number) => void;
}

/**
 * The map's zones ("circles"): every node with 2+ children and its members,
 * outlined and colored by majority vote (computeNodeGroups in
 * utils/canvasLayout.ts), plus what the canvas reads off them.
 */
export function useZoneGroups({ visibleNodes, nodes, positions, zoneLayouts, selectedCircleRootId, centerOnPoint }: Options) {
  // Each zone's corner order from last time, so moving one node moves only its own corner.
  const zoneCornerOrder = useRef(new Map<string, string[]>());
  // Keyed off visibleNodes and positions only, though the roots resolve against `nodes`.
  const nodeGroups: NodeGroup[] = useMemo(
    () => computeNodeGroups(visibleNodes, nodes, positions, undefined, zoneLayouts, zoneCornerOrder.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleNodes, positions, zoneLayouts],
  );

  // Discussion mode reads the zones as a realm: the kingdom and its castles
  // (utils/siege.ts), named like the zone list names them.
  const holds = useMemo(
    () =>
      holdsOf(
        nodeGroups.map((g) => g.rootId),
        nodes,
      ).map((h) => ({ ...h, name: zoneLabel(nodes.find((n) => n.nodeId === h.rootId)) ?? "" })),
    [nodeGroups, nodes],
  );

  // Every member's zone sentiment (NodeCard's drift and outline), and each
  // zone parent's (its crown badge).
  const groupSentimentByNode = useMemo(() => {
    const map = new Map<string, Sentiment>();
    for (const g of nodeGroups) for (const m of g.members) map.set(m.nodeId, g.sentiment);
    return map;
  }, [nodeGroups]);
  const circleRootSentimentByNode = useMemo(() => {
    const map = new Map<string, Sentiment>();
    for (const g of nodeGroups) map.set(g.rootId, g.sentiment);
    return map;
  }, [nodeGroups]);

  // A circle just chosen is brought to the middle of the screen. Keyed off
  // the root id only: every socket echo brings a fresh selectedCircle object,
  // and re-panning on each would fight someone who has scrolled away.
  useEffect(() => {
    if (!selectedCircleRootId) return;
    const group = nodeGroups.find((g) => g.rootId === selectedCircleRootId);
    if (group) centerOnPoint(group.cx, group.cy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCircleRootId]);

  return { nodeGroups, holds, groupSentimentByNode, circleRootSentimentByNode };
}
