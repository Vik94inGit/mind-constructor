import { z } from "zod";
import { getMapByIdDao } from "../dao/mapsDao.js";
import {
  deleteDraftDao,
  getDraftDao,
  getMapViewStateDao,
  getUserStateDao,
  saveDraftDao,
  updateMapViewStateDao,
  updatePreferencesDao,
} from "../dao/userStateDao.js";
import { DRAFT_KINDS, LANGUAGES, READING_MODES, THEMES, ZONE_MODES } from "../models/UserState.js";
import type { DraftKind } from "../models/UserState.js";
import { ValidationError, parseOrThrow } from "./errors.js";

export class MapNotFoundError extends Error {}
export class UnknownDraftError extends Error {}

/** A draft bigger than this (as JSON) is refused — a draft is text someone typed, not a file. */
export const MAX_DRAFT_BYTES = 256 * 1024;
/** Most entries one per-node / per-zone setting may hold. */
const MAX_ENTRIES = 5000;

const idRecord = <T extends z.ZodTypeAny>(value: T) =>
  z
    .record(z.string().max(64), value)
    .refine((r) => Object.keys(r).length <= MAX_ENTRIES, `at most ${MAX_ENTRIES} entries`);

const preferencesSchema = z
  .object({
    theme: z.enum(THEMES),
    language: z.enum(LANGUAGES),
    readingMode: z.enum(READING_MODES),
    compactView: z.boolean(),
  })
  .partial()
  .strict();

const COORD_LIMIT = 100000;
const mapViewSchema = z
  .object({
    nodeDisplay: idRecord(z.enum(READING_MODES)),
    zoneDisplay: idRecord(z.enum(ZONE_MODES)),
    cardFills: idRecord(z.string().regex(/^#[0-9a-fA-F]{6}$/, "a fill is a #rrggbb color")),
    blockLocks: z.array(z.string().max(64)).max(MAX_ENTRIES),
    center: z.object({ x: z.number().min(-COORD_LIMIT).max(COORD_LIMIT), y: z.number().min(-COORD_LIMIT).max(COORD_LIMIT) }).nullable(),
    selectedNodeId: z.string().max(64).nullable(),
  })
  .partial()
  .strict();

const draftSchema = z.object({
  data: z.unknown().refine((d) => d !== undefined, "data is required"),
  clientUpdatedAt: z.number().int().nonnegative(),
});

function draftKind(kind: string): DraftKind {
  if (!(DRAFT_KINDS as readonly string[]).includes(kind)) throw new UnknownDraftError();
  return kind as DraftKind;
}

/** Everything that applies across the user's maps: preferences and the map they were last on. */
export const getUserStateAbl = async (userId: string) => {
  const state = await getUserStateDao(userId);
  return { preferences: state?.preferences ?? {}, lastMapId: state?.lastMapId ?? null };
};

export const updatePreferencesAbl = async (input: unknown, userId: string) => {
  const preferences = parseOrThrow(preferencesSchema, input);
  const state = await updatePreferencesDao(userId, preferences);
  return state?.preferences ?? {};
};

// Only for a map the user can open — the same membership check as loading it.
async function requireMap(mapId: string, userId: string) {
  const map = await getMapByIdDao(mapId, userId);
  if (!map) throw new MapNotFoundError();
}

export const getMapViewStateAbl = async (mapId: string, userId: string) => {
  await requireMap(mapId, userId);
  return await getMapViewStateDao(userId, mapId);
};

export const updateMapViewStateAbl = async (mapId: string, input: unknown, userId: string) => {
  const fields = parseOrThrow(mapViewSchema, input);
  await requireMap(mapId, userId);
  return await updateMapViewStateDao(userId, mapId, fields);
};

export const getDraftAbl = async (kind: string, userId: string) => {
  const draft = await getDraftDao(userId, draftKind(kind));
  return draft ? { data: draft.data, clientUpdatedAt: draft.clientUpdatedAt } : null;
};

export const saveDraftAbl = async (kind: string, input: unknown, userId: string) => {
  const k = draftKind(kind);
  const { data, clientUpdatedAt } = parseOrThrow(draftSchema, input);
  if (JSON.stringify(data).length > MAX_DRAFT_BYTES) {
    throw new ValidationError(`a draft can be at most ${MAX_DRAFT_BYTES / 1024} KB`);
  }
  await saveDraftDao(userId, k, data, clientUpdatedAt);
  return { clientUpdatedAt };
};

export const deleteDraftAbl = async (kind: string, userId: string) => {
  await deleteDraftDao(userId, draftKind(kind));
};
