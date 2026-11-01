import { getLinesByMapDao } from "../dao/lineDao.js";
import { broadcastToMap } from "../realtime/io.js";
import {
  createLineAbl,
  deleteLineAbl,
  MapNotFoundError,
  LineNotFoundError,
  NotLineDeleterError,
} from "../abl/lineAbl.js";
import { authed, fail, param } from "./errorHandling.js";

export const createLine = authed<{ mapId: string }>(
  "createLine",
  async (req, res, userId) => {
    const { mapId } = req.params;
    const line = await createLineAbl(req.body, mapId, userId);
    broadcastToMap(mapId, "line:created", line);
    return res.status(201).json(line);
  },
  { errors: [[MapNotFoundError, 404, "Map not found"]], message: "Failed to create line" },
);

export const deleteLine = authed<{ lineId: string }>(
  "deleteLine",
  async (req, res, userId) => {
    const { lineId } = req.params;
    const { publicMapId } = await deleteLineAbl(lineId, userId);
    if (publicMapId) broadcastToMap(publicMapId, "line:deleted", { lineId });
    return res.status(200).json({ success: true, deletedId: lineId });
  },
  {
    errors: [
      [LineNotFoundError, 404, "Line not found"],
      [NotLineDeleterError, 403, "Only the person who drew a line, or the map's owner, can delete it"],
    ],
    message: "Failed to delete line",
  },
);

// ========== LIST LINES ==========
export const getLinesByMap = authed("getLinesByMap", async (req, res, userId) => {
  const lines = await getLinesByMapDao(param(req, "mapId"), userId);
  if (lines === null) return fail(res, 404, "Map not found");
  return res.status(200).json(lines);
});
