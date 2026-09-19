import { Request, Response } from "express";
import {
  deleteMapDao,
  getNodesByMapDao,
  getNodesTextDao,
  getMapByIdDao,
  getMapSummaryDao,
} from "../dao/mapsDao.js";
import { getEdgesByMapDao } from "../dao/edgeDao.js";
import {
  createMapAbl,
  updateMapAbl,
  inviteUserToMapAbl,
  setMapColorAbl,
  getMapsAbl,
  ColorTakenError,
} from "../abl/mapAbl.js";
import {
  selectCircleAbl,
  deselectCircleAbl,
  CircleNotFoundError,
} from "../abl/circleAbl.js";
import { computeAttackIndicatorsAbl } from "../abl/attackIndicatorAbl.js";
import { broadcastToMap } from "../realtime/io.js";
import { handleAblError } from "./errorHandling.js";

// ========== CREATE MAP ==========
export const createMap = async (req: Request, res: Response) => {
  try {
    // owner comes from the authenticated user
    const ownerId = req.user?._id;

    if (!ownerId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }

    const newMap = await createMapAbl(req.body, ownerId);

    return res.status(201).json(newMap);
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "createMap",
    });
  }
};

// ========== SET MY COLOR ON THIS MAP ==========
// Called by the owner right after creating a map is covered by createMap's
// ownerColor — this is for choosing/changing a color later, and for anyone
// who was invited rather than the one who created the map.
export const setMyMapColor = async (req: Request, res: Response) => {
  try {
    const { mapId } = req.params;
    const resolvedMapId = Array.isArray(mapId) ? mapId[0] : mapId;
    const userId = req.user?._id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }

    const map = await setMapColorAbl(resolvedMapId, userId, req.body);

    if (!map) {
      return res.status(404).json({ success: false, error: "Map not found" });
    }

    return res.status(200).json({ success: true, map });
  } catch (error) {
    return handleAblError(
      res,
      error,
      [
        [
          ColorTakenError,
          409,
          "That color is already taken by another member of this map",
        ],
      ],
      { message: "Internal Server Error", logLabel: "setMyMapColor" },
    );
  }
};

// ========== INVITE USER ==========
export const inviteUserToMap = async (req: Request, res: Response) => {
  try {
    const { mapId } = req.params;
    const resolvedMapId = Array.isArray(mapId) ? mapId[0] : mapId;
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }

    const updatedMap = await inviteUserToMapAbl(resolvedMapId, req.body, currentUserId);

    if (!updatedMap) {
      return res.status(404).json({ success: false, error: "Map not found" });
    }

    return res.status(200).json({
      success: true,
      map: updatedMap,
    });
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Server error",
      logLabel: "inviteUserToMap",
    });
  }
};

export const getMapById = async (req: Request, res: Response) => {
  try {
    const { mapId } = req.params;
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }
    const resolvedMapId = Array.isArray(mapId) ? mapId[0] : mapId;

    const map = await getMapByIdDao(resolvedMapId, currentUserId);

    if (!map) {
      return res.status(404).json({ success: false, error: "Map not found" });
    }

    return res.status(200).json({ success: true, map });
  } catch (error) {
    return handleAblError(res, error, [], { message: "Server error", logLabel: "getMapById" });
  }
};
// C

// GET /api/?filter=owned — filter comes from the query string, not the body:
// GET requests carrying a body have no defined meaning in HTTP and plenty of
// real infrastructure (proxies, CDNs, some HTTP clients) silently drops it.
export const getAllMaps = async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }

    const maps = await getMapsAbl(currentUserId, req.query.filter);
    return res.status(200).json({ success: true, maps });
  } catch (error) {
    return handleAblError(res, error, [], { message: "Server error", logLabel: "getAllMaps" });
  }
};

// map.controller.ts

export const getMapSummary = async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }
    const { mapId } = req.params;
    const resolvedMapId = Array.isArray(mapId) ? mapId[0] : mapId;

    const summary = await getMapSummaryDao(resolvedMapId, currentUserId);

    if (!summary) {
      return res.status(404).json({ success: false, error: "Map not found" });
    }

    // summary already carries the public `mapId` — no need to echo it back
    // separately (and definitely not under the key `_id`, which it isn't).
    return res.status(200).json({
      success: true,
      ...summary,
    });
  } catch (error) {
    return handleAblError(res, error, [], { message: "Server error", logLabel: "getMapSummary" });
  }
};

export const getNodesByMap = async (req: Request, res: Response) => {
  try {
    const { mapId } = req.params;
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }
    const resolvedMapId = Array.isArray(mapId) ? mapId[0] : mapId;
    const nodes = await getNodesByMapDao(resolvedMapId, currentUserId);

    if (nodes === null) {
      return res.status(404).json({ success: false, error: "Map not found" });
    }

    return res.status(200).json(nodes);
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "getNodesByMap",
    });
  }
};

// Backfills the `text` getNodesByMap's own listing deliberately omits (see
// getNodesByMapDao's doc comment) — POST, not GET, since the id list can be
// arbitrarily long and doesn't belong in a query string. Body: { nodeIds }.
export const getNodesText = async (req: Request, res: Response) => {
  try {
    const { mapId } = req.params;
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }
    const resolvedMapId = Array.isArray(mapId) ? mapId[0] : mapId;
    const { nodeIds } = req.body as { nodeIds?: unknown };
    if (!Array.isArray(nodeIds) || nodeIds.length === 0 || !nodeIds.every((id) => typeof id === "string")) {
      return res
        .status(400)
        .json({ success: false, error: "nodeIds must be a non-empty array of strings" });
    }

    const text = await getNodesTextDao(resolvedMapId, currentUserId, nodeIds);
    if (text === null) {
      return res.status(404).json({ success: false, error: "Map not found" });
    }

    return res.status(200).json({ success: true, text });
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "getNodesText",
    });
  }
};

export const updateMap = async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }
    const { mapId } = req.params;
    const resolvedMapId = Array.isArray(mapId) ? mapId[0] : mapId;

    const updatedMap = await updateMapAbl(resolvedMapId, currentUserId, req.body);

    if (!updatedMap) {
      return res.status(404).json({ success: false, error: "Map not found" });
    }

    broadcastToMap(resolvedMapId, "map:updated", { map: updatedMap });

    return res.status(200).json({ success: true, map: updatedMap });
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "updateMap",
    });
  }
};

export const deleteMap = async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }
    const { mapId } = req.params;
    const resolvedMapId = Array.isArray(mapId) ? mapId[0] : mapId;
    const result = await deleteMapDao(resolvedMapId, currentUserId);

    return res.status(200).json({
      success: true,
      message: `Deleted map and related nodes`,
      result,
    });
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "deleteMap",
    });
  }
};

// ========== LIST EDGES ==========
export const getEdgesByMap = async (req: Request, res: Response) => {
  try {
    const { mapId } = req.params;
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }
    const resolvedMapId = Array.isArray(mapId) ? mapId[0] : mapId;
    const edges = await getEdgesByMapDao(resolvedMapId, currentUserId);

    if (edges === null) {
      return res.status(404).json({ success: false, error: "Map not found" });
    }

    return res.status(200).json(edges);
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "getEdgesByMap",
    });
  }
};

// ========== ATTACK INDICATORS (computed, not persisted) ==========
export const getMapAttackIndicators = async (req: Request, res: Response) => {
  try {
    const { mapId } = req.params;
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }
    const resolvedMapId = Array.isArray(mapId) ? mapId[0] : mapId;

    const result = await computeAttackIndicatorsAbl(resolvedMapId, currentUserId, req.query);

    if (!result) {
      return res.status(404).json({ success: false, error: "Map not found" });
    }

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "getMapAttackIndicators",
    });
  }
};

// ========== SELECT A CIRCLE ==========
// Locks the circle's member nodes (a frontend layout/physics loop should
// treat that as "don't move me") and remembers the choice on the Map.
export const selectMapCircle = async (req: Request, res: Response) => {
  try {
    const { mapId } = req.params;
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }
    const resolvedMapId = Array.isArray(mapId) ? mapId[0] : mapId;

    const result = await selectCircleAbl(resolvedMapId, currentUserId, req.body);

    if (!result) {
      return res.status(404).json({ success: false, error: "Map not found" });
    }

    broadcastToMap(resolvedMapId, "circle:selected", { selectedCircle: result.selectedCircle });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleAblError(
      res,
      error,
      [
        [
          CircleNotFoundError,
          404,
          "Circle not found — the graph may have changed since it was computed",
        ],
      ],
      { message: "Internal Server Error", logLabel: "selectMapCircle" },
    );
  }
};

// ========== DESELECT THE CIRCLE ==========
export const deselectMapCircle = async (req: Request, res: Response) => {
  try {
    const { mapId } = req.params;
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }
    const resolvedMapId = Array.isArray(mapId) ? mapId[0] : mapId;

    const result = await deselectCircleAbl(resolvedMapId, currentUserId);

    if (!result) {
      return res.status(404).json({ success: false, error: "Map not found" });
    }

    broadcastToMap(resolvedMapId, "circle:deselected", { selectedCircle: null });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "deselectMapCircle",
    });
  }
};
