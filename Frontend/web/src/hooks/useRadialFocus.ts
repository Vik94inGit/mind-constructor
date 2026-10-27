import { useMemo } from "react";
import { computeRadialPositions, RADIAL_MAX_NEIGHBORS } from "../utils/nodePositions";
import { computeLinkedNeighborIds } from "../utils/canvasLayout";
import { useRadialBlend } from "./useRadialBlend";
import type { EdgeDoc, NodeDoc } from "../types";

interface Params {
  selectedId: string | null;
  multiSelectIds: Set<string>;
  /** The camera has landed on the selected node (useCanvasViewport). */
  selectionSettled: boolean;
  /** The selected node is the viewer's own, with its ghost ring on offer. */
  ghostsOnOffer: boolean;
  nodes: NodeDoc[];
  edges: EdgeDoc[];
  positions: Map<string, { x: number; y: number }>;
  settledViewportBounds: () => Parameters<typeof computeRadialPositions>[2];
}

// Radial focus layout: while exactly one node is selected (not a group
// selection — see multiSelectIds), its directly-connected neighbors
// (parentId children, its own parentId parent, and any Edge-linked nodes
// either direction) visually arrange in a circle around it, so the
// selected node's own neighborhood reads as a deliberate ring instead of
// wherever they happened to be scattered across the canvas. Purely a
// display override consulted by MapPage's posFor (never by the base
// `positions` memo, or by anything — like nodeGroups' own zone
// outlines — that reads `positions` directly instead of going through
// posFor) — nothing here ever calls nodesApi.updateNode, so it reverts
// instantly the moment selection changes; every member's real, stored
// x/y is untouched. Capped at RADIAL_MAX_NEIGHBORS so a heavily-connected
// hub node doesn't produce an unreadable, overlapping ring — anything
// past the cap just keeps its stored position. Waits on selectionSettled
// too, same reasoning as quickAddActive — neighbors shouldn't jump into
// their ring while the camera's still panning toward the chosen node.
export function useRadialFocus({
  selectedId,
  multiSelectIds,
  selectionSettled,
  ghostsOnOffer,
  nodes,
  edges,
  positions,
  settledViewportBounds,
}: Params) {
  const radialPositions = useMemo(() => {
    if (multiSelectIds.size > 1 || !selectedId || !selectionSettled) return null;
    // Both rings are centered on the selected node, and the neighbor ring
    // gets squeezed by the viewport (a phone's narrow width, the bottom panel's
    // reserved height) until it lands on the ghost ring — a neighbor's icon or
    // caption ends up right under a ghost. While ghosts are on offer for an
    // own node they win: neighbors stay put at their stored positions, dimmed,
    // rather than jumping into a ring that crowds them. Not keyed off dragState
    // (unlike quickAddActive) so grabbing a node doesn't snap its neighbors
    // into a ring mid-gesture.
    if (ghostsOnOffer) return null;
    const center = positions.get(selectedId);
    const selected = nodes.find((n) => n.nodeId === selectedId);
    if (!center || !selected) return null;

    const neighborIds = computeLinkedNeighborIds(selectedId, nodes, edges);
    if (neighborIds.size === 0) return null;

    const neighbors = Array.from(neighborIds).slice(0, RADIAL_MAX_NEIGHBORS);
    return computeRadialPositions(center, neighbors, settledViewportBounds());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, multiSelectIds, nodes, edges, positions, selectionSettled, ghostsOnOffer]);

  // Neighbors glide into (and back out of) the ring rather than jumping.
  return useRadialBlend(radialPositions);
}
