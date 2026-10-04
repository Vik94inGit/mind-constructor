import { apiRequest } from "./client";
import type { ReadingMode } from "../utils/readingMode";
import type { NodeDisplay } from "../utils/nodeDisplay";
import type { ZoneDisplay } from "../utils/zoneDisplay";
import type { CardFills } from "../utils/cardFill";

// The signed-in user's own state on the server (Backend: /api/state), so they
// pick up on any device where they left off.

export interface Preferences {
  theme?: "light" | "dark";
  language?: "en" | "cs" | "uk" | "ru";
  readingMode?: ReadingMode;
  compactView?: boolean;
}

export interface MapViewState {
  nodeDisplay?: NodeDisplay;
  zoneDisplay?: ZoneDisplay;
  cardFills?: CardFills;
  /** Locked puzzle pieces' nodeIds. */
  blockLocks?: string[];
  /** The canvas point that was in the middle of the screen. */
  center?: { x: number; y: number } | null;
  selectedNodeId?: string | null;
}

export type DraftKind = "think" | "textSplit";

export async function getUserState(): Promise<{ preferences: Preferences; lastMapId: string | null }> {
  const res = await apiRequest<{ success: boolean; preferences: Preferences; lastMapId: string | null }>("/api/state");
  return { preferences: res.preferences ?? {}, lastMapId: res.lastMapId ?? null };
}

export async function savePreferences(preferences: Preferences): Promise<Preferences> {
  const res = await apiRequest<{ success: boolean; preferences: Preferences }>("/api/state/preferences", {
    method: "PATCH",
    body: preferences,
  });
  return res.preferences;
}

export async function getMapViewState(mapId: string): Promise<MapViewState | null> {
  const res = await apiRequest<{ success: boolean; view: MapViewState | null }>(`/api/state/maps/${mapId}`);
  return res.view;
}

/** Saves the given fields (an empty object just marks the map as the last one opened). */
export async function saveMapViewState(mapId: string, fields: MapViewState): Promise<void> {
  await apiRequest(`/api/state/maps/${mapId}`, { method: "PATCH", body: fields });
}

export async function getDraft(kind: DraftKind): Promise<{ data: unknown; clientUpdatedAt: number } | null> {
  const res = await apiRequest<{ success: boolean; draft: { data: unknown; clientUpdatedAt: number } | null }>(
    `/api/state/drafts/${kind}`,
  );
  return res.draft;
}

export async function saveDraft(kind: DraftKind, data: unknown, clientUpdatedAt: number): Promise<void> {
  await apiRequest(`/api/state/drafts/${kind}`, { method: "PATCH", body: { data, clientUpdatedAt } });
}

export async function deleteDraft(kind: DraftKind): Promise<void> {
  await apiRequest(`/api/state/drafts/${kind}`, { method: "DELETE" });
}
