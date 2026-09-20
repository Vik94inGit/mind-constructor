import { apiRequest } from "./client";
import type { LineDoc } from "../types";

export async function listLines(mapId: string): Promise<LineDoc[]> {
  return apiRequest<LineDoc[]>(`/api/${mapId}/lines`);
}

export async function createLine(mapId: string, points: { x: number; y: number }[]): Promise<LineDoc> {
  return apiRequest<LineDoc>(`/api/lines/${mapId}`, { method: "POST", body: { points } });
}

export async function deleteLine(lineId: string) {
  return apiRequest<{ success: boolean; deletedId: string }>(`/api/lines/${lineId}`, { method: "DELETE" });
}
