import { findNodeDao, deleteNodeDao, deleteManyNodesDao } from "../dao/nodeDao.js";
import { recordDeletionsAbl } from "../abl/historyAbl.js";
import { findPublicMapIdsDao } from "../dao/mapsDao.js";
import { broadcastToMap } from "../realtime/io.js";
import {
  createNodeAbl,
  updateNodeAbl,
  moveNodesAbl,
  setBranchHiddenAbl,
  NotMapOwnerError,
  MapNotFoundError,
  ParentNotFoundError,
  CrossMapParentError,
  ParentNotOwnedError,
  SelfParentError,
  ZoneColorTakenError,
} from "../abl/nodeAbl.js";
import {
  attackNodeAbl,
  getAttackHistoryAbl,
  protectNodeAbl,
  NotNodeOwnerError,
  AttackTypeNotAllowedError,
} from "../abl/attackAbl.js";
import {
  packNodesAbl,
  unpackNodeAbl,
  PackContainerNotFoundError,
  PackNotOwnedError,
  PackMemberNotFoundError,
  PackMemberNotEligibleError,
} from "../abl/packAbl.js";
import { WEAPONS, type WeaponKey } from "../models/Attack.js";
import { authed, fail, isIdList, publicMapIdOf } from "./errorHandling.js";

const isWeaponKey = (value: unknown): value is WeaponKey =>
  typeof value === "string" && value in WEAPONS;

type NodeParams = { nodeId: string };
const nodeNotFound = (res: Parameters<typeof fail>[0]) => fail(res, 404, "Node not found");

export const getNodeById = authed<NodeParams>("getNodeById", async (req, res, userId) => {
  // findNodeDao only returns the node if the caller is a member of its map.
  const node = await findNodeDao(req.params.nodeId, userId);
  if (!node) return nodeNotFound(res);
  return res.status(200).json({ node });
});

export const createNode = authed<{ mapId: string }>(
  "createNode",
  async (req, res, userId) => {
    const { mapId } = req.params;
    const node = await createNodeAbl(req.body, mapId, userId);
    broadcastToMap(mapId, "node:created", node);
    return res.status(201).json(node);
  },
  {
    errors: [
      // Thrown when the map doesn't exist, or the caller isn't a member of it.
      [MapNotFoundError, 404, "Map not found"],
      [ParentNotFoundError, 404, "Parent node not found"],
      [CrossMapParentError, 400, "Parent node must belong to the same map"],
      [ParentNotOwnedError, 403, "You can only branch off nodes you created"],
    ],
    message: "Failed to create Node",
  },
);

export const updateNode = authed<NodeParams>(
  "updateNode",
  async (req, res, userId) => {
    // Scoped to userId, so this returns null for a node that exists but
    // belongs to someone else — not just for a node that doesn't exist.
    const node = await updateNodeAbl(req.params.nodeId, userId, req.body);
    if (!node) return nodeNotFound(res);

    // node.mapId comes back populated (NODE_POPULATE includes it), so the
    // public mapId is read straight off it, without another query.
    const publicMapId = publicMapIdOf(node);
    if (publicMapId) broadcastToMap(publicMapId, "node:updated", node);
    return res.status(200).json(node);
  },
  {
    errors: [
      [ParentNotFoundError, 404, "Parent node not found"],
      [CrossMapParentError, 400, "Parent node must belong to the same map"],
      [ParentNotOwnedError, 403, "You can only branch off nodes you created"],
      [SelfParentError, 400, "A node can't be its own parent"],
      [ZoneColorTakenError, 409, "Another member's zones already use this colour"],
    ],
    message: "Failed to update node",
  },
);

// ========== MOVE SEVERAL NODES ==========
// PATCH /api/nodes { moves: [{ nodeId, x, y, cardX?, cardY? }] } — a group
// moved at once. Everyone else on the map hears one "nodes:moved" event.
export const moveNodes = authed(
  "moveNodes",
  async (req, res, userId) => {
    const { nodes, broadcasts } = await moveNodesAbl(userId, req.body);
    for (const { publicMapId, nodes: batch } of broadcasts) broadcastToMap(publicMapId, "nodes:moved", batch);
    return res.status(200).json(nodes);
  },
  { message: "Failed to move nodes" },
);

// ========== ATTACK A NODE ==========
export const attackNode = authed<NodeParams>(
  "attackNode",
  async (req, res, userId) => {
    const { weapon, type, text, byOpponent } = req.body;
    if (!isWeaponKey(weapon)) {
      return fail(res, 400, `weapon is required and must be one of: ${Object.keys(WEAPONS).join(", ")}`);
    }

    const result = await attackNodeAbl(req.params.nodeId, userId, weapon, { type, text, byOpponent });
    if (!result) return nodeNotFound(res);

    const publicMapId = publicMapIdOf(result.node);
    if (publicMapId) broadcastToMap(publicMapId, "node:attacked", result);
    return res.status(200).json({ success: true, ...result });
  },
  {
    errors: [
      [AttackTypeNotAllowedError, 403, (e) => ({ error: e.message, allowed: (e as AttackTypeNotAllowedError).allowed })],
    ],
    message: "Attack failed",
  },
);

// ========== PROTECT A NODE ==========
export const protectNode = authed<NodeParams>(
  "protectNode",
  async (req, res, userId) => {
    const { type, text, byOpponent } = req.body;
    const result = await protectNodeAbl(req.params.nodeId, userId, { type, text, byOpponent });
    if (!result) return nodeNotFound(res);

    const publicMapId = publicMapIdOf(result.protectionNode);
    if (publicMapId) broadcastToMap(publicMapId, "node:protected", result);
    return res.status(200).json({ success: true, ...result });
  },
  {
    errors: [[NotNodeOwnerError, 403, "Only this node's own owner can add a protection node to it"]],
    message: "Protect failed",
  },
);

// ========== PACK / UNPACK NODES ==========
export const packNode = authed<NodeParams>(
  "packNode",
  async (req, res, userId) => {
    const result = await packNodesAbl(req.params.nodeId, userId, req.body);
    const publicMapId = publicMapIdOf(result.container);
    if (publicMapId) broadcastToMap(publicMapId, "node:packed", result);
    return res.status(200).json({ success: true, ...result });
  },
  {
    errors: [
      [PackContainerNotFoundError, 404, "Container node not found"],
      [PackNotOwnedError, 403, "You can only pack nodes into a container you created"],
      [PackMemberNotFoundError, 404, "One of the picked nodes was not found"],
      [PackMemberNotEligibleError, 400, "A picked node isn't linked (by branch or Link) to the container"],
    ],
    message: "Pack failed",
  },
);

export const unpackNode = authed<NodeParams>(
  "unpackNode",
  async (req, res, userId) => {
    const node = await unpackNodeAbl(req.params.nodeId, userId);
    if (!node) return nodeNotFound(res);

    const publicMapId = publicMapIdOf(node);
    if (publicMapId) broadcastToMap(publicMapId, "node:unpacked", { node });
    return res.status(200).json({ success: true, node });
  },
  { message: "Unpack failed" },
);

// ========== HIDE / SHOW A BRANCH (map owner only) ==========
export const setNodeVisibility = authed<NodeParams>(
  "setNodeVisibility",
  async (req, res, userId) => {
    const node = await setBranchHiddenAbl(req.params.nodeId, userId, req.body);
    if (!node) return nodeNotFound(res);

    // Every member reloads what it can see; the payload deliberately carries
    // no node id, so this goes to everyone rather than the owner alone.
    const publicMapId = publicMapIdOf(node);
    if (publicMapId) broadcastToMap(publicMapId, "nodes:visibility", { changed: true });
    return res.status(200).json({ success: true, node });
  },
  {
    errors: [[NotMapOwnerError, 403, "Only the map's owner can hide or show a branch"]],
    message: "Could not change the branch's visibility",
  },
);

// ========== NODE ATTACK HISTORY ==========
export const getNodeAttackHistory = authed<NodeParams>("getNodeAttackHistory", async (req, res, userId) => {
  const attacks = await getAttackHistoryAbl(req.params.nodeId, userId);
  if (attacks === null) return nodeNotFound(res);
  return res.status(200).json(attacks);
});

export const deleteNode = authed<NodeParams>(
  "deleteNode",
  async (req, res, userId) => {
    const { nodeId } = req.params;
    const result = await deleteNodeDao(nodeId, userId);
    if (!result) return nodeNotFound(res);

    const { node, damagedProtectedNode } = result;
    await recordDeletionsAbl([node], userId);

    // Deleting a node also cascades to edges touching it, children's
    // parentId, and weapon nodes aimed at it (see deleteNodeDao) — those
    // side effects aren't individually broadcast, so other open tabs only
    // pick them up on next reload. The node itself goes out live, and so
    // does damagedProtectedNode when this was a protection node with a
    // nonzero blockedDamage — a live health change (possibly a defeat) is
    // worth more than the other, silent cascade effects.
    // deleteNodeDao populates node.mapId (after its own cascade queries,
    // which need it as a raw ObjectId, finish).
    const publicMapId = publicMapIdOf(node);
    if (publicMapId) {
      broadcastToMap(publicMapId, "node:deleted", { nodeId });
      if (damagedProtectedNode) broadcastToMap(publicMapId, "node:updated", damagedProtectedNode);
    }
    return res.status(200).json({ success: true, deletedId: nodeId, damagedProtectedNode });
  },
  { message: "Server error" },
);

// Bulk counterpart of deleteNode — one request for the frontend's multi-select
// "Delete N nodes" instead of N parallel single-node DELETEs. Same ownership
// contract as the single-node route (see deleteManyNodesDao): an id the
// caller doesn't own, or that's already gone, is silently skipped rather than
// failing the whole batch.
export const deleteManyNodes = authed(
  "deleteManyNodes",
  async (req, res, userId) => {
    const { nodeIds } = req.body as { nodeIds?: unknown };
    if (!isIdList(nodeIds)) return fail(res, 400, "nodeIds must be a non-empty array of strings");

    const results = await deleteManyNodesDao(nodeIds, userId);
    await recordDeletionsAbl(results.map(({ node }) => node), userId);

    // These node docs aren't populated, but each carries its internal mapId:
    // resolve the unique maps in one query (a multi-selection may span maps).
    const uniqueMapInternalIds = [...new Set(results.map(({ node }) => node.mapId.toString()))];
    const publicMapIdByInternalId = await findPublicMapIdsDao(uniqueMapInternalIds);

    // The same per-node broadcast deleteNode does, for every deleted node.
    for (const { node, damagedProtectedNode } of results) {
      const publicMapId = publicMapIdByInternalId[node.mapId.toString()];
      if (!publicMapId) continue;
      broadcastToMap(publicMapId, "node:deleted", { nodeId: node.nodeId });
      if (damagedProtectedNode) broadcastToMap(publicMapId, "node:updated", damagedProtectedNode);
    }

    return res.status(200).json({
      success: true,
      deleted: results.map(({ node, damagedProtectedNode }) => ({
        deletedId: node.nodeId,
        damagedProtectedNode,
      })),
    });
  },
  { message: "Server error" },
);
