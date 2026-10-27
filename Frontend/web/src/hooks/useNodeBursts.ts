import { useEffect, useRef, useState } from "react";
import { nodeRefId, sentimentOf } from "../utils/nodeType";
import { BURST_MS } from "../map/NodeBurst";
import type { NodeDoc } from "../types";

export interface Burst {
  id: string;
  x: number;
  y: number;
  boom: boolean;
}

// A node that leaves the map (deleted here, by someone else, or in a batch)
// pops where it stood — a boom for a negative one (map/NodeBurst.tsx).
// Found by comparing the node list with the last one, so every way of
// deleting gets it; a wholesale swap (another map, a reload) doesn't.
export function useNodeBursts(
  mapId: string | undefined,
  nodes: NodeDoc[],
  positions: Map<string, { x: number; y: number }>,
): Burst[] {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const lastNodesRef = useRef<{ mapId: string | undefined; nodes: NodeDoc[]; positions: Map<string, { x: number; y: number }> }>({
    mapId,
    nodes: [],
    positions: new Map(),
  });
  useEffect(() => {
    const last = lastNodesRef.current;
    lastNodesRef.current = { mapId, nodes, positions };
    if (last.mapId !== mapId || last.nodes.length === 0) return;
    const now = new Set(nodes.map((n) => n.nodeId));
    const gone = last.nodes.filter((n) => !now.has(n.nodeId) && !nodeRefId(n.packedIntoNodeId));
    if (gone.length === 0 || gone.length > 25 || gone.length === last.nodes.length) return;
    const fresh = gone.flatMap((n) => {
      const at = last.positions.get(n.nodeId);
      return at ? [{ id: `${n.nodeId}-${Date.now()}`, x: at.x, y: at.y, boom: sentimentOf(n.type) === "negative" }] : [];
    });
    if (fresh.length === 0) return;
    setBursts((prev) => [...prev, ...fresh]);
    const ids = new Set(fresh.map((b) => b.id));
    setTimeout(() => setBursts((prev) => prev.filter((b) => !ids.has(b.id))), BURST_MS);
    // positions is read as of the same render; only a change of nodes matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, mapId]);
  return bursts;
}
