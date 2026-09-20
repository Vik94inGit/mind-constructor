import { z } from "zod";
import { MAX_LINE_POINTS } from "../models/Line.js";
import { getMapByIdDao } from "../dao/mapsDao.js";
import { createLineMutationDao, findLineByPublicIdDao, deleteLineByIdDao } from "../dao/lineDao.js";
import { parseOrThrow } from "./errors.js";

export class MapNotFoundError extends Error {}
export class LineNotFoundError extends Error {}
export class NotLineDeleterError extends Error {}

// Canvas coordinates. The canvas itself is a couple of thousand units across;
// the wide bound is only there to reject garbage, not to police placement
// (the client only offers free spots to click).
const COORD_LIMIT = 10000;
const pointSchema = z.object({
  x: z.number().min(-COORD_LIMIT).max(COORD_LIMIT),
  y: z.number().min(-COORD_LIMIT).max(COORD_LIMIT),
});

const createLineSchema = z.object({
  points: z
    .array(pointSchema)
    .min(2, "a line needs at least 2 points")
    .max(MAX_LINE_POINTS, `a line can have at most ${MAX_LINE_POINTS} points`),
});

// Any member of the map may draw a line on it.
export const createLineAbl = async (input: unknown, publicMapId: string, userId: string) => {
  const { points } = parseOrThrow(createLineSchema, input);

  const map = await getMapByIdDao(publicMapId, userId);
  if (!map) throw new MapNotFoundError();

  return await createLineMutationDao({ mapId: map._id, userId, points });
};

// The line's creator may delete it, and so may the map's owner (who is
// responsible for what is drawn on their map).
export const deleteLineAbl = async (publicLineId: string, userId: string) => {
  const line = await findLineByPublicIdDao(publicLineId);
  if (!line) throw new LineNotFoundError();

  const map = line.mapId as unknown as { mapId: string; ownerId: unknown } | null;
  const isCreator = line.userId.toString() === userId.toString();
  const isMapOwner = !!map && String(map.ownerId) === userId.toString();
  if (!isCreator && !isMapOwner) throw new NotLineDeleterError();

  await deleteLineByIdDao(line._id);
  return { lineId: publicLineId, publicMapId: map?.mapId ?? null };
};
