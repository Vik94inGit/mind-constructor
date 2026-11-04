import { useEffect, useRef, useState } from "react";
import * as nodesApi from "../api/nodes";
import type { NodeDoc } from "../types";

/**
 * The pictures of the node a presentation slide is about. The map's node
 * list leaves `images` out (like the node panel, see useNodeImages), so they
 * are fetched with the single node the first time its slide shows and kept
 * for the rest of the show, so stepping back and forth doesn't fetch again.
 * [] while loading, when the fetch fails, or when the node has none.
 */
export function useSlidePictures(node: NodeDoc | undefined): string[] {
  const cache = useRef(new Map<string, string[]>());
  const nodeId = node?.nodeId;
  const known = node?.images;
  const [, setLoaded] = useState(0);

  useEffect(() => {
    if (!nodeId || known || cache.current.has(nodeId)) return;
    let cancelled = false;
    nodesApi
      .getNode(nodeId)
      .then((full) => {
        cache.current.set(nodeId, full.images ?? []);
        if (!cancelled) setLoaded((n) => n + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [nodeId, known]);

  if (!nodeId) return [];
  return known ?? cache.current.get(nodeId) ?? [];
}
