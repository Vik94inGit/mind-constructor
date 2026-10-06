import { apiRequest } from "./client";
import * as offline from "../offline/sync";
import { upsertBy } from "../utils/mapGraph";
import type { EdgeDoc, EdgeSentiment } from "../types";

export async function listEdges(mapId: string): Promise<EdgeDoc[]> {
  return apiRequest<EdgeDoc[]>(`/api/${mapId}/edges`);
}

export async function createEdge(
  mapId: string,
  input: { fromNodeId: string; toNodeId: string; sentiment?: EdgeSentiment },
): Promise<EdgeDoc> {
  const localId = offline.newLocalId();
  return apiRequest<EdgeDoc>(`/api/edges/${mapId}`, {
    method: "POST",
    body: input,
    offline: {
      localId,
      idKey: "edgeId",
      optimistic: async () => {
        const edge: EdgeDoc = {
          edgeId: localId,
          mapId,
          fromNodeId: input.fromNodeId,
          toNodeId: input.toNodeId,
          sentiment: input.sentiment ?? "neutral",
          userId: offline.getOfflineUserId() ?? "",
        };
        await offline.upsertCached<EdgeDoc[]>(`/api/${mapId}/edges`, [], (list) =>
          upsertBy(list, edge, (e) => e.edgeId),
        );
        return edge;
      },
    },
  });
}

export async function deleteEdge(edgeId: string) {
  return apiRequest<{ success: boolean; deletedId: string }>(`/api/edges/${edgeId}`, {
    method: "DELETE",
    offline: { optimistic: () => ({ success: true, deletedId: edgeId }) },
  });
}
