import { Request, Response } from "express";

import { findNodeDao, deleteNodeDao } from "../dao/nodeDao.js";
import { findPublicMapIdDao } from "../dao/mapsDao.js";
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
import { ValidationError } from "../abl/errors.js";
import { WEAPONS, type WeaponKey } from "../models/Attack.js";

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
    console.error("getNodeById error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
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
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    // Thrown when the map doesn't exist, or the caller isn't a member of it.
    if (error instanceof MapNotFoundError) {
      return res.status(404).json({ success: false, error: "Map not found" });
    }
    if (error instanceof ParentNotFoundError) {
      return res.status(404).json({ success: false, error: "Parent node not found" });
    }
    if (error instanceof CrossMapParentError) {
      return res.status(400).json({
        success: false,
        error: "Parent node must belong to the same map",
      });
    }
    if (error instanceof ParentNotOwnedError) {
      return res.status(403).json({
        success: false,
        error: "You can only branch off nodes you created",
      });
    }
    console.error("createNode error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to create Node" });
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

    const publicMapId = await findPublicMapIdDao(node.mapId);
    if (publicMapId) broadcastToMap(publicMapId, "node:updated", node);

    return res.status(200).json(node);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error instanceof ParentNotFoundError) {
      return res.status(404).json({ success: false, error: "Parent node not found" });
    }
    if (error instanceof CrossMapParentError) {
      return res.status(400).json({
        success: false,
        error: "Parent node must belong to the same map",
      });
    }
    if (error instanceof ParentNotOwnedError) {
      return res.status(403).json({
        success: false,
        error: "You can only branch off nodes you created",
      });
    }
    if (error instanceof SelfParentError) {
      return res.status(400).json({ success: false, error: "A node can't be its own parent" });
    }
    console.error("updateNode error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to update node" });
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

    const publicMapId = result.node ? await findPublicMapIdDao(result.node.mapId) : null;
    if (publicMapId) broadcastToMap(publicMapId, "node:attacked", result);

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error instanceof CannotAttackOwnNodeError) {
      return res
        .status(400)
        .json({ success: false, error: "You can't attack your own node" });
    }
    if (error instanceof CanOnlyAttackOwnNodeError) {
      return res.status(400).json({
        success: false,
        error: "Discussion mode: you can only attack your own nodes",
      });
    }
    if (error instanceof CannotRetaliateError) {
      return res.status(403).json({
        success: false,
        error: "You can only retaliate against an attack that targeted your own node",
      });
    }
    if (error instanceof NodeAlreadyDefeatedError) {
      return res.status(400).json({
        success: false,
        error: "This node has already been defeated",
      });
    }
    if (error instanceof WeaponOnCooldownError) {
      return res.status(429).json({
        success: false,
        error: "That weapon is still on cooldown",
        readyAt: new Date(error.readyAt).toISOString(),
      });
    }
    console.error("attackNode error:", error);
    return res.status(500).json({ success: false, error: "Attack failed" });
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

    const publicMapId = await findPublicMapIdDao(result.protectionNode.mapId);
    if (publicMapId) broadcastToMap(publicMapId, "node:protected", result);

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error instanceof NotNodeOwnerError) {
      return res.status(403).json({
        success: false,
        error: "Only this node's own owner can add a protection node to it",
      });
    }
    console.error("protectNode error:", error);
    return res.status(500).json({ success: false, error: "Protect failed" });
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

    const publicMapId = result.container ? await findPublicMapIdDao(result.container.mapId) : null;
    if (publicMapId) broadcastToMap(publicMapId, "node:packed", result);

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error instanceof PackContainerNotFoundError) {
      return res.status(404).json({ success: false, error: "Container node not found" });
    }
    if (error instanceof PackNotOwnedError) {
      return res.status(403).json({
        success: false,
        error: "You can only pack nodes into a container you created",
      });
    }
    if (error instanceof PackMemberNotFoundError) {
      return res.status(404).json({ success: false, error: "One of the picked nodes was not found" });
    }
    if (error instanceof PackMemberNotEligibleError) {
      return res.status(400).json({
        success: false,
        error: "A picked node isn't linked (by branch or Link) to the container",
      });
    }
    console.error("packNode error:", error);
    return res.status(500).json({ success: false, error: "Pack failed" });
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

    const publicMapId = await findPublicMapIdDao(node.mapId);
    if (publicMapId) broadcastToMap(publicMapId, "node:unpacked", { node });

    return res.status(200).json({ success: true, node });
  } catch (error) {
    console.error("unpackNode error:", error);
    return res.status(500).json({ success: false, error: "Unpack failed" });
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
    console.error("getNodeAttackHistory error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
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

    const node = await deleteNodeDao(nodeId, userId);

    if (!node) {
      return res
        .status(404)
        .json({ success: false, error: "Node not found" });
    }

    // Deleting a node also cascades to edges touching it, children's
    // parentId, and weapon nodes aimed at it (see deleteNodeDao) — those
    // side effects aren't individually broadcast, so other open tabs only
    // pick them up on next reload. The node itself goes out live.
    const publicMapId = await findPublicMapIdDao(node.mapId);
    if (publicMapId) broadcastToMap(publicMapId, "node:deleted", { nodeId });

    return res.status(200).json({ success: true, deletedId: nodeId });
  } catch (error) {
    console.error("deleteNode error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};
