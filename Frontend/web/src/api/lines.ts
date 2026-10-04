import { apiRequest } from "./client";
import * as offline from "../offline/sync";
import type { LineDoc } from "../types";

export async function listLines(mapId: string): Promise<LineDoc[]> {
  return apiRequest<LineDoc[]>(`/api/${mapId}/lines`);
}

export async function createLine(mapId: string, points: { x: number; y: number }[]): Promise<LineDoc> {
  const localId = offline.newLocalId();
  return apiRequest<LineDoc>(`/api/lines/${mapId}`, {
    method: "POST",
    body: { points },
    offline: {
      localId,
      idKey: "lineId",
      optimistic: () => ({
        lineId: localId,
        mapId,
        userId: offline.getOfflineUserId() ?? "",
        points,
        createdAt: new Date().toISOString(),
      }),
    },
  });
}

export async function deleteLine(lineId: string) {
  return apiRequest<{ success: boolean; deletedId: string }>(`/api/lines/${lineId}`, {
    method: "DELETE",
    offline: { optimistic: () => ({ success: true, deletedId: lineId }) },
  });
}
