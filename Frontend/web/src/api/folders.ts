import { apiRequest } from "./client";
import * as offline from "../offline/sync";
import type { FolderDoc } from "../types";

type ListPayload = { success: boolean; folders: FolderDoc[] };
const LIST = "/api/folders";
const patchFolders = (fn: (folders: FolderDoc[]) => FolderDoc[]) =>
  offline.patchCached<ListPayload>(LIST, (prev) => ({ ...prev, folders: fn(prev.folders ?? []) }));

export async function listFolders(): Promise<FolderDoc[]> {
  const res = await apiRequest<ListPayload>(LIST);
  return res.folders;
}

export async function createFolder(name: string): Promise<FolderDoc> {
  const localId = offline.newLocalId();
  const res = await apiRequest<{ success: boolean; folder: FolderDoc }>(LIST, {
    method: "POST",
    body: { name },
    offline: {
      localId,
      idKey: "folder.folderId",
      optimistic: async () => {
        const folder: FolderDoc = { folderId: localId, name, mapIds: [] };
        await patchFolders((folders) => [...folders, folder]);
        return { success: true, folder };
      },
    },
  });
  return res.folder;
}

export async function renameFolder(folderId: string, name: string): Promise<FolderDoc> {
  const res = await apiRequest<{ success: boolean; folder: FolderDoc }>(`/api/folders/${folderId}`, {
    method: "PATCH",
    body: { name },
    offline: {
      merge: true,
      optimistic: async () => {
        const kept = (await offline.getCached<ListPayload>(LIST))?.folders.find((f) => f.folderId === folderId);
        await patchFolders((folders) => folders.map((f) => (f.folderId === folderId ? { ...f, name } : f)));
        return { success: true, folder: { folderId, mapIds: [], ...kept, name } };
      },
    },
  });
  return res.folder;
}

export async function deleteFolder(folderId: string) {
  return apiRequest<{ success: boolean; folderId: string }>(`/api/folders/${folderId}`, {
    method: "DELETE",
    offline: {
      optimistic: async () => {
        await patchFolders((folders) => folders.filter((f) => f.folderId !== folderId));
        return { success: true, folderId };
      },
    },
  });
}

/** Puts a map in one of your folders, or back at the top level with null. */
export async function moveMapToFolder(mapId: string, folderId: string | null) {
  return apiRequest<{ success: boolean; mapId: string; folderId: string | null }>(`/api/folders/maps/${mapId}`, {
    method: "PATCH",
    body: { folderId },
    offline: {
      merge: true,
      optimistic: async () => {
        await patchFolders((folders) =>
          folders.map((f) => {
            const without = f.mapIds.filter((id) => id !== mapId);
            return { ...f, mapIds: f.folderId === folderId ? [...without, mapId] : without };
          }),
        );
        return { success: true, mapId, folderId };
      },
    },
  });
}
