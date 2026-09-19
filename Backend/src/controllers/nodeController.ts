import { Request, Response } from "express";

import { findNodeDao, deleteNodeDao, deleteManyNodesDao } from "../dao/nodeDao.js";
import { findPublicMapIdsDao } from "../dao/mapsDao.js";
import { broadcastToMap } from "../realtime/io.js";
import {
  createNodeAbl,
  updateNodeAbl,
  MapNotFoundError,
  ParentNotFoundError,
  CrossMapParentError,
  ParentNotOwnedError,
  SelfParentError,
} from "../abl/nodeAbl.js";
import {
  attackNodeAbl,
  getAttackHistoryAbl,
  protectNodeAbl,
  CannotAttackOwnNodeError,
  CanOnlyAttackOwnNodeError,
  CannotRetaliateError,
  NodeAlreadyDefeatedError,
  WeaponOnCooldownError,
  NotNodeOwnerError,
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
import { handleAblError } from "./errorHandling.js";

const isWeaponKey = (value: unknown): value is WeaponKey =>
  typeof value === "string" && value in WEAPONS;

interface nodeIdParams {
  nodeId: string;
}

export const getNodeById = async (
  req: Request<nodeIdParams>,
  res: Response,
) => {
  try {
    const { nodeId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }

    // findNodeDao only returns the node if the caller is a member of its map.
    const node = await findNodeDao(nodeId, userId);

    if (!node) {
      return res.status(404).json({ success: false, error: "Node not found" });
    }
    return res.status(200).json({ node });
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "getNodeById",
    });
  }
};

export const createNode = async (
  req: Request<{ mapId: string }>,
  res: Response,
) => {
  try {
    const mapId = req.params.mapId;
    const userId = req.user?._id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized: User missing" });
    }

    const node = await createNodeAbl(req.body, mapId, userId);

    broadcastToMap(mapId, "node:created", node);
    return res.status(201).json(node);
  } catch (error) {
    return handleAblError(
      res,
      error,
      [
        // Thrown when the map doesn't exist, or the caller isn't a member of it.
        [MapNotFoundError, 404, "Map not found"],
        [ParentNotFoundError, 404, "Parent node not found"],
        [CrossMapParentError, 400, "Parent node must belong to the same map"],
        [ParentNotOwnedError, 403, "You can only branch off nodes you created"],
      ],
      { message: "Failed to create Node", logLabel: "createNode" },
    );
  }
};

export const updateNode = async (
  req: Request<nodeIdParams>,
  res: Response,
) => {
  try {
    const { nodeId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized User missing" });
    }

    // Scoped to userId, so this returns null for a node that exists but
    // belongs to someone else — not just for a node that doesn't exist.
    const node = await updateNodeAbl(nodeId, userId, req.body);

    if (!node) {
      return res
        .status(404)
        .json({ success: false, error: "Node not found" });
    }

    // node.mapId comes back populated (NODE_POPULATE now includes it) since
    // updateNodeAbl -> updateNodeDao already runs through NODE_POPULATE —
    // reading the public mapId off it avoids a separate findPublicMapIdDao
    // round-trip.
    const publicMapId = (node.mapId as unknown as { mapId?: string } | null)?.mapId ?? null;
    if (publicMapId) broadcastToMap(publicMapId, "node:updated", node);

    return res.status(200).json(node);
  } catch (error) {
    return handleAblError(
      res,
      error,
      [
        [ParentNotFoundError, 404, "Parent node not found"],
        [CrossMapParentError, 400, "Parent node must belong to the same map"],
        [ParentNotOwnedError, 403, "You can only branch off nodes you created"],
        [SelfParentError, 400, "A node can't be its own parent"],
      ],
      { message: "Failed to update node", logLabel: "updateNode" },
    );
  }
};

// ========== ATTACK A NODE ==========
export const attackNode = async (req: Request<nodeIdParams>, res: Response) => {
  try {
    const { nodeId } = req.params;
    const userId = req.user?._id;
    const { weapon, type, text } = req.body;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }

    if (!isWeaponKey(weapon)) {
      return res.status(400).json({
        success: false,
        error: `weapon is required and must be one of: ${Object.keys(WEAPONS).join(", ")}`,
      });
    }

    const result = await attackNodeAbl(nodeId, userId, weapon, { type, text });

    if (!result) {
      return res
        .status(404)
        .json({ success: false, error: "Node not found" });
    }

    const publicMapId = result.node
      ? ((result.node.mapId as unknown as { mapId?: string } | null)?.mapId ?? null)
      : null;
    if (publicMapId) broadcastToMap(publicMapId, "node:attacked", result);

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleAblError(
      res,
      error,
      [
        [CannotAttackOwnNodeError, 400, "You can't attack your own node"],
        [CanOnlyAttackOwnNodeError, 400, "Discussion mode: you can only attack your own nodes"],
        [
          CannotRetaliateError,
          403,
          "You can only retaliate against an attack that targeted your own node",
        ],
        [NodeAlreadyDefeatedError, 400, "This node has already been defeated"],
        [
          WeaponOnCooldownError,
          429,
          (e: Error) => ({
            error: "That weapon is still on cooldown",
            readyAt: new Date((e as WeaponOnCooldownError).readyAt).toISOString(),
          }),
        ],
      ],
      { message: "Attack failed", logLabel: "attackNode" },
    );
  }
};

// ========== PROTECT A NODE ==========
export const protectNode = async (req: Request<nodeIdParams>, res: Response) => {
  try {
    const { nodeId } = req.params;
    const userId = req.user?._id;
    const { type, text } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }

    const result = await protectNodeAbl(nodeId, userId, { type, text });

    if (!result) {
      return res.status(404).json({ success: false, error: "Node not found" });
    }

    const publicMapId =
      (result.protectionNode.mapId as unknown as { mapId?: string } | null)?.mapId ?? null;
    if (publicMapId) broadcastToMap(publicMapId, "node:protected", result);

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleAblError(
      res,
      error,
      [
        [NotNodeOwnerError, 403, "Only this node's own owner can add a protection node to it"],
      ],
      { message: "Protect failed", logLabel: "protectNode" },
    );
  }
};

// ========== PACK / UNPACK NODES ==========
export const packNode = async (req: Request<nodeIdParams>, res: Response) => {
  try {
    const { nodeId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }

    const result = await packNodesAbl(nodeId, userId, req.body);

    const publicMapId = result.container
      ? ((result.container.mapId as unknown as { mapId?: string } | null)?.mapId ?? null)
      : null;
    if (publicMapId) broadcastToMap(publicMapId, "node:packed", result);

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleAblError(
      res,
      error,
      [
        [PackContainerNotFoundError, 404, "Container node not found"],
        [PackNotOwnedError, 403, "You can only pack nodes into a container you created"],
        [PackMemberNotFoundError, 404, "One of the picked nodes was not found"],
        [
          PackMemberNotEligibleError,
          400,
          "A picked node isn't linked (by branch or Link) to the container",
        ],
      ],
      { message: "Pack failed", logLabel: "packNode" },
    );
  }
};

export const unpackNode = async (req: Request<nodeIdParams>, res: Response) => {
  try {
    const { nodeId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }

    const node = await unpackNodeAbl(nodeId, userId);

    if (!node) {
      return res.status(404).json({ success: false, error: "Node not found" });
    }

    const publicMapId = (node.mapId as unknown as { mapId?: string } | null)?.mapId ?? null;
    if (publicMapId) broadcastToMap(publicMapId, "node:unpacked", { node });

    return res.status(200).json({ success: true, node });
  } catch (error) {
    return handleAblError(res, error, [], { message: "Unpack failed", logLabel: "unpackNode" });
  }
};

// ========== NODE ATTACK HISTORY ==========
export const getNodeAttackHistory = async (
  req: Request<nodeIdParams>,
  res: Response,
) => {
  try {
    const { nodeId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }

    const attacks = await getAttackHistoryAbl(nodeId, userId);

    if (attacks === null) {
      return res
        .status(404)
        .json({ success: false, error: "Node not found" });
    }

    return res.status(200).json(attacks);
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "getNodeAttackHistory",
    });
  }
};

export const deleteNode = async (
  req: Request<nodeIdParams>,
  res: Response,
) => {
  try {
    const { nodeId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "Unauthorized User missing" });
    }

    const result = await deleteNodeDao(nodeId, userId);

    if (!result) {
      return res
        .status(404)
        .json({ success: false, error: "Node not found" });
    }
    const { node, damagedProtectedNode } = result;

    // Deleting a node also cascades to edges touching it, children's
    // parentId, and weapon nodes aimed at it (see deleteNodeDao) — those
    // side effects aren't individually broadcast, so other open tabs only
    // pick them up on next reload. The node itself goes out live, and so
    // does damagedProtectedNode when this was a protection node with a
    // nonzero blockedDamage — a live health change (possibly a defeat) is
    // worth more than the other, silent cascade effects.
    // deleteNodeDao populates node.mapId (after its own cascade queries,
    // which need it as a raw ObjectId, finish) — read the public mapId
    // straight off it instead of a separate findPublicMapIdDao round-trip.
    const publicMapId = (node.mapId as unknown as { mapId?: string } | null)?.mapId ?? null;
    if (publicMapId) {
      broadcastToMap(publicMapId, "node:deleted", { nodeId });
      if (damagedProtectedNode) broadcastToMap(publicMapId, "node:updated", damagedProtectedNode);
    }

    return res.status(200).json({ success: true, deletedId: nodeId, damagedProtectedNode });
  } catch (error) {
    return handleAblError(res, error, [], { message: "Server error", logLabel: "deleteNode" });
  }
};

// Bulk counterpart of deleteNode — the frontend's multi-select "Delete N
// nodes" used to fire one DELETE per node in parallel; this collapses that
// into a single request. Same ownership contract as the single-node route
// (see deleteManyNodesDao): an id the caller doesn't own, or that's already
// gone, is silently skipped rather than failing the whole batch.
export const deleteManyNodes = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized User missing" });
    }

    const { nodeIds } = req.body as { nodeIds?: unknown };
    if (!Array.isArray(nodeIds) || nodeIds.length === 0 || !nodeIds.every((id) => typeof id === "string")) {
      return res
        .status(400)
        .json({ success: false, error: "nodeIds must be a non-empty array of strings" });
    }

    const results = await deleteManyNodesDao(nodeIds, userId);

    // deleteManyNodesDao's node docs aren't populated (they're about to be
    // broadcast one at a time, not returned as a batch response), but each
    // one still carries its own internal mapId — resolve the unique ones
    // touched by this batch in a single query instead of one
    // findPublicMapIdDao call per deleted node (O(unique maps), not
    // O(nodes); a multi-selection is not assumed to be all on one map).
    const uniqueMapInternalIds = [...new Set(results.map(({ node }) => node.mapId.toString()))];
    const publicMapIdByInternalId = await findPublicMapIdsDao(uniqueMapInternalIds);

    // Same per-node broadcast deleteNode's own controller does above, just
    // for every node this batch actually deleted — grouped implicitly by
    // whichever map each one belongs to, since nothing here assumes a
    // multi-selection is all on the same map.
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
  } catch (error) {
    return handleAblError(res, error, [], { message: "Server error", logLabel: "deleteManyNodes" });
  }
};
