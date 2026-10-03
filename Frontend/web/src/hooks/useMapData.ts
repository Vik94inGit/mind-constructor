import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import * as mapsApi from "../api/maps";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import * as linesApi from "../api/lines";
import { ApiRequestError } from "../api/client";
import { useMapSocket } from "./useMapSocket";
import { upsertBy } from "../utils/mapGraph";
import type { AttackIndicator, EdgeDoc, LineDoc, MapDoc, NodeDoc, SelectedCircle } from "../types";

interface Params {
  mapId: string | undefined;
  // The socket's own echoes touch these two pieces of MapPage state too —
  // see useMapSocket.
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setCelebrateIds: Dispatch<SetStateAction<Set<string>>>;
  loadErrorMessage: string;
}

// Everything MapPage knows about the map itself — the map document, its
// nodes, links and separator lines, the attack insights, and the loading /
// error state of the first fetch — plus every way that data changes: the
// upserts, the lazy text backfill (ensureNodeText), and the live socket sync.
export function useMapData({ mapId, setSelectedId, setCelebrateIds, loadErrorMessage }: Params) {
  const [map, setMap] = useState<MapDoc | null>(null);
  const [nodes, setNodes] = useState<NodeDoc[]>([]);
  const [edges, setEdges] = useState<EdgeDoc[]>([]);
  // Separator lines drawn on the map — see utils/drawLine.ts and the backend's
  // Line model.
  const [lines, setLines] = useState<LineDoc[]>([]);
  const [indicators, setIndicators] = useState<AttackIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Every insertion into `nodes`/`edges` goes through these, not a blind
  // [...prev, x] append — the server broadcasts an action's own result
  // back over the socket to its actor too (see the live-sync effect
  // below), and that echo can arrive before this same tab's own HTTP
  // response does. Two blind appends of the same id would render it
  // twice; an upsert keyed by id makes whichever one lands second a
  // harmless no-op instead.
  const upsertNode = useCallback(
    (incoming: NodeDoc) => setNodes((prev) => upsertBy(prev, incoming, (n) => n.nodeId)),
    [],
  );

  const upsertLine = useCallback(
    (incoming: LineDoc) => setLines((prev) => upsertBy(prev, incoming, (l) => l.lineId)),
    [],
  );

  const upsertEdge = useCallback(
    (incoming: EdgeDoc) => setEdges((prev) => upsertBy(prev, incoming, (e) => e.edgeId)),
    [],
  );

  // Applies a circle choice (or its clearing) to local state — the one
  // place both this tab's own action (from the HTTP response) and the
  // socket echo from circle:selected/deselected land, so the two paths
  // can never disagree about which nodes are locked. Node.locked is
  // recomputed wholesale from the new selection's membership, mirroring
  // exactly what setLockedNodesDao does server-side: every current member
  // locked, everyone else — including previously-locked nodes from a prior
  // selection — unlocked.
  const applyCircleSelection = useCallback((selectedCircle: SelectedCircle | null) => {
    setMap((prev) => (prev ? { ...prev, selectedCircle } : prev));
    const lockedIds = new Set(selectedCircle?.nodeIds ?? []);
    setNodes((prev) => prev.map((n) => ({ ...n, locked: lockedIds.has(n.nodeId) })));
  }, []);

  const loadAll = useCallback(async () => {
    if (!mapId) return;
    setLoading(true);
    setError(null);
    try {
      const [mapDoc, nodeList, edgeList, lineList] = await Promise.all([
        mapsApi.getMap(mapId),
        nodesApi.listNodes(mapId),
        edgesApi.listEdges(mapId),
        // Lines are decoration — a backend without them yet mustn't stop the map loading.
        linesApi.listLines(mapId).catch(() => [] as LineDoc[]),
      ]);
      setMap(mapDoc);
      // Backend's listNodes deliberately omits each node's own `text` (see
      // getNodesByMapDao) — comes back `undefined` over the wire despite
      // NodeDoc's own `text: string`. Normalized to "" right here, once, so
      // every other read of node.text in this file can keep trusting that
      // type instead of null-checking it everywhere; "" doubles as the
      // "text not loaded yet" sentinel ensureNodeText below checks for,
      // which is safe precisely because a real node's text is never
      // actually empty (backend validation requires non-blank text).
      // This list replaces every node with a text-less copy, so anything
      // ensureNodeText already fetched is gone from state too — forget that
      // it was fetched, or the ids stay marked "have" while their text is
      // blank (two overlapping loads, as React StrictMode makes in dev, or a
      // reload after a socket reconnect, otherwise wiped captions for good).
      fetchedTextIds.current.clear();
      setNodes(nodeList.map((n) => ({ ...n, text: n.text ?? "" })));
      setEdges(edgeList);
      setLines(lineList);
      refreshInsights(mapId);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : loadErrorMessage);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  // Backfills real text for whichever node ids actually need it right now
  // (see the loadAll comment above for why most nodes start out with ""
  // instead of their real text) and returns every requested id's now-known
  // text — a caller that just wants the UI to pick it up eventually (a
  // caption, a panel) can fire this and ignore the return value, since the
  // setNodes call below re-renders them anyway; a caller that has to build
  // something from the text *synchronously right after awaiting* (copying,
  // exporting) can't just re-read `nodes` afterward — this same function
  // call's own closure over `nodes` is whatever it was at render time, not
  // whatever setNodes below just applied — so it has to consume the
  // returned map instead. fetchedTextIds remembers every id this has
  // already resolved at least once, so a node that's genuinely empty text
  // (shouldn't happen — backend validation requires non-blank text, but
  // this is the one thing standing between that assumption breaking and an
  // infinite refetch loop) is never retried forever.
  const fetchedTextIds = useRef<Set<string>>(new Set());
  async function ensureNodeText(ids: string[]): Promise<Record<string, string>> {
    const have: Record<string, string> = {};
    const missing: string[] = [];
    for (const id of new Set(ids)) {
      const n = nodes.find((nn) => nn.nodeId === id);
      if (n && (n.text !== "" || fetchedTextIds.current.has(id))) have[id] = n.text;
      else missing.push(id);
    }
    if (missing.length === 0 || !mapId) return have;
    try {
      const fetched = await mapsApi.getNodesText(mapId, missing);
      missing.forEach((id) => {
        fetchedTextIds.current.add(id);
        have[id] = fetched[id] ?? "";
      });
      setNodes((prev) => prev.map((n) => (n.nodeId in fetched ? { ...n, text: fetched[n.nodeId] } : n)));
    } catch {
      // Best-effort — leave these ids out of fetchedTextIds so whatever
      // triggers ensureNodeText next (a re-render, a retry) gets another
      // shot instead of a permanently blank caption/panel; `have` simply
      // won't carry an entry for them, same as any other id it can't
      // resolve.
    }
    return have;
  }

  async function refreshInsights(id: string) {
    try {
      setIndicators(await mapsApi.getAttackIndicators(id));
    } catch {
      // insights are best-effort — a stale/missing overlay isn't worth blocking the map on
    }
  }

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Reloads just the nodes and links this viewer may see, without the loading
  // screen — for when the owner hides or shows a branch.
  const refreshNodesAndEdges = useCallback(async () => {
    if (!mapId) return;
    try {
      const [nodeList, edgeList] = await Promise.all([nodesApi.listNodes(mapId), edgesApi.listEdges(mapId)]);
      setNodes((prev) => {
        const known = new Map(prev.map((n) => [n.nodeId, n.text]));
        return nodeList.map((n) => ({ ...n, text: n.text ?? known.get(n.nodeId) ?? "" }));
      });
      setEdges(edgeList);
    } catch {
      // best-effort: the next full load picks it up
    }
  }, [mapId]);

  useMapSocket({
    mapId,
    loading,
    setNodes,
    setEdges,
    setLines,
    setMap,
    setSelectedId,
    setCelebrateIds,
    upsertNode,
    upsertEdge,
    upsertLine,
    applyCircleSelection,
    refreshInsights,
    onVisibilityChanged: refreshNodesAndEdges,
  });

  return {
    map,
    setMap,
    nodes,
    setNodes,
    edges,
    setEdges,
    lines,
    setLines,
    indicators,
    loading,
    error,
    upsertNode,
    upsertEdge,
    upsertLine,
    applyCircleSelection,
    ensureNodeText,
    refreshInsights,
  };
}
