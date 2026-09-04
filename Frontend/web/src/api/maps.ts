import { apiRequest } from "./client";
import type { MapDoc, MapTemplate, NodeType, SelectedCircle } from "../types";

export type MapFilter = "all" | "owned" | "shared";

export async function listMaps(filter: MapFilter = "all"): Promise<MapDoc[]> {
  const res = await apiRequest<{ success: boolean; maps: MapDoc[] }>(`/api/?filter=${filter}`);
  return res.maps;
}

export async function getMap(mapId: string): Promise<MapDoc> {
  const res = await apiRequest<{ success: boolean; map: MapDoc }>(`/api/${mapId}`);
  return res.map;
}

export async function createMap(input: {
  name: string;
  ownerColor: string;
  color?: string;
  // Omitted or "blank" — today's only behavior — seeds nothing.
  template?: MapTemplate;
}): Promise<MapDoc> {
  return apiRequest<MapDoc>("/api/", { method: "POST", body: input });
}

export async function updateMap(
  mapId: string,
  updates: Partial<Pick<MapDoc, "name" | "color" | "discussionMode">>,
) {
  const res = await apiRequest<{ success: boolean; map: MapDoc }>(`/api/${mapId}`, {
    method: "PATCH",
    body: updates,
  });
  return res.map;
}

export async function deleteMap(mapId: string) {
  return apiRequest<{ success: boolean; message: string }>(`/api/${mapId}`, { method: "DELETE" });
}

export async function inviteMember(mapId: string, userIdToInvite: string): Promise<MapDoc> {
  const res = await apiRequest<{ success: boolean; map: MapDoc }>(`/api/${mapId}/invite`, {
    method: "POST",
    body: { userIdToInvite },
  });
  return res.map;
}

export async function setMyColor(mapId: string, color: string): Promise<MapDoc> {
  const res = await apiRequest<{ success: boolean; map: MapDoc }>(`/api/${mapId}/color`, {
    method: "PATCH",
    body: { color },
  });
  return res.map;
}

export interface MapSummary extends MapDoc {
  nodeCount: number;
  // Zero-filled for every known NodeType, not just the ones present on the
  // map — see getMapSummaryDao on the backend.
  nodesByType: Record<NodeType, number>;
}

export async function getMapSummary(mapId: string): Promise<MapSummary> {
  const res = await apiRequest<{ success: boolean } & MapSummary>(`/api/${mapId}/summary`);
  const { success, ...summary } = res;
  return summary as MapSummary;
}

export interface AttackIndicator {
  nodeId: string;
  incomingNegativeEdges: number;
  weapon: "sword" | "axe" | "spear";
}

export async function getAttackIndicators(mapId: string, threshold = 3) {
  const res = await apiRequest<{ success: boolean; threshold: number; indicators: AttackIndicator[] }>(
    `/api/${mapId}/attack-indicators?threshold=${threshold}`,
  );
  return res.indicators;
}

// "Stabilizing" a circle: locks its member nodes server-side (see
// NodeDoc.locked) and remembers the choice on the map. Every other circle
// is implicitly "unchosen" and left free to drift — see NodeCard. rootId
// identifies the circle (a node with 2+ direct parentId-children) by its
// root's public nodeId — the backend recomputes membership from current
// parentId links rather than trusting a client-supplied node list.
export async function selectCircle(mapId: string, rootId: string): Promise<SelectedCircle> {
  const res = await apiRequest<{ success: boolean; selectedCircle: SelectedCircle }>(
    `/api/${mapId}/circles/select`,
    { method: "POST", body: { rootId } },
  );
  return res.selectedCircle;
}

export async function deselectCircle(mapId: string): Promise<void> {
  await apiRequest<{ success: boolean }>(`/api/${mapId}/circles/deselect`, { method: "POST" });
}
