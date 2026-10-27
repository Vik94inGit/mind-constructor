import { useEffect, useMemo, useState } from "react";
import { branchParentIds, foldAway, loadFolded, overviewFolds, saveFolded } from "../utils/autoPack";
import type { FoldedParents } from "../utils/autoPack";
import type { NodeDoc } from "../types";

// Auto-pack (utils/autoPack.ts): parents that tuck their branch in, for a
// glance at the map without its details — the viewer's own, per map. It
// never hides the open node (MapPage's visibleNodes keeps it), so a child just
// added or picked from search doesn't vanish from under the viewer.
export function useAutoPack(mapId: string | undefined, unpackedNodes: NodeDoc[]) {
  const [folded, setFoldedState] = useState<FoldedParents>(() => loadFolded(mapId));
  useEffect(() => setFoldedState(loadFolded(mapId)), [mapId]);
  function setFolded(next: FoldedParents) {
    setFoldedState(next);
    saveFolded(mapId, next);
  }
  const fold = useMemo(() => foldAway(unpackedNodes, folded), [unpackedNodes, folded]);
  const mapParents = useMemo(() => branchParentIds(unpackedNodes), [unpackedNodes]);
  function toggleFold(parentId: string) {
    const next = new Set(folded);
    if (next.has(parentId)) next.delete(parentId);
    else next.add(parentId);
    setFolded(next);
  }
  // The overview: every parent packs its last details in (overviewFolds).
  const overviewOn = folded.size > 0;
  function setOverview(on: boolean) {
    setFolded(on ? overviewFolds(unpackedNodes) : new Set());
  }
  return { folded, fold, mapParents, toggleFold, overviewOn, setOverview };
}
