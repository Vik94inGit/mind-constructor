import { Request, Response } from "express";
import { deleteEdgeDao } from "../dao/edgeDao.js";
import { findPublicMapIdDao } from "../dao/mapsDao.js";
import { broadcastToMap } from "../realtime/io.js";
import {
  createEdgeAbl,
  MapNotFoundError,
  NodeNotFoundError,
  SelfLoopError,
  CrossMapEdgeError,
  NodeNotOwnedError,
} from "../abl/edgeAbl.js";
import { ValidationError } from "../abl/errors.js";

interface edgeIdParams {
  edgeId: string;
}

export const createEdge = async (req: Request<{ mapId: string }>, res: Response) => {
  try {
    const { mapId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }

    const edge = await createEdgeAbl(req.body, mapId, userId);

    broadcastToMap(mapId, "edge:created", edge);
    return res.status(201).json(edge);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error instanceof SelfLoopError) {
      return res.status(400).json({
        success: false,
        error: "fromNodeId and toNodeId can't be the same node",
      });
    }
    if (error instanceof NodeNotFoundError) {
      return res.status(404).json({ success: false, error: "Node not found" });
    }
    if (error instanceof CrossMapEdgeError) {
      return res.status(400).json({
        success: false,
        error: "Both nodes must belong to the same map",
      });
    }
    if (error instanceof NodeNotOwnedError) {
      return res.status(403).json({
        success: false,
        error: "You can only link nodes you created",
      });
    }
    if (error instanceof MapNotFoundError) {
      return res.status(404).json({ success: false, error: "Map not found" });
    }
    console.error("createEdge error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to create edge" });
  }
};

export const deleteEdge = async (req: Request<edgeIdParams>, res: Response) => {
  try {
    const { edgeId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }

    const edge = await deleteEdgeDao(edgeId, userId);

    if (!edge) {
      return res.status(404).json({ success: false, error: "Edge not found" });
    }

    const publicMapId = await findPublicMapIdDao(edge.mapId);
    if (publicMapId) broadcastToMap(publicMapId, "edge:deleted", { edgeId });

    return res.status(200).json({ success: true, deletedId: edgeId });
  } catch (error) {
    console.error("deleteEdge error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};
