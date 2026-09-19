import { Request, Response } from "express";
import { deleteEdgeDao } from "../dao/edgeDao.js";
import { broadcastToMap } from "../realtime/io.js";
import {
  createEdgeAbl,
  MapNotFoundError,
  NodeNotFoundError,
  SelfLoopError,
  CrossMapEdgeError,
  NodeNotOwnedError,
} from "../abl/edgeAbl.js";
import { handleAblError } from "./errorHandling.js";

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
    return handleAblError(
      res,
      error,
      [
        [SelfLoopError, 400, "fromNodeId and toNodeId can't be the same node"],
        [NodeNotFoundError, 404, "Node not found"],
        [CrossMapEdgeError, 400, "Both nodes must belong to the same map"],
        [NodeNotOwnedError, 403, "You can only link nodes you created"],
        [MapNotFoundError, 404, "Map not found"],
      ],
      { message: "Failed to create edge", logLabel: "createEdge" },
    );
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

    const publicMapId = (edge.mapId as unknown as { mapId?: string } | null)?.mapId ?? null;
    if (publicMapId) broadcastToMap(publicMapId, "edge:deleted", { edgeId });

    return res.status(200).json({ success: true, deletedId: edgeId });
  } catch (error) {
    return handleAblError(res, error, [], { message: "Server error", logLabel: "deleteEdge" });
  }
};
