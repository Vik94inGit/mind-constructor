import { apiRequest } from "./client";
import type { EdgeDoc, EdgeSentiment } from "../types";

export async function listEdges(mapId: string): Promise<EdgeDoc[]> {
  return apiRequest<EdgeDoc[]>(`/api/${mapId}/edges`);
}

export async function createEdge(
  mapId: string,
  input: { fromNodeId: string; toNodeId: string; sentiment?: EdgeSentiment },
): Promise<EdgeDoc> {
  return apiRequest<EdgeDoc>(`/api/edges/${mapId}`, { method: "POST", body: input });
}

export async function deleteEdge(edgeId: string) {
  return apiRequest<{ success: boolean; deletedId: string }>(`/api/edges/${edgeId}`, { method: "DELETE" });
}
