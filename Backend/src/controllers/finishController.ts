import { Request, Response } from "express";
import {
  agreeToFinishAbl,
  finishMapAbl,
  FinishNotAllowedError,
  getFinishStatusAbl,
  listMapAttacksAbl,
  MapNotFoundError,
  NotMapOwnerError,
  OwnerCannotAgreeError,
  reopenMapAbl,
} from "../abl/finishAbl.js";
import { listMapHistoryAbl, MapNotFoundError as HistoryMapNotFoundError } from "../abl/historyAbl.js";
import { broadcastToMap } from "../realtime/io.js";
import { handleAblError, type ErrorMapping } from "./errorHandling.js";

// Finishing a discussion — see abl/finishAbl.ts.
const MAPPINGS: ErrorMapping[] = [
  [MapNotFoundError, 404, "Map not found"],
  [HistoryMapNotFoundError, 404, "Map not found"],
  [NotMapOwnerError, 403, "Only the map's owner can finish or reopen the discussion"],
  [OwnerCannotAgreeError, 400, "The owner finishes the discussion; agreeing is for the other members"],
  [FinishNotAllowedError, 409, (e) => ({ error: e.message, reason: "lastWordIsYours" })],
];

const mapIdOf = (req: Request) => {
  const { mapId } = req.params;
  return Array.isArray(mapId) ? mapId[0] : mapId;
};

function handler(label: string, run: (mapId: string, userId: string, req: Request) => Promise<unknown>, broadcast: boolean) {
  return async (req: Request, res: Response) => {
    try {
      const userId = req.user?._id;
      if (!userId) return res.status(401).json({ success: false, error: "Not authenticated" });
      const mapId = mapIdOf(req);
      const result = await run(mapId, userId, req);
      if (broadcast) {
        broadcastToMap(mapId, "map:updated", { map: result });
        return res.status(200).json({ success: true, map: result });
      }
      return res.status(200).json({ success: true, ...(result as object) });
    } catch (error) {
      return handleAblError(res, error, MAPPINGS, { message: "Server error", logLabel: label });
    }
  };
}

export const getFinishStatus = handler("getFinishStatus", (mapId, userId) => getFinishStatusAbl(mapId, userId), false);
export const finishMap = handler("finishMap", (mapId, userId) => finishMapAbl(mapId, userId), true);
export const reopenMap = handler("reopenMap", (mapId, userId) => reopenMapAbl(mapId, userId), true);
export const agreeToFinish = handler("agreeToFinish", (mapId, userId, req) => agreeToFinishAbl(mapId, userId, req.body), true);
export const getMapAttacks = handler(
  "getMapAttacks",
  async (mapId, userId) => ({ attacks: await listMapAttacksAbl(mapId, userId) }),
  false,
);

// The discussion's change history — see abl/historyAbl.ts.
export const getMapHistory = handler(
  "getMapHistory",
  async (mapId, userId) => ({ revisions: await listMapHistoryAbl(mapId, userId) }),
  false,
);
