import { apiRequest, ApiRequestError } from "./client";
import * as offline from "../offline/sync";
import type { MapDoc, MapKind, MapTemplate, NodeType, SelectedCircle } from "../types";

export type MapFilter = "all" | "owned" | "shared";

const listPath = (filter: MapFilter) => `/api/?filter=${filter}`;
type ListPayload = { success: boolean; maps: MapDoc[] };

/** Applies an offline change to every kept copy of the dashboard's map list. */
function patchMapLists(fn: (maps: MapDoc[], filter: MapFilter) => MapDoc[]): Promise<unknown> {
  return Promise.all(
    (["all", "owned", "shared"] as const).map((filter) =>
      offline.patchCached<ListPayload>(listPath(filter), (prev) => ({ ...prev, maps: fn(prev.maps ?? [], filter) })),
    ),
  );
}

export async function listMaps(filter: MapFilter = "all"): Promise<MapDoc[]> {
  const res = await apiRequest<ListPayload>(listPath(filter));
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
  kind?: MapKind;
  // Discussion (true, the default) or Personal (false).
  discussionMode?: boolean;
}): Promise<MapDoc> {
  const localId = offline.newLocalId();
  return apiRequest<MapDoc>("/api/", {
    method: "POST",
    body: input,
    offline: {
      localId,
      idKey: "mapId",
      // A new, empty map that opens straight away; the starter nodes seeded
      // into it next are queued the same way (see api/nodes.ts's createNode).
      optimistic: async () => {
        const userId = offline.getOfflineUserId() ?? "";
        const now = new Date().toISOString();
        const map: MapDoc = {
          mapId: localId,
          name: input.name,
          ownerId: userId,
          members: [userId],
          memberCount: 1,
          memberNames: [],
          nodeCount: 0,
          memberColors: [{ userId, color: input.ownerColor }],
          color: input.color,
          selectedCircle: null,
          discussionMode: input.discussionMode ?? true,
          kind: input.kind ?? null,
          createdAt: now,
          updatedAt: now,
        };
        await Promise.all([
          offline.setCached(`/api/${localId}`, { success: true, map }),
          offline.setCached(`/api/${localId}/nodes`, []),
          offline.setCached(`/api/${localId}/edges`, []),
          offline.setCached(`/api/${localId}/lines`, []),
          patchMapLists((maps, filter) => (filter === "shared" ? maps : [map, ...maps])),
        ]);
        return map;
      },
    },
  });
}

export async function updateMap(
  mapId: string,
  updates: Partial<Pick<MapDoc, "name" | "color" | "discussionMode">>,
) {
  const res = await apiRequest<{ success: boolean; map: MapDoc }>(`/api/${mapId}`, {
    method: "PATCH",
    body: updates,
    offline: {
      merge: true,
      optimistic: async () => {
        const kept =
          (await offline.getCached<{ success: boolean; map: MapDoc }>(`/api/${mapId}`))?.map ??
          (await offline.getCached<ListPayload>(listPath("all")))?.maps.find((m) => m.mapId === mapId);
        const map = { ...(kept ?? ({ mapId } as MapDoc)), ...updates };
        await Promise.all([
          offline.patchCached<{ success: boolean; map: MapDoc }>(`/api/${mapId}`, (prev) => ({ ...prev, map: { ...prev.map, ...updates } })),
          patchMapLists((maps) => maps.map((m) => (m.mapId === mapId ? { ...m, ...updates } : m))),
        ]);
        return { success: true, map };
      },
    },
  });
  return res.map;
}

export async function deleteMap(mapId: string) {
  return apiRequest<{ success: boolean; message: string }>(`/api/${mapId}`, {
    method: "DELETE",
    offline: {
      optimistic: async () => {
        await patchMapLists((maps) => maps.filter((m) => m.mapId !== mapId));
        return { success: true, message: "Map deleted" };
      },
    },
  });
}

export async function inviteMember(mapId: string, userIdToInvite: string): Promise<MapDoc> {
  const res = await apiRequest<{ success: boolean; map: MapDoc }>(`/api/${mapId}/invite`, {
    method: "POST",
    body: { userIdToInvite },
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

// Backfills the `text` listNodes' own initial fetch deliberately omits (see
// Backend's getNodesByMapDao) — called lazily, in bulk, only for whichever
// nodes actually need their real text right now (a circle's own parent, a
// chosen cluster's members, a node whose panel/inline-edit just opened, or
// an export about to run). ids outside this map are just absent from the
// result rather than erroring.
//
// Every text read is also kept in this browser, so offline these come from
// there instead (only for nodes whose text was read, or written, here before).
export async function getNodesText(mapId: string, nodeIds: string[]): Promise<Record<string, string>> {
  const kept = await offline.getCachedTexts(mapId);
  const keptText = () => Object.fromEntries(nodeIds.filter((id) => id in kept).map((id) => [id, kept[id]]));
  // Nodes made offline and not sent yet exist only here.
  const serverIds = nodeIds.filter((id) => !offline.hasUnsyncedId(id));
  if (serverIds.length === 0 || !offline.isOnline()) return keptText();
  try {
    const res = await apiRequest<{ success: boolean; text: Record<string, string> }>(
      `/api/${mapId}/nodes/text`,
      { method: "POST", body: { nodeIds: serverIds } },
    );
    void offline.rememberTexts(mapId, res.text);
    // Answered under the ids the caller asked with, synced temporary ones included.
    const text = keptText();
    for (const id of serverIds) {
      const real = offline.resolveId(id);
      if (real in res.text) text[id] = res.text[real];
    }
    return text;
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 0) return keptText();
    throw err;
  }
}
