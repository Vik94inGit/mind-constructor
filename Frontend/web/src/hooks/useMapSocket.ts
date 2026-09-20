import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { getSocket, joinMap, leaveMap } from "../api/socket";
import { nodeRefId } from "../utils/nodeType";
import type { EdgeDoc, MapDoc, NodeDoc, SelectedCircle } from "../types";

interface Params {
  mapId: string | undefined;
  /** The initial REST snapshot is still loading — nothing to sync into yet. */
  loading: boolean;
  setNodes: Dispatch<SetStateAction<NodeDoc[]>>;
  setEdges: Dispatch<SetStateAction<EdgeDoc[]>>;
  setMap: Dispatch<SetStateAction<MapDoc | null>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setCelebrateIds: Dispatch<SetStateAction<Set<string>>>;
  upsertNode: (node: NodeDoc) => void;
  upsertEdge: (edge: EdgeDoc) => void;
  applyCircleSelection: (selectedCircle: SelectedCircle | null) => void;
  refreshInsights: (mapId: string) => void;
}

export function useMapSocket({
  mapId,
  loading,
  setNodes,
  setEdges,
  setMap,
  setSelectedId,
  setCelebrateIds,
  upsertNode,
  upsertEdge,
  applyCircleSelection,
  refreshInsights,
}: Params) {
  // Live sync: join this map's room once the initial REST snapshot has
  // landed (guarded on `loading` so an event can't arrive mid-fetch and
  // then get clobbered when loadAll's own, slightly-stale snapshot lands
  // right after it), then keep nodes/edges in step with every other open
  // tab — including the actor's own other tabs, and this same tab's own
  // action echoed back. Every handler below is an upsert/remove keyed by
  // id, specifically so replaying an update this tab already applied
  // optimistically is a harmless no-op instead of a duplicate.
  useEffect(() => {
    if (!mapId || loading) return;

    const socket = getSocket();
    joinMap(mapId);

    const onNodeCreated = (node: NodeDoc) => upsertNode(node);
    const onNodeUpdated = (node: NodeDoc) => upsertNode(node);
    const onNodeDeleted = ({ nodeId: deletedId }: { nodeId: string }) => {
      setNodes((prev) => prev.filter((n) => n.nodeId !== deletedId));
      setEdges((prev) =>
        prev.filter((e) => nodeRefId(e.fromNodeId) !== deletedId && nodeRefId(e.toNodeId) !== deletedId),
      );
    };
    const onNodeAttacked = ({
      node,
      weaponNode,
      healedParent,
      protector,
    }: {
      node: NodeDoc;
      weaponNode: NodeDoc;
      // Set only when this attack was a retaliation that landed — see
      // attackAbl.ts's own healedParent doc comment. null on an ordinary
      // attack, so every other map member's canvas picks up the heal too,
      // not just the retaliator's own tab.
      healedParent: NodeDoc | null;
      // Set only when this attack was blocked — the protection node that
      // blocked it, with its own blockedDamage bumped (see attackAbl.ts's
      // own comment). Every other tab needs this too, not just the
      // attacker's own, so NodePanel's own "blocked N damage so far" line
      // and the weapon-mark loop's own "redirect arrows to the shield"
      // lookup both stay in sync everywhere.
      protector: NodeDoc | null;
    }) => {
      upsertNode(node);
      upsertNode(weaponNode);
      if (healedParent) upsertNode(healedParent);
      if (protector) upsertNode(protector);
      setCelebrateIds((prev) => new Set(prev).add(weaponNode.nodeId));
      refreshInsights(mapId);
    };
    const onEdgeCreated = (edge: EdgeDoc) => {
      upsertEdge(edge);
      refreshInsights(mapId);
    };
    const onEdgeDeleted = ({ edgeId: deletedId }: { edgeId: string }) => {
      setEdges((prev) => prev.filter((e) => e.edgeId !== deletedId));
      refreshInsights(mapId);
    };
    const onCircleSelected = ({ selectedCircle }: { selectedCircle: SelectedCircle | null }) =>
      applyCircleSelection(selectedCircle);
    const onCircleDeselected = () => applyCircleSelection(null);
    const onNodeProtected = ({ protectionNode, healedNode }: { protectionNode: NodeDoc; healedNode: NodeDoc }) => {
      upsertNode(protectionNode);
      upsertNode(healedNode);
    };
    const onNodePacked = ({ container, members }: { container: NodeDoc; members: NodeDoc[] }) => {
      upsertNode(container);
      members.forEach(upsertNode);
      // A packed member just vanished from the canvas (see visibleNodes) —
      // its panel can't stay open for a node nobody can see any more, same
      // defensive clear onNodeDeleted already applies for an outright
      // deletion.
      setSelectedId((prev) => (prev && members.some((m) => m.nodeId === prev) ? null : prev));
    };
    const onNodeUnpacked = ({ node }: { node: NodeDoc }) => upsertNode(node);
    // Someone (the owner — see updateMapAbl's own ownerId check) flipped a
    // map-wide setting, most commonly the Discussion/Personal mode toggle
    // (see isPersonalMode/toggleMapMode below) — merge just the changed
    // fields in rather than replacing `map` outright, so this can't
    // clobber a selectedCircle/color update this client applied locally in
    // between this broadcast being sent and received.
    const onMapUpdated = ({ map: updated }: { map: MapDoc }) =>
      setMap((prev) => (prev ? { ...prev, ...updated } : updated));

    socket.on("node:created", onNodeCreated);
    socket.on("node:updated", onNodeUpdated);
    socket.on("node:deleted", onNodeDeleted);
    socket.on("node:attacked", onNodeAttacked);
    socket.on("edge:created", onEdgeCreated);
    socket.on("edge:deleted", onEdgeDeleted);
    socket.on("circle:selected", onCircleSelected);
    socket.on("circle:deselected", onCircleDeselected);
    socket.on("node:protected", onNodeProtected);
    socket.on("node:packed", onNodePacked);
    socket.on("node:unpacked", onNodeUnpacked);
    socket.on("map:updated", onMapUpdated);

    return () => {
      socket.off("node:created", onNodeCreated);
      socket.off("node:updated", onNodeUpdated);
      socket.off("node:deleted", onNodeDeleted);
      socket.off("node:attacked", onNodeAttacked);
      socket.off("edge:created", onEdgeCreated);
      socket.off("edge:deleted", onEdgeDeleted);
      socket.off("circle:selected", onCircleSelected);
      socket.off("circle:deselected", onCircleDeselected);
      socket.off("node:protected", onNodeProtected);
      socket.off("map:updated", onMapUpdated);
      socket.off("node:packed", onNodePacked);
      socket.off("node:unpacked", onNodeUnpacked);
      leaveMap(mapId);
    };
    // refreshInsights is a fresh closure every render but only ever calls a
    // state setter, so it is deliberately left out of the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, loading, upsertNode, upsertEdge, applyCircleSelection]);
}
