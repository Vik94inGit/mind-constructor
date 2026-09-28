import type { Dispatch, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import * as edgesApi from "../api/edges";
import { ApiRequestError } from "../api/client";
import { buildNodeClipboard, readNodeClipboard, writeNodeClipboard } from "../utils/nodeClipboard";
import { stepPrefix, stepRank } from "../utils/textExport";
import { avoidOverlap, nodeObstacles, pickNonOverlappingPosition } from "../utils/canvasLayout";
import type { NodeGroup, Obstacle, ViewportBounds } from "../utils/canvasLayout";
import type { Translation } from "../i18n/translations";
import type { EdgeDoc, NodeDoc } from "../types";

type Pt = { x: number; y: number };

interface Params {
  mapId: string | undefined;
  nodes: NodeDoc[];
  edges: EdgeDoc[];
  visibleNodes: NodeDoc[];
  positions: Map<string, Pt>;
  nodeGroups: NodeGroup[];
  multiSelectIds: Set<string>;
  selectedId: string | null;
  ensureNodeText: (ids: string[]) => Promise<Record<string, string>>;
  upsertNode: (node: NodeDoc) => void;
  upsertEdge: (edge: EdgeDoc) => void;
  setActionError: (message: string | null) => void;
  showNotice: (message: string) => void;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setMultiSelectIds: Dispatch<SetStateAction<Set<string>>>;
  setCelebrateIds: Dispatch<SetStateAction<Set<string>>>;
  setShowExportText: Dispatch<SetStateAction<boolean>>;
  setExtractClusterRootId: Dispatch<SetStateAction<string | null>>;
  obstaclePoints: (exclude?: Set<string>) => Pt[];
  bigNodeObstacles: (excludeRootIds?: Set<string>) => Obstacle[];
  viewportBounds: () => ViewportBounds;
  refreshInsights: (mapId: string) => void;
  t: Translation;
}

// Fixed offset (not random/growing) so a repeated copy-paste-paste-paste on
// the *same* map fans pasted copies out along one consistent diagonal
// instead of clustering — avoidOverlap (used when actually placing each
// one, in pasteClipboard below) still nudges clear of whatever's already
// there regardless.
const PASTE_OFFSET = 40;

// Ctrl/Cmd+C / Ctrl/Cmd+V, the selection menu's Copy, the "+" menu's Copy
// whole map / Paste, the canvas menu's Paste here, and both "Export text"
// flows — see utils/nodeClipboard.ts for what a copy holds and why it
// survives a reload and is shared between tabs.
export function useClipboardActions({
  mapId,
  nodes,
  edges,
  visibleNodes,
  positions,
  nodeGroups,
  multiSelectIds,
  selectedId,
  ensureNodeText,
  upsertNode,
  upsertEdge,
  setActionError,
  showNotice,
  setSelectedId,
  setMultiSelectIds,
  setCelebrateIds,
  setShowExportText,
  setExtractClusterRootId,
  obstaclePoints,
  bigNodeObstacles,
  viewportBounds,
  refreshInsights,
  t,
}: Params) {
  // `pickIds` null = every node on the map.
  async function copyNodes(pickIds: string[] | null) {
    if (!mapId) return;
    // Awaited, not read straight off `n.text` — a marquee/long-press pick
    // never necessarily opened any of these nodes first, so their real text
    // may not have loaded yet (see ensureNodeText's own doc comment on why
    // its *return value*, not a re-read of `nodes`, is what's safe to use
    // right after awaiting it).
    const wanted = (pickIds ?? visibleNodes.map((n) => n.nodeId)).filter((id) => {
      const n = nodes.find((x) => x.nodeId === id);
      return !!n && !n.isWeapon && !n.isProtection;
    });
    const textById = await ensureNodeText(wanted);
    const clipboard = buildNodeClipboard(mapId, nodes, pickIds, textById, edges);
    if (!clipboard) {
      showNotice(t.ui.clipboard.nothingToCopy);
      return;
    }
    if (!writeNodeClipboard(clipboard)) {
      setActionError(t.ui.clipboard.storeFailed);
      return;
    }
    showNotice(t.ui.clipboard.copied(clipboard.nodes.length));
  }

  // Copies the chosen node(s) (multiSelectIds if any are picked, else the
  // single selectedId) with their text, look, layout, branch parents and the
  // connections among them — but not health, attacks or packing, and
  // nothing pointing at a node that wasn't copied.
  async function copySelection() {
    const ids = multiSelectIds.size > 0 ? Array.from(multiSelectIds) : selectedId ? [selectedId] : [];
    if (ids.length === 0) return;
    await copyNodes(ids);
  }

  async function copyWholeMap() {
    await copyNodes(null);
  }

  // SelectionMenu's "Copy as text" — unlike copySelection above (which feeds
  // Ctrl/Cmd+V's in-app duplicate-paste), this writes plain text straight to
  // the OS clipboard for pasting into a doc/chat/wherever, same
  // navigator.clipboard.writeText pattern ExportTextModal/NodePanel already
  // use for their own Copy buttons. Ordered top-to-bottom/left-to-right (not
  // selection order) so the text reads in the same spatial order as the
  // canvas, same tie-break buildTreeExport uses.
  async function copySelectionAsText() {
    const ids = multiSelectIds.size > 0 ? Array.from(multiSelectIds) : selectedId ? [selectedId] : [];
    if (ids.length === 0) return;
    const picked = ids
      .map((id) => nodes.find((n) => n.nodeId === id))
      .filter((n): n is NodeDoc => !!n && !n.isWeapon && !n.isProtection)
      .sort((a, b) => {
        const pa = positions.get(a.nodeId) ?? { x: a.x ?? 0, y: a.y ?? 0 };
        const pb = positions.get(b.nodeId) ?? { x: b.x ?? 0, y: b.y ?? 0 };
        return stepRank(a) - stepRank(b) || pa.y - pb.y || pa.x - pb.x;
      });
    if (picked.length === 0) return;
    // See copySelection's own comment above — same reason this reads the
    // returned map instead of `n.text` directly.
    const textById = await ensureNodeText(picked.map((n) => n.nodeId));
    const text = picked.map((n) => `${stepPrefix(n)}${n.type}: ${textById[n.nodeId] ?? n.text}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setActionError(t.ui.errors.clipboard);
    }
  }

  // The "+" AddMenu's whole-map "Export text" — the only place this now
  // lives (NodePanel's own copy of this same button is gone; a parent node
  // gets the cluster-scoped extractClusterText below instead). Backfills
  // every visible, real node's text before opening the modal — buildTreeExport
  // needs all of it at once, unlike the other export/copy actions above,
  // which only ever need a chosen few nodes' worth.
  async function openExportText() {
    const ids = visibleNodes.filter((n) => !n.isWeapon && !n.isProtection).map((n) => n.nodeId);
    if (ids.length > 0) await ensureNodeText(ids);
    setShowExportText(true);
  }

  // NodePanel's own "Extract text" for a circle's parent node — scoped to
  // just that node's own cluster (itself + its direct children) plus, for
  // any child that's itself the root of a further cluster, that cluster too
  // — recursively, so a whole chain of nested clusters headed by this
  // node's own descendants comes along, but nothing outside this node's own
  // branch does. Same buildTreeExport-shaped output as the whole-map export
  // (see textExport.ts), just walked from one starting node instead of
  // every root on the map.
  function collectClusterSubtree(rootId: string): NodeDoc[] {
    const collected = new Map<string, NodeDoc>();
    const queue = [rootId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const group = nodeGroups.find((g) => g.rootId === id);
      if (!group) continue;
      for (const member of group.members) {
        if (collected.has(member.nodeId)) continue;
        collected.set(member.nodeId, member);
        // A member that's itself a cluster's own root gets that cluster
        // pulled in too — nodeGroups.find above will pick it up on a later
        // pass through the queue.
        queue.push(member.nodeId);
      }
    }
    return Array.from(collected.values());
  }

  async function extractClusterText(rootId: string) {
    const subtree = collectClusterSubtree(rootId);
    if (subtree.length === 0) return;
    await ensureNodeText(subtree.map((n) => n.nodeId));
    setExtractClusterRootId(rootId);
  }

  // Pastes what's on the clipboard (see copyNodes) into this map — this one
  // or a different one — as brand-new nodes, keeping branch parents and the
  // connections among them. `at` (a canvas point, from the canvas menu's
  // "Paste here") puts the group's middle there.
  async function pasteClipboard(at?: Pt) {
    const clipboard = readNodeClipboard();
    if (!mapId) return;
    if (!clipboard) {
      showNotice(t.ui.clipboard.nothingToPaste);
      return;
    }
    setActionError(null);
    // Pasting back into the map it was copied from: keep the originals'
    // own positions as the anchor (PASTE_OFFSET nudges just clear of them).
    // Pasting into a *different* map: those raw x/y are meaningless here —
    // that map's own layout has nothing to do with this one's — so anchor
    // the whole copied group at a fresh spot inside the *current* viewport
    // instead (same call "+ Add node" already uses), preserving the
    // copied nodes' own relative arrangement around that new anchor rather
    // than each one's original absolute position.
    const sameMap = clipboard.sourceMapId === mapId;
    let dx = PASTE_OFFSET;
    let dy = PASTE_OFFSET;
    if (at || !sameMap) {
      const cx = clipboard.nodes.reduce((sum, n) => sum + n.x, 0) / clipboard.nodes.length;
      const cy = clipboard.nodes.reduce((sum, n) => sum + n.y, 0) / clipboard.nodes.length;
      const anchor = at ?? pickNonOverlappingPosition(obstaclePoints(), bigNodeObstacles(), viewportBounds());
      dx = anchor.x - cx;
      dy = anchor.y - cy;
    }
    // Each node's spot, nudged clear of what is already on the map and of the
    // pasted nodes placed before it — decided up front so the group keeps its
    // shape wherever it can.
    const existing = [...nodeObstacles(obstaclePoints()), ...bigNodeObstacles()];
    const placedPoints: Pt[] = [];
    const placement = new Map<string, Pt>();
    for (const n of clipboard.nodes) {
      const placed = avoidOverlap({ x: n.x + dx, y: n.y + dy }, [...existing, ...nodeObstacles(placedPoints)], viewportBounds());
      placement.set(n.id, placed);
      placedPoints.push(placed);
    }
    const created: NodeDoc[] = [];
    try {
      // A node can only be created once the node it branches from exists, so
      // this goes in waves: everything without a copied parent first, then
      // their children, and so on. Each wave runs in parallel.
      const newIdBySource = new Map<string, string>();
      let pending = clipboard.nodes.slice();
      while (pending.length > 0) {
        let ready = pending.filter((n) => !n.parentId || newIdBySource.has(n.parentId));
        if (ready.length === 0) ready = pending; // a parent loop can't be satisfied — create the rest unlinked
        const batch = await Promise.all(
          ready.map((n) => {
            const spot = placement.get(n.id)!;
            return nodesApi.createNode(mapId, {
              text: n.text,
              title: n.title,
              type: n.type,
              x: spot.x,
              y: spot.y,
              parentId: n.parentId ? (newIdBySource.get(n.parentId) ?? null) : null,
              order: n.order,
              symbolOverride: n.symbolOverride,
              sizeTier: n.sizeTier,
              manualZone: n.manualZone,
            });
          }),
        );
        ready.forEach((n, i) => newIdBySource.set(n.id, batch[i].nodeId));
        batch.forEach((n) => {
          upsertNode(n);
          setCelebrateIds((prev) => new Set(prev).add(n.nodeId));
        });
        created.push(...batch);
        const done = new Set(ready.map((n) => n.id));
        pending = pending.filter((n) => !done.has(n.id));
      }
      // Then the connections among the copied nodes.
      const newEdges = await Promise.all(
        clipboard.edges.map((e) => {
          const from = newIdBySource.get(e.from);
          const to = newIdBySource.get(e.to);
          return from && to ? edgesApi.createEdge(mapId, { fromNodeId: from, toNodeId: to, sentiment: e.sentiment }) : null;
        }),
      );
      newEdges.forEach((e) => e && upsertEdge(e));
      if (newEdges.some(Boolean)) refreshInsights(mapId);
      // The pasted copies become the new selection — same "what you just
      // did is now selected" convention confirmPendingCreate/group-drag
      // already follow, so it's immediately obvious what paste produced
      // and a follow-up paste (offset again from *these*, not the
      // originals) reads as "keep fanning out from here."
      if (created.length > 1) {
        setSelectedId(null);
        setMultiSelectIds(new Set(created.map((n) => n.nodeId)));
      } else if (created.length === 1) {
        setMultiSelectIds(new Set());
        setSelectedId(created[0].nodeId);
      }
      showNotice(t.ui.clipboard.pasted(created.length));
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.paste);
    }
  }

  return {
    copySelection,
    copyWholeMap,
    copyNodes,
    copySelectionAsText,
    openExportText,
    collectClusterSubtree,
    extractClusterText,
    pasteClipboard,
  };
}
