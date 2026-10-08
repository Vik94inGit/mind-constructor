import { useEffect, useRef, useState } from "react";
import type { NodeGroup } from "../utils/canvasLayout";
import { flipOrder } from "../utils/flipSequence";

/** The pause between one card turning over and the next, ms. */
export const FLIP_STEP_MS = 280;

// Choosing a zone (its parent node, or the zone itself held still) turns its
// emoji cards over one after another — the parent, then each child in turn —
// each settling back on its own (see NodeFlipIcon). Returns a token per node:
// a new value is NodeCard's cue to flip once.
export function useFlipSequence(rootId: string | null, groups: NodeGroup[]): Map<string, number> {
  const [tokens, setTokens] = useState<Map<string, number>>(() => new Map());
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  useEffect(() => {
    if (!rootId) return;
    const group = groupsRef.current.find((g) => g.rootId === rootId);
    if (!group) return;
    const ids = flipOrder(group.members, rootId);
    const timers = ids.map((id, i) =>
      setTimeout(() => {
        setTokens((prev) => new Map(prev).set(id, (prev.get(id) ?? 0) + 1));
      }, i * FLIP_STEP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [rootId]);
  return tokens;
}
