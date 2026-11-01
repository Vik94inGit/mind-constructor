import type { Request } from "express";
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
import { authed, param, type ErrorMapping } from "./errorHandling.js";

// Finishing a discussion — see abl/finishAbl.ts.
const MAPPINGS: ErrorMapping[] = [
  [MapNotFoundError, 404, "Map not found"],
  [HistoryMapNotFoundError, 404, "Map not found"],
  [NotMapOwnerError, 403, "Only the map's owner can finish or reopen the discussion"],
  [OwnerCannotAgreeError, 400, "The owner finishes the discussion; agreeing is for the other members"],
  [FinishNotAllowedError, 409, (e) => ({ error: e.message, reason: "lastWordIsYours" })],
];

function handler(label: string, run: (mapId: string, userId: string, req: Request) => Promise<unknown>, broadcast: boolean) {
  return authed(
    label,
    async (req, res, userId) => {
      const mapId = param(req, "mapId");
      const result = await run(mapId, userId, req);
      if (!broadcast) return res.status(200).json({ success: true, ...(result as object) });
      broadcastToMap(mapId, "map:updated", { map: result });
      return res.status(200).json({ success: true, map: result });
    },
    { errors: MAPPINGS, message: "Server error" },
  );
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
