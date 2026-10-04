import { Draft, MapViewState, UserState } from "../models/UserState.js";
import type { DraftKind } from "../models/UserState.js";

export const getUserStateDao = async (userId: string) => {
  return await UserState.findOne({ userId }).lean();
};

// Only the given preference fields change; the rest stay as they were.
export const updatePreferencesDao = async (userId: string, preferences: Record<string, unknown>) => {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(preferences)) set[`preferences.${key}`] = value;
  return await UserState.findOneAndUpdate({ userId }, { $set: set }, { upsert: true, new: true }).lean();
};

export const getMapViewStateDao = async (userId: string, mapId: string) => {
  return await MapViewState.findOne({ userId, mapId });
};

// Saves the given fields of the user's view of the map, and remembers the map
// as the one they were last on.
export const updateMapViewStateDao = async (userId: string, mapId: string, fields: Record<string, unknown>) => {
  const [view] = await Promise.all([
    MapViewState.findOneAndUpdate({ userId, mapId }, { $set: fields }, { upsert: true, new: true }),
    UserState.updateOne({ userId }, { $set: { lastMapId: mapId } }, { upsert: true }),
  ]);
  return view;
};

// A deleted map leaves everyone's view of it, and stops being anyone's last map.
export const removeMapViewStatesDao = async (mapId: string) => {
  await Promise.all([
    MapViewState.deleteMany({ mapId }),
    UserState.updateMany({ lastMapId: mapId }, { $set: { lastMapId: null } }),
  ]);
};

export const getDraftDao = async (userId: string, kind: DraftKind) => {
  return await Draft.findOne({ userId, kind }).lean();
};

export const saveDraftDao = async (userId: string, kind: DraftKind, data: unknown, clientUpdatedAt: number) => {
  return await Draft.findOneAndUpdate(
    { userId, kind },
    { $set: { data, clientUpdatedAt } },
    { upsert: true, new: true },
  ).lean();
};

export const deleteDraftDao = async (userId: string, kind: DraftKind) => {
  await Draft.deleteOne({ userId, kind });
};
