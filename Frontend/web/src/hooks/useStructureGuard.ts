import { useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import { computeBasePositions } from "../utils/nodePositions";
import { planStructureMoves } from "../utils/structureLayout";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

interface Params {
  nodes: NodeDoc[];
  setNodes: Dispatch<SetStateAction<NodeDoc[]>>;
  upsertNode: (node: NodeDoc) => void;
  /** Whether this viewer may move `node` (their own, not held in place). */
  canMoveNode: (node: NodeDoc) => boolean;
  setActionError: (message: string | null) => void;
  moveError: string;
}

// After something lands on the canvas (a new node, a grown template, a drop),
// pushes the nodes and zones it now covers out of its way and saves where
// they went — see utils/structureLayout.ts. The thing just placed never moves.
export function useStructureGuard({ nodes, setNodes, upsertNode, canMoveNode, setActionError, moveError }: Params) {
  // Read at call time: callers run this right after an await, when the
  // render that captured `nodes` is already stale.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  /**
   * `pinned`: what was just placed, and where. `added`: nodes not in state
   * yet (or whose parent just changed) — planned template nodes included.
   */
  async function keepStructure(pinned: Map<string, Pt>, added: NodeDoc[] = []) {
    const addedIds = new Set(added.map((n) => n.nodeId));
    const current = [...nodesRef.current.filter((n) => !addedIds.has(n.nodeId)), ...added];
    const positions = computeBasePositions(current);
    for (const [id, p] of pinned) positions.set(id, p);
    const byId = new Map(current.map((n) => [n.nodeId, n]));
    const moves = planStructureMoves(current, positions, new Set(pinned.keys()), (id) => {
      const n = byId.get(id);
      return !!n && !addedIds.has(id) && canMoveNode(n);
    });
    if (moves.size === 0) return;

    const before = new Map(Array.from(moves.keys(), (id) => [id, positions.get(id)!]));
    setNodes((prev) => prev.map((n) => (moves.has(n.nodeId) ? { ...n, ...moves.get(n.nodeId)! } : n)));
    const failed: string[] = [];
    await Promise.all(
      Array.from(moves, ([id, pt]) =>
        nodesApi
          .updateNode(id, { x: pt.x, y: pt.y })
          .then(upsertNode)
          .catch(() => failed.push(id)),
      ),
    );
    if (failed.length) {
      setNodes((prev) => prev.map((n) => (failed.includes(n.nodeId) ? { ...n, ...before.get(n.nodeId)! } : n)));
      setActionError(moveError);
    }
  }

  return { keepStructure };
}
