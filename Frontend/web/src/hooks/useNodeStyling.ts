import type { Dispatch, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import { ApiRequestError } from "../api/client";
import { ZONE_COLORS } from "../utils/nodeType";
import { zoneLabel } from "../utils/mapGraph";
import type { NodeGroup } from "../utils/canvasLayout";
import type { Translation } from "../i18n/translations";
import type { ZoneStylePatch } from "../map/ZoneMenuBody";
import type { NamedZone } from "../map/ZoneNames";
import type { NodeDoc, NodeShape, NodeType, ZonePaletteColor } from "../types";

export type CardLookPatch = Pick<Partial<NodeDoc>, "cardW" | "cardH" | "cardFont" | "cardShape">;

interface Params {
  nodes: NodeDoc[];
  nodeGroups: NodeGroup[];
  isOwnNode: (node: NodeDoc) => boolean;
  setNodes: Dispatch<SetStateAction<NodeDoc[]>>;
  upsertNode: (node: NodeDoc) => void;
  setActionError: (message: string | null) => void;
  /** A zone's menu: copies its nodes' text (useClipboardActions). */
  copyText: (ids: string[]) => void;
  /** A zone's menu: deletes these nodes (useSelectionActions). */
  deleteNodes: (ids: string[]) => void;
  t: Translation;
}

// How a node or a zone looks, changed from its menus and panel: a node's
// type, shape and card look, a zone's pattern, colour and edge. Each is shown
// straight away and put back if the save fails.
export function useNodeStyling({
  nodes,
  nodeGroups,
  isOwnNode,
  setNodes,
  upsertNode,
  setActionError,
  copyText,
  deleteNodes,
  t,
}: Params) {
  // The context menu's own "Change type" submenu — a third path to the same
  // field the inline editor's icon-click cycling and the node panel's own
  // (now removed) type dropdown used to cover, for picking a type without
  // opening either of those. Owner-only, same as every other context-menu
  // action on someone else's node (see NodeContextMenu's own isOwner gate).
  async function handleChangeNodeType(node: NodeDoc, type: NodeType) {
    setActionError(null);
    try {
      const updated = await nodesApi.updateNode(node.nodeId, { type });
      upsertNode(updated);
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.type);
    }
  }

  // A zone's pattern, colour or edge brightness, saved on its parent
  // (Node.zonePattern / zoneColor / zoneEdge). Shown straight away, rolled
  // back if the save fails.
  function setZoneStyle(rootId: string, patch: ZoneStylePatch) {
    const root = nodes.find((n) => n.nodeId === rootId);
    if (!root) return;
    upsertNode({ ...root, ...patch });
    nodesApi.updateNode(rootId, patch).then(upsertNode, (err) => {
      upsertNode(root);
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.errors.update);
    });
  }

  // A zone's look for its menus — only the parent's owner may restyle it (an
  // owner-only node edit), so everyone else gets no style section. Reads the
  // live node, so a pick shows at once while a menu stays open.
  function zoneStyleFor(rootId: string) {
    const root = nodes.find((n) => n.nodeId === rootId);
    const group = nodeGroups.find((g) => g.rootId === rootId);
    if (!root || !group || !isOwnNode(root)) return undefined;
    // One person, one colour: a palette colour another member's zone wears
    // isn't offered (Backend's ZoneColorTakenError backs this up).
    const taken: Partial<Record<ZonePaletteColor, string>> = {};
    for (const n of nodes) {
      if (n.zoneColor && !isOwnNode(n) && !taken[n.zoneColor]) {
        taken[n.zoneColor] = typeof n.userId === "string" ? "?" : n.userId.username;
      }
    }
    return {
      pattern: root.zonePattern ?? null,
      color: root.zoneColor ?? null,
      edge: root.zoneEdge ?? null,
      autoColor: ZONE_COLORS[group.sentiment],
      taken,
    };
  }

  // One shape for several nodes at once (a zone's menu). Shown at once; what
  // the server refuses goes back.
  async function setShapeOf(targets: NodeDoc[], shape: NodeShape | null) {
    setActionError(null);
    setNodes((prev) => prev.map((n) => (targets.some((x) => x.nodeId === n.nodeId) ? { ...n, shape } : n)));
    const failed: NodeDoc[] = [];
    await Promise.all(
      targets.map((n) =>
        nodesApi
          .updateNode(n.nodeId, { shape })
          .then(upsertNode)
          .catch(() => failed.push(n)),
      ),
    );
    if (failed.length) {
      setNodes((prev) => prev.map((n) => failed.find((f) => f.nodeId === n.nodeId) ?? n));
      setActionError(t.ui.errors.shape);
    }
  }

  // A card's own look (Node.cardW/cardH/cardFont/cardShape): shown straight
  // away, put back if it won't save.
  async function saveCardLook(node: NodeDoc, patch: CardLookPatch) {
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, node[k as keyof NodeDoc] ?? null]));
    setNodes((prev) => prev.map((n) => (n.nodeId === node.nodeId ? { ...n, ...patch } : n)));
    try {
      upsertNode(await nodesApi.updateNode(node.nodeId, patch));
    } catch (err) {
      setNodes((prev) => prev.map((n) => (n.nodeId === node.nodeId ? { ...n, ...before } : n)));
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.display.cardLookFailed);
    }
  }

  // A zone's own menu (ZoneMenu): copy all of its text, give all of your
  // nodes in it one shape, or delete those nodes — the zone as a whole,
  // without choosing its nodes one by one first.
  function zoneActionsFor(rootId: string) {
    const group = nodeGroups.find((g) => g.rootId === rootId);
    if (!group) return undefined;
    const ids = group.members.map((n) => n.nodeId);
    const own = group.members.filter((n) => isOwnNode(n) && !n.isWeapon);
    const shapes = new Set(own.map((n) => n.shape ?? null));
    return {
      onCopyText: () => copyText(ids),
      shape:
        own.length > 0
          ? {
              value: shapes.size === 1 ? [...shapes][0] : undefined,
              onPick: (shape: NodeShape | null) => void setShapeOf(own, shape),
            }
          : undefined,
      onDelete: own.length > 0 ? () => deleteNodes(own.map((n) => n.nodeId)) : undefined,
      deleteCount: own.length,
    };
  }

  // Each zone's name chip (ZoneNames), with its look: a zone with nothing to
  // name it by (see zoneLabel: zoneName, else title, else text, capped) has none.
  function zoneNameChips(): NamedZone[] {
    return nodeGroups.flatMap((g) => {
      const root = nodes.find((n) => n.nodeId === g.rootId);
      const shortName = zoneLabel(root);
      return shortName
        ? [{ rootId: g.rootId, name: shortName, sentiment: g.sentiment, variant: !!root!.parentId, style: zoneStyleFor(g.rootId) }]
        : [];
    });
  }

  return { handleChangeNodeType, setZoneStyle, zoneStyleFor, setShapeOf, saveCardLook, zoneActionsFor, zoneNameChips };
}
