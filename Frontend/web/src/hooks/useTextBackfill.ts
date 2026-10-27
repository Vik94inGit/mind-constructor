import { useEffect } from "react";
import type { NodeGroup } from "../utils/canvasLayout";
import type { ReadingMode } from "../utils/readingMode";
import type { Sentiment } from "../utils/nodeType";
import type { NodeDoc } from "../types";

interface Params {
  nodes: NodeDoc[];
  visibleNodes: NodeDoc[];
  nodeGroups: NodeGroup[];
  groupSentimentByNode: Map<string, Sentiment>;
  spotlightedNodeIds: string[] | undefined;
  selectedId: string | null;
  /** How each node is drawn; any look but the default draws its text. */
  modeOf: (nodeId: string) => ReadingMode;
  /** What modeOf reads, so a change of any of them fetches again. */
  displayKeys: unknown[];
  ensureNodeText: (ids: string[]) => Promise<unknown>;
  /** The chosen zone's spinner, which goes once its members' text is in. */
  setCircleLoadingRootId: (rootId: string | null) => void;
}

// The map's node list arrives without text (useMapData's ensureNodeText fills
// it in on demand). These are every moment the canvas needs some of it.
export function useTextBackfill({
  nodes,
  visibleNodes,
  nodeGroups,
  groupSentimentByNode,
  spotlightedNodeIds,
  selectedId,
  modeOf,
  displayKeys,
  ensureNodeText,
  setCircleLoadingRootId,
}: Params) {
  // Circle-parent nodes always show their caption (see NodeCard's
  // showCaption) — this backfills their real text the moment a node becomes
  // one, rather than waiting on some other trigger (opening its panel, an
  // export) that might never come for a node nobody's actually clicked yet.
  useEffect(() => {
    const rootIds = nodeGroups.filter((g) => !g.members[0]?.title).map((g) => g.rootId);
    if (rootIds.length > 0) ensureNodeText(rootIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeGroups]);

  // Every member of the currently-chosen cluster shows its caption too (see
  // NodeCard's inChosenCircle) — backfill all of them the instant a circle
  // becomes the chosen one, same trigger MapPage's centering effect reacts to.
  useEffect(() => {
    if (spotlightedNodeIds && spotlightedNodeIds.length > 0) {
      // The text is what the chosen circle's members' captions need — once it
      // is in, the zone's loading spinner (if one is showing) can go.
      void ensureNodeText(spotlightedNodeIds).finally(() => setCircleLoadingRootId(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotlightedNodeIds]);

  // NodePanel needs a selected node's real text regardless of how it got
  // selected (a plain click, the panel's own "Points at" link, a weapon
  // replay, …) — one backfill trigger here covers all of those instead of
  // repeating this at every call site that can set selectedId.
  useEffect(() => {
    if (selectedId) ensureNodeText([selectedId]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Every reading mode but the default draws every node's text (whole, or
  // cut to one line in the mixed mode), so all of it is needed up front (one
  // bulk request for whatever hasn't loaded yet).
  useEffect(() => {
    const ids = visibleNodes.filter((n) => modeOf(n.nodeId) !== "actual").map((n) => n.nodeId);
    if (ids.length > 0) ensureNodeText(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...displayKeys, visibleNodes]);

  // Every node outside any circle (a single node, or one whose parent has
  // only the one child) always shows its caption too — see NodeCard's
  // showCaption — so its real text gets backfilled the moment it's in that
  // state, same reasoning as the circle-root effect above. A node that *is*
  // in a circle only needs its text once that circle is chosen, which the
  // spotlighted effect already covers.
  useEffect(() => {
    // A node with a title captions itself with that (already in hand, unlike
    // text) — nothing to fetch for it.
    const ids = nodes.filter((n) => !groupSentimentByNode.has(n.nodeId) && !n.title).map((n) => n.nodeId);
    if (ids.length > 0) ensureNodeText(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, groupSentimentByNode]);
}
