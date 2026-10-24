import { useEffect, useRef, useState } from "react";
import { chompsOnHover } from "../utils/pacman";
import type { NodeDoc } from "../types";

/** One Pac-Man run, as long as one loop of `.pacman-run` in index.css. */
export const TAP_CHOMP_MS = 2400;

/**
 * A phone has no hover, so tapping a strong attack plays its Pac-Man run once
 * and stops, leaving the attack back on its own spot. Only a tap on the attack
 * itself starts it: selecting the node it hit, or stepping onto the attack
 * with the panel's arrows, doesn't, so moving round the map with the panel
 * open never sets attacks running.
 */
export function useTapChomp(
  selectedId: string | null,
  steppedToId: string | null,
  nodes: Pick<NodeDoc, "nodeId" | "isWeapon" | "weaponIcon">[],
): string | null {
  const [chompId, setChompId] = useState<string | null>(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const steppedRef = useRef(steppedToId);
  steppedRef.current = steppedToId;

  useEffect(() => {
    const node = selectedId ? nodesRef.current.find((n) => n.nodeId === selectedId) : undefined;
    if (!node || !chompsOnHover(node) || steppedRef.current === selectedId) {
      setChompId(null);
      return;
    }
    setChompId(selectedId);
    const timer = window.setTimeout(() => setChompId(null), TAP_CHOMP_MS);
    return () => window.clearTimeout(timer);
  }, [selectedId]);

  return chompId;
}
