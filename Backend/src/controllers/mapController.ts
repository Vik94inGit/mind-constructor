import { Request, Response } from "express";
import {
  deleteMapDao,
  getNodesByMapDao,
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
import { ValidationError } from "../abl/errors.js";
import { broadcastToMap } from "../realtime/io.js";

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
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("createMap error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
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
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error instanceof ColorTakenError) {
      return res.status(409).json({
        success: false,
        error: "That color is already taken by another member of this map",
      });
    }
    console.error("setMyMapColor error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
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
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("inviteUserToMap error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
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
    console.error("getMapById error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
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
    console.error("getAllMaps error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
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
    console.error("getMapSummary error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
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
    console.error("getNodesByMap error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
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

    return res.status(200).json({ success: true, map: updatedMap });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("updateMap error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
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
    console.error("deleteMap error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
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
    console.error("getEdgesByMap error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
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
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("getMapAttackIndicators error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
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
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error instanceof CircleNotFoundError) {
      return res.status(404).json({
        success: false,
        error: "Circle not found — the graph may have changed since it was computed",
      });
    }
    console.error("selectMapCircle error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
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
    console.error("deselectMapCircle error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
};
