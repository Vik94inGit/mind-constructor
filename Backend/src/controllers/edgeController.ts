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
import { authed, fail, publicMapIdOf } from "./errorHandling.js";

export const createEdge = authed<{ mapId: string }>(
  "createEdge",
  async (req, res, userId) => {
    const { mapId } = req.params;
    const edge = await createEdgeAbl(req.body, mapId, userId);
    broadcastToMap(mapId, "edge:created", edge);
    return res.status(201).json(edge);
  },
  {
    errors: [
      [SelfLoopError, 400, "fromNodeId and toNodeId can't be the same node"],
      [NodeNotFoundError, 404, "Node not found"],
      [CrossMapEdgeError, 400, "Both nodes must belong to the same map"],
      [NodeNotOwnedError, 403, "You can only link nodes you created"],
      [MapNotFoundError, 404, "Map not found"],
    ],
    message: "Failed to create edge",
  },
);

export const deleteEdge = authed<{ edgeId: string }>(
  "deleteEdge",
  async (req, res, userId) => {
    const { edgeId } = req.params;
    const edge = await deleteEdgeDao(edgeId, userId);
    if (!edge) return fail(res, 404, "Edge not found");

    const publicMapId = publicMapIdOf(edge);
    if (publicMapId) broadcastToMap(publicMapId, "edge:deleted", { edgeId });
    return res.status(200).json({ success: true, deletedId: edgeId });
  },
  { message: "Server error" },
);
