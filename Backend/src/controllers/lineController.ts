import { Request, Response } from "express";
import { getLinesByMapDao } from "../dao/lineDao.js";
import { broadcastToMap } from "../realtime/io.js";
import {
  createLineAbl,
  deleteLineAbl,
  MapNotFoundError,
  LineNotFoundError,
  NotLineDeleterError,
} from "../abl/lineAbl.js";
import { handleAblError } from "./errorHandling.js";

export const createLine = async (req: Request<{ mapId: string }>, res: Response) => {
  try {
    const { mapId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }

    const line = await createLineAbl(req.body, mapId, userId);

    broadcastToMap(mapId, "line:created", line);
    return res.status(201).json(line);
  } catch (error) {
    return handleAblError(res, error, [[MapNotFoundError, 404, "Map not found"]], {
      message: "Failed to create line",
      logLabel: "createLine",
    });
  }
};

export const deleteLine = async (req: Request<{ lineId: string }>, res: Response) => {
  try {
    const { lineId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }

    const { publicMapId } = await deleteLineAbl(lineId, userId);

    if (publicMapId) broadcastToMap(publicMapId, "line:deleted", { lineId });
    return res.status(200).json({ success: true, deletedId: lineId });
  } catch (error) {
    return handleAblError(
      res,
      error,
      [
        [LineNotFoundError, 404, "Line not found"],
        [NotLineDeleterError, 403, "Only the person who drew a line, or the map's owner, can delete it"],
      ],
      { message: "Failed to delete line", logLabel: "deleteLine" },
    );
  }
};

// ========== LIST LINES ==========
export const getLinesByMap = async (req: Request, res: Response) => {
  try {
    const { mapId } = req.params;
    const currentUserId = req.user?._id;
    if (!currentUserId) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }
    const resolvedMapId = Array.isArray(mapId) ? mapId[0] : mapId;
    const lines = await getLinesByMapDao(resolvedMapId, currentUserId);

    if (lines === null) {
      return res.status(404).json({ success: false, error: "Map not found" });
    }

    return res.status(200).json(lines);
  } catch (error) {
    return handleAblError(res, error, [], {
      message: "Internal Server Error",
      logLabel: "getLinesByMap",
    });
  }
};
